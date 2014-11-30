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

    this.settings = options;                                                        // options cloned in server.connection()
    this.server = server;

    // Normalize settings

    this.settings.labels = Hoek.unique(this.settings.labels || []);                 // Remove duplicates
    if (this.settings.port === undefined) {
        this.settings.port = 0;
    }

    this.type = (typeof this.settings.port === 'string' ? 'socket' : 'tcp');
    if (this.type === 'socket') {
        this.settings.port = (this.settings.port.indexOf('/') !== -1 ? Path.resolve(this.settings.port) : this.settings.port.toLowerCase());
    }

    if (this.settings.autoListen === undefined) {
        this.settings.autoListen = true;
    }

    Hoek.assert(this.settings.autoListen || !this.settings.port, 'Cannot specify port when autoListen is false');
    Hoek.assert(this.settings.autoListen || !this.settings.address, 'Cannot specify address when autoListen is false');

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
    this.states = new Statehood.Definitions(this.settings.state);
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
        host: this.settings.host || Os.hostname() || 'localhost',
        protocol: this.type === 'tcp' ? (this.settings.tls ? 'https' : 'http') : this.type,
        id: Os.hostname() + ':' + process.pid + ':' + now.toString(36)
    };

    if (this.settings.port) {
        this.info.port = this.settings.port;
        this.info.uri = this.info.protocol + ':' + (this.type === 'tcp' ? '//' + this.info.host + ':' + this.info.port : this.info.port);
    }
};

Hoek.inherits(internals.Connection, Events.EventEmitter);


internals.Connection.prototype._init = function () {

    var self = this;

    // Setup listener

    this.listener.once('listening', function () {

        // Update the address, port, and uri with active values

        if (self.type === 'tcp') {
            var address = self.listener.address();
            self.info.address = address.address;
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


internals.Connection.prototype._start = function (callback) {

    if (this._started) {
        return process.nextTick(callback);
    }

    this._started = true;
    this.info.started = Date.now();

    if (!this.settings.autoListen) {
        return process.nextTick(callback);
    }

    if (this.type !== 'tcp') {
        this.listener.listen(this.settings.port, callback);
    }
    else {
        var address = this.settings.address || this.settings.host || '0.0.0.0';
        this.listener.listen(this.settings.port, address, callback);
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
    }, this, this.server._env));

    this._router.special('badRequest', new Route({
        method: 'badRequest',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.badRequest());
            }
        }
    }, this, this.server._env));

    if (this.settings.routes.cors) {
        this._router.special('options', new Route({
            path: '/{p*}',
            method: 'options',
            config: {
                auth: false,                         // Override any defaults
                cors: this.settings.routes.cors,
                handler: function (request, reply) {

                    return reply({});
                }
            }
        }, this, this.server._env));
    }
};
