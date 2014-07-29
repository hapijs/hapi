// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Path = require('path');
var Shot = require('shot');
var Boom = require('boom');
var Hoek = require('hoek');
var LruCache = require('lru-cache');
var Auth = require('./auth');
var Defaults = require('./defaults');
var Request = require('./request');
var Router = require('./router');
var Schema = require('./schema');
var Views = require('./views');
var Ext = require('./ext');
var Headers = require('./response/headers');
// Pack delayed required inline


// Declare internals

var internals = {};


exports = module.exports = internals.Server = function (/* host, port, options */) {        // all optional

    Hoek.assert(this.constructor === internals.Server, 'Server must be instantiated using new');

    var Pack = require('./pack');           // Delayed required to avoid circular dependencies

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Validate arguments

    Hoek.assert(arguments.length <= 4, 'Too many arguments');          // 4th is for internal Pack usage

    var argMap = {
        string: 'host',
        number: 'port',
        object: 'options'
    };

    var args = {};
    for (var a = 0, al = arguments.length; a < al; ++a) {
        var argVal = arguments[a];
        if (argVal === undefined) {
            continue;
        }

        if (argVal instanceof Pack) {
            args.pack = arguments[a];
            continue;
        }

        var type = typeof argVal;

        if (type === 'string' && isFinite(+argVal)) {
            type = 'number';
            argVal = +argVal;
        }

        var key = argMap[type];
        Hoek.assert(key, 'Bad server constructor arguments: no match for arg type:', type);
        Hoek.assert(!args[key], 'Bad server constructor arguments: duplicated arg type:', type, '(values: `' + args[key] + '`, `' + argVal + '`)');
        args[key] = argVal;
    }

    this.settings = Hoek.applyToDefaultsWithShallow(Defaults.server, args.options || {}, ['app', 'plugins', 'views']);
    Schema.assert('server', this.settings);

    this.settings.labels = Hoek.unique([].concat(this.settings.labels));       // Convert string to array and removes duplicates

    // Set basic configuration

    this._unixDomainSocket = (args.host && args.host.indexOf('/') !== -1);
    this._windowsNamedPipe = (args.host && args.host.indexOf('\\\\.\\pipe\\') === 0);
    Hoek.assert(!this._unixDomainSocket || args.port === undefined, 'Cannot specify port with a UNIX domain socket');
    Hoek.assert(!this._windowsNamedPipe || args.port === undefined, 'Cannot specify port with a Windows named pipe');
    this._host = (args.host ? (this._unixDomainSocket ? Path.resolve(args.host) : (this._windowsNamedPipe ? args.host : args.host.toLowerCase())) : '');
    this._port = (args.port !== undefined ? args.port : (this.settings.tls ? 443 : 80));
    this._onConnection = null;          // Used to remove event listener on stop

    Hoek.assert(!this.settings.location || this.settings.location.charAt(this.settings.location.length - 1) !== '/', 'Location setting must not contain a trailing \'/\'');

    var socketTimeout = (this.settings.timeout.socket === undefined ? 2 * 60 * 1000 : this.settings.timeout.socket);
    Hoek.assert(!this.settings.timeout.server || !socketTimeout || this.settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout');
    Hoek.assert(!this.settings.timeout.client || !socketTimeout || this.settings.timeout.client < socketTimeout, 'Client timeout must be shorter than socket timeout');

    // Server facilities

    this._started = false;
    this.auth = new Auth(this);                                                 // Required before _router
    this._router = new Router(this);
    this._etags = (this.settings.files.etagsCacheMaxSize ? LruCache({ max: this.settings.files.etagsCacheMaxSize }) : null);

    // Server load

    Hoek.assert(this.settings.load.sampleInterval || (!this.settings.load.maxEventLoopDelay && !this.settings.load.maxHeapUsedBytes && !this.settings.load.maxRssBytes), 'Load sample interval must be set in enable load limits');

    this._eventLoopTimer = null;
    this._loadBench = new Hoek.Bench();
    this.load = {
        eventLoopDelay: 0,
        heapUsed: 0,
        rss: 0
    };

    /*
        onRequest:      New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreAuth:      After cookie parse and before authentication (skipped if state error)
        onPostAuth:     After authentication (and payload processing) and before validation (skipped if auth or payload error)
        onPreHandler:   After validation and body parsing, before route handler (skipped if auth or validation error)
        onPostHandler:  After route handler returns, before sending response (skipped if onPreHandler not called)
        onPreResponse:  Before response is sent (always called)
    */

    this._ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse']);

    this._stateDefinitions = {};
    this._registrations = {};

    if (args.pack) {
        this.pack = args.pack;
    }
    else {
        this.pack = new Pack({ cache: this.settings.cache, debug: this.settings.debug });
        this.pack._server(this);
    }

    this.plugins = {};                                      // Registered plugin APIs by plugin name
    this.app = {};                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.methods = this.pack._methods.methods;              // Method functions

    // Generate CORS headers

    this.settings.cors = Hoek.applyToDefaults(Defaults.cors, this.settings.cors);
    if (this.settings.cors) {
        this.settings.cors._headers = this.settings.cors.headers.concat(this.settings.cors.additionalHeaders).join(', ');
        this.settings.cors._methods = this.settings.cors.methods.concat(this.settings.cors.additionalMethods).join(', ');
        this.settings.cors._exposedHeaders = this.settings.cors.exposedHeaders.concat(this.settings.cors.additionalExposedHeaders).join(', ');

        if (this.settings.cors.origin.length) {
            this.settings.cors._origin = {
                any: false,
                qualified: [],
                qualifiedString: '',
                wildcards: []
            };

            if (this.settings.cors.origin.indexOf('*') !== -1) {
                Hoek.assert(this.settings.cors.origin.length === 1, 'Cannot specify cors.origin * together with other values');
                this.settings.cors._origin.any = true;
            }
            else {
                for (var c = 0, cl = this.settings.cors.origin.length; c < cl; ++c) {
                    var origin = this.settings.cors.origin[c];
                    if (origin.indexOf('*') !== -1) {
                        this.settings.cors._origin.wildcards.push(new RegExp('^' + Hoek.escapeRegex(origin).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$'));
                    }
                    else {
                        this.settings.cors._origin.qualified.push(origin);
                    }
                }

                Hoek.assert(this.settings.cors.matchOrigin || !this.settings.cors._origin.wildcards.length, 'Cannot include wildcard origin values with matchOrigin disabled');
                this.settings.cors._origin.qualifiedString = this.settings.cors._origin.qualified.join(' ');
            }
        }
    }

    // Generate security headers

    this.settings.security = Hoek.applyToDefaults(Defaults.security, this.settings.security);
    if (this.settings.security) {
        if (this.settings.security.hsts) {
            if (this.settings.security.hsts === true) {
                this.settings.security._hsts = 'max-age=15768000';
            }
            else if (typeof this.settings.security.hsts === 'number') {
                this.settings.security._hsts = 'max-age=' + this.settings.security.hsts;
            }
            else {
                this.settings.security._hsts = 'max-age=' + (this.settings.security.hsts.maxAge || 15768000);
                if (this.settings.security.hsts.includeSubdomains) {
                    this.settings.security._hsts += '; includeSubdomains';
                }
            }
        }

        if (this.settings.security.xframe) {
            if (this.settings.security.xframe === true) {
                this.settings.security._xframe = 'DENY';
            }
            else if (typeof this.settings.security.xframe === 'string') {
                this.settings.security._xframe = this.settings.security.xframe.toUpperCase();
            }
            else {
                if (this.settings.security.xframe.rule === 'allow-from') {
                    if (!this.settings.security.xframe.source) {
                        this.settings.security._xframe = 'SAMEORIGIN';
                    }
                    else {
                        this.settings.security._xframe = 'ALLOW-FROM ' + this.settings.security.xframe.source;
                    }
                }
                else {
                    this.settings.security._xframe = this.settings.security.xframe.rule.toUpperCase();
                }
            }
        }
    }

    // Initialize Views

    if (this.settings.views) {
        this._views = new Views.Manager(this.settings.views);
    }

    // Create server

    if (this.settings.tls) {
        this.listener = Https.createServer(this.settings.tls, this._dispatch());
    }
    else {
        this.listener = Http.createServer(this._dispatch());
    }

    this._agents = {};
    if (this.settings.maxSockets !== false) {
        this._agents.https = new Https.Agent();
        this._agents.https.maxSockets = this.settings.maxSockets;

        this._agents.insecureAgent = new Https.Agent({ rejectUnauthorized: false });
        this._agents.insecureAgent.maxSockets = this.settings.maxSockets;

        this._agents.http = new Http.Agent();
        this._agents.http.maxSockets = this.settings.maxSockets;
    }

    // Server information

    this.info = {
        host: this._host || '0.0.0.0'
    };

    if (this._unixDomainSocket ||
        this._windowsNamedPipe) {

        this.info.port = 0;
        this.info.protocol = (this._unixDomainSocket ? 'unix' : 'windows');
        this.info.uri = this.info.protocol + ':' + this._host;
    }
    else {
        this.info.port = this._port || 0;
        this.info.protocol = (this.settings.tls ? 'https' : 'http');

        if (this.info.port) {
            this.info.uri = this.info.protocol + '://' + (this._host || Os.hostname() || 'localhost') + ':' + this.info.port;
        }
    }
};

Hoek.inherits(internals.Server, Events.EventEmitter);


internals.Server.prototype._dispatch = function (options) {

    var self = this;

    options = options || {};
    var load = this.load;
    var limits = this.settings.load;

    return function (req, res) {

        // Create request

        var request = new Request(self, req, res, options);

        // Check load

        if (limits.sampleInterval &&
            ((limits.maxEventLoopDelay && (load.eventLoopDelay > limits.maxEventLoopDelay || self._loadBench.elapsed() > limits.maxEventLoopDelay)) ||
            (limits.maxHeapUsedBytes && load.heapUsed > limits.maxHeapUsedBytes) ||
            (limits.maxRssBytes && load.rss > limits.maxRssBytes))) {

            self.log(['hapi', 'load'], load);
            request._reply(Boom.serverTimeout('Server under heavy load', load));
        }
        else {

            // Execute request lifecycle

            request._protect.domain.run(function () {

                request._execute();
            });
        }
    };
};


internals.Server.prototype.table = function (host) {

    return this._router.table(host);
};


internals.Server.prototype.start = function (callback) {

    this.pack.start(callback);
};


internals.Server.prototype._start = function (callback) {

    if (this._started) {
        return Hoek.nextTick(callback)();
    }

    this._started = true;

    this._init(callback);       // callback is called after this.listener.listen()

    if (this._unixDomainSocket ||
        this._windowsNamedPipe) {

        this.listener.listen(this._host);
    }
    else {
        this.listener.listen(this._port, this._host);
    }
};


internals.Server.prototype._init = function (callback) {

    var self = this;

    // Load measurements

    if (this.settings.load.sampleInterval) {
        var loopSample = function () {

            self._loadBench.reset();
            var measure = function () {

                var mem = process.memoryUsage();

                self.load.eventLoopDelay = (self._loadBench.elapsed() - self.settings.load.sampleInterval);
                self.load.heapUsed = mem.heapUsed;
                self.load.rss = mem.rss;

                loopSample();
            };

            self._eventLoopTimer = setTimeout(measure, self.settings.load.sampleInterval);
        };

        loopSample();
    }

    // Setup listener

    this._connections = {};
    var onListening = function () {

        // Update the host, port, and uri with active values

        if (!self._unixDomainSocket ||
            !self._windowsNamedPipe) {

            var address = self.listener.address();
            self.info.host = self._host || address.address || '0.0.0.0';
            self.info.port = address.port;
            self.info.uri = self.info.protocol + '://' + (self._host || Os.hostname() || 'localhost') + ':' + self.info.port;
        }

        return callback();
    };

    this.listener.once('listening', onListening);

    this._onConnection = function (connection) {

        var key = connection.remoteAddress + ':' + connection.remotePort;
        self._connections[key] = connection;

        connection.once('close', function () {

            delete self._connections[key];
        });
    };

    this.listener.on('connection', this._onConnection);

    return this.listener;
};


internals.Server.prototype.stop = function (options, callback) {

    this.pack.stop(options, callback);
};


internals.Server.prototype._stop = function (options, callback) {

    var self = this;

    options = options || {};
    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (!this._started) {
        return Hoek.nextTick(callback)();
    }

    this._started = false;

    if (this._eventLoopTimer) {
        clearTimeout(this._eventLoopTimer);
    }

    var timeoutId = setTimeout(function () {

        Object.keys(self._connections).forEach(function (key) {

            self._connections[key].destroy();
        });
    }, options.timeout);

    this.listener.close(function () {

        self.listener.removeListener('connection', self._onConnection);
        clearTimeout(timeoutId);
        callback();
    });
};


internals.Server.prototype.log = function (tags, data, timestamp) {

    this.pack.log(tags, data, timestamp, this);
};


internals.Server.prototype.ext = function () {

    return this._ext.add.apply(this._ext, arguments);
};


internals.Server.prototype._ext = function () {

    return this._ext.add.apply(this._ext, arguments);
};


internals.Server.prototype.route = function (configs) {

    this._route(configs);
};


internals.Server.prototype._route = function (configs, env) {

    this._router.add(configs, env);
};


internals.Server.prototype.state = function (name, options) {

    Hoek.assert(name && typeof name === 'string', 'Invalid name');
    Hoek.assert(!this._stateDefinitions[name], 'State already defined:', name);
    if (options) {
        Schema.assert('state', options, name);
    }

    this._stateDefinitions[name] = Hoek.applyToDefaults(Defaults.state, options || {});
};


internals.Server.prototype.views = function (options) {

    Hoek.assert(!this._views, 'Cannot set server views manager more than once');
    this._views = new Views.Manager(options);
};


internals.Server.prototype.cache = function (name, options) {

    Schema.assert('cachePolicy', options, name);
    Hoek.assert(!options.segment, 'Cannot override segment name in server cache');
    return this.pack._provisionCache(options, 'server', name);
};


internals.Server.prototype.inject = function (options, callback) {

    var requestOptions = (options.credentials ? { credentials: options.credentials } : null);
    delete options.credentials;

    var needle = this._dispatch(requestOptions);
    Shot.inject(needle, options, function (res) {

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


internals.Server.prototype.method = function () {

    return this.pack._method.apply(this.pack, arguments);
};


internals.Server.prototype.handler = function () {

    return this.pack._handler.apply(this.pack, arguments);
};


internals.Server.prototype.location = function (uri, request) {

    return Headers.location(uri, this, request);
};
