// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Path = require('path');
var Boom = require('boom');
var Call = require('call');
var Hoek = require('hoek');
var Shot = require('shot');
var Statehood = require('statehood');
var Topo = require('topo');
var Auth = require('./auth');
var Request = require('./request');
var Route = require('./route');
var Schema = require('./schema');


// Declare internals

var internals = {
    counter: {
        min: 10000,
        max: 99999
    }
};


exports = module.exports = internals.Connection = function (server, options) {

    var now = Date.now();

    Events.EventEmitter.call(this);

    this.settings = this._compile(options);             // Modifies options
    this.server = server;

    // Connection properties

    this._port = this.settings.port;
    this.type = (typeof this._port === 'string' ? 'socket' : 'tcp');
    if (this.type === 'socket') {
        this._port = (this._port.indexOf('/') !== -1 ? Path.resolve(this._port) : this._port.toLowerCase());
    }

    // Connection facilities

    this._started = false;
    this._connections = {};
    this._onConnection = null;          // Used to remove event listener on stop
    this._registrations = {};           // Tracks plugin for dependency validation

    this._extensions = {
        onRequest: null,            // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreAuth: null,            // After cookie parse and before authentication (skipped if state error)
        onPostAuth: null,           // After authentication (and payload processing) and before validation (skipped if auth or payload error)
        onPreHandler: null,         // After validation and body parsing, before route handler (skipped if auth or validation error)
        onPostHandler: null,        // After route handler returns, before sending response (skipped if onPreHandler not called)
        onPreResponse: null         // Before response is sent (always called)
    };

    this._requestCounter = { value: internals.counter.min, min: internals.counter.min, max: internals.counter.max };
    this._load = server._heavy.policy(this.settings.load);
    this._stateDefinitions = new Statehood.Definitions(this.settings.state.cookies);
    this.auth = new Auth(this);
    this._router = new Call.Router(this.settings.router);
    this._defaultRoutes();

    this.plugins = {};                  // Registered plugin APIs by plugin name
    this.app = {};                      // Place for application-specific state without conflicts with hapi, should not be used by plugins

    // Create listener

    this.listener = this.settings.listener || (this.settings.tls ? Https.createServer(this.settings.tls) : Http.createServer());
    this.listener.on('request', this._dispatch());
    this._init();

    // Connection information

    this.info = {
        created: now,
        started: 0,
        host: this._hostname(),
        port: this._port,
        protocol: this.type === 'tcp' ? (this.settings.tls ? 'https' : 'http') : this.type
    };

    this.info.uri = this.info.protocol + ':' + (this.type === 'tcp' ? '//' + this.info.host + ':' + this.info.port : this.info.port);
    this.info.id = Os.hostname() + ':' + process.pid + ':' + now.toString(36);
};

Hoek.inherits(internals.Connection, Events.EventEmitter);


internals.Connection.prototype._init = function () {

    var self = this;

    // Setup listener

    this.listener.once('listening', function () {

        // Update the host, port, and uri with active values

        if (self.type === 'tcp') {
            var address = self.listener.address();
            self.info.host = self._hostname(address.address);
            self.info.port = address.port;
            self.info.uri = self.info.protocol + '://' + self.info.host + ':' + self.info.port;
        }
    });

    this._connections = {};
    this._onConnection = function (connection) {

        var key = connection.remoteAddress + ':' + connection.remotePort;
        self._connections[key] = connection;

        connection.once('close', function () {

            delete self._connections[key];
        });
    };

    this.listener.on('connection', this._onConnection);
};


internals.Connection.prototype._hostname = function (address) {

    return this.settings.host || address || Os.hostname() || 'localhost';
};


internals.Connection.prototype._start = function (callback) {

    if (this._started) {
        return process.nextTick(callback);
    }

    this._started = true;
    this.info.started = Date.now();

    if (!this.settings.autoListen) {
        return process.nextTick(callback);
    }

    if (this.type !== 'tcp' ||
        !this.settings.host) {

        this.listener.listen(this._port, callback);
    }
    else {
        this.listener.listen(this._port, this.settings.host, callback);
    }
};


internals.Connection.prototype._stop = function (options, callback) {

    var self = this;

    options = options || {};
    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (!this._started) {
        return process.nextTick(callback);
    }

    this._started = false;
    this.info.started = 0;

    var timeoutId = setTimeout(function () {

        Object.keys(self._connections).forEach(function (key) {

            self._connections[key].destroy();
        });
    }, options.timeout);

    this.listener.close(function () {

        self.listener.removeListener('connection', self._onConnection);
        clearTimeout(timeoutId);

        self._init();
        return callback();
    });
};


internals.Connection.prototype._dispatch = function (options) {

    var self = this;

    options = options || {};

    return function (req, res) {

        // Create request

        var request = new Request(self, req, res, options);

        // Check load

        if (!self._load.check()) {
            self.server._log(['load'], self.server.load);
            request._reply(Boom.serverTimeout('Server under heavy load', self.server.load));
        }
        else {

            // Execute request lifecycle

            request._protect.domain.run(function () {

                request._execute();
            });
        }
    };
};


internals.Connection.prototype.inject = function (options, callback) {

    var settings = options;
    if (settings.credentials) {
        settings = Hoek.shallow(options);               // options can be reused
        delete settings.credentials;
    }

    var needle = this._dispatch({ credentials: options.credentials });
    Shot.inject(needle, settings, function (res) {

        if (res.raw.res._hapi) {
            res.result = res.raw.res._hapi.result;
            delete res.raw.res._hapi;
        }
        else {
            res.result = res.payload;
        }

        return callback(res);
    });
};


internals.Connection.prototype.table = function (host) {

    return this._router.table(host);
};


internals.Connection.prototype.lookup = function (id) {

    Hoek.assert(id && typeof id === 'string', 'Invalid route id:', id);

    var record = this._router.ids[id];
    if (!record) {
        return null;
    }

    return record.route.settings;
};


internals.Connection.prototype._ext = function (event, func, options, env) {

    options = options || {};

    Hoek.assert(this._extensions[event] !== undefined, 'Unknown event type', event);

    var settings = {
        before: options.before,
        after: options.after,
        group: env.plugin
    };

    var nodes = [];
    ([].concat(func)).forEach(function (fn, i) {

        var node = {
            func: fn,               // function (request, next) { next(); }
            env: env,
            bind: options.bind
        };

        nodes.push(node);
    });

    this._extensions[event] = this._extensions[event] || new Topo();
    this._extensions[event].add(nodes, settings);
};


internals.Connection.prototype._state = function (name, options) {

    Schema.assert('state', options, name);
    this._stateDefinitions.add(name, options);
};


internals.Connection.prototype._route = function (configs, env) {

    configs = [].concat(configs);
    for (var i = 0, il = configs.length; i < il; ++i) {
        var config = configs[i];

        if (Array.isArray(config.method)) {
            for (var m = 0, ml = config.method.length; m < ml; ++m) {
                var method = config.method[m];

                var settings = Hoek.shallow(config);
                settings.method = method;
                this._addRoute(settings, env);
            }
        }
        else {
            this._addRoute(config, env);
        }
    }
};


internals.Connection.prototype._addRoute = function (config, env) {

    var route = new Route(config, this, env);                // Do no use config beyond this point, use route members
    var vhosts = [].concat(route.settings.vhost || '*');

    for (var i = 0, il = vhosts.length; i < il; ++i) {
        var vhost = vhosts[i];
        var record = this._router.add({ method: route.method, path: route.path, vhost: vhost, analysis: route._analysis, id: route.settings.id }, route);
        route.fingerprint = record.fingerprint;
        route.params = record.params;
    }
};


internals.Connection.prototype._defaultRoutes = function () {

    this._router.special('notFound', new Route({
        method: 'notFound',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.notFound());
            }
        }
    }, this));

    this._router.special('badRequest', new Route({
        method: 'badRequest',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.badRequest());
            }
        }
    }, this));

    if (this.settings.cors) {
        this._router.special('options', new Route({
            path: '/{p*}',
            method: 'options',
            config: {
                auth: false,                         // Override any defaults
                handler: function (request, reply) {

                    return reply({});
                }
            }
        }, this));
    }
};


internals.Connection.prototype._compile = function (options) {

    options.labels = Hoek.unique([].concat(options.labels || []));          // Convert string to array and removes duplicates
    if (options.port === undefined) {
        options.port = 0;
    }

    if (options.autoListen === undefined) {
        options.autoListen = true;
    }

    Hoek.assert(options.autoListen || !options.port, 'Cannot specify port when autoListen is false');

    if (options.cors) {
        options.cors._headers = options.cors.headers.concat(options.cors.additionalHeaders).join(', ');
        options.cors._methods = options.cors.methods.concat(options.cors.additionalMethods).join(', ');
        options.cors._exposedHeaders = options.cors.exposedHeaders.concat(options.cors.additionalExposedHeaders).join(', ');

        if (options.cors.origin.length) {
            options.cors._origin = {
                any: false,
                qualified: [],
                qualifiedString: '',
                wildcards: []
            };

            if (options.cors.origin.indexOf('*') !== -1) {
                Hoek.assert(options.cors.origin.length === 1, 'Cannot specify cors.origin * together with other values');
                options.cors._origin.any = true;
            }
            else {
                for (var c = 0, cl = options.cors.origin.length; c < cl; ++c) {
                    var origin = options.cors.origin[c];
                    if (origin.indexOf('*') !== -1) {
                        options.cors._origin.wildcards.push(new RegExp('^' + Hoek.escapeRegex(origin).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$'));
                    }
                    else {
                        options.cors._origin.qualified.push(origin);
                    }
                }

                Hoek.assert(options.cors.matchOrigin || !options.cors._origin.wildcards.length, 'Cannot include wildcard origin values with matchOrigin disabled');
                options.cors._origin.qualifiedString = options.cors._origin.qualified.join(' ');
            }
        }
    }

    if (options.security) {
        if (options.security.hsts) {
            if (options.security.hsts === true) {
                options.security._hsts = 'max-age=15768000';
            }
            else if (typeof options.security.hsts === 'number') {
                options.security._hsts = 'max-age=' + options.security.hsts;
            }
            else {
                options.security._hsts = 'max-age=' + (options.security.hsts.maxAge || 15768000);
                if (options.security.hsts.includeSubdomains) {
                    options.security._hsts += '; includeSubdomains';
                }
            }
        }

        if (options.security.xframe) {
            if (options.security.xframe === true) {
                options.security._xframe = 'DENY';
            }
            else if (typeof options.security.xframe === 'string') {
                options.security._xframe = options.security.xframe.toUpperCase();
            }
            else if (options.security.xframe.rule === 'allow-from') {
                if (!options.security.xframe.source) {
                    options.security._xframe = 'SAMEORIGIN';
                }
                else {
                    options.security._xframe = 'ALLOW-FROM ' + options.security.xframe.source;
                }
            }
            else {
                options.security._xframe = options.security.xframe.rule.toUpperCase();
            }
        }
    }

    options._cacheControlStatus = Hoek.mapToObject(options.cacheControlStatus);

    return options;
};
