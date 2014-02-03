// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Path = require('path');
var Shot = require('shot');
var Boom = require('boom');
var LruCache = require('lru-cache');
var Auth = require('./auth');
var Defaults = require('./defaults');
var DTrace = require('./dtrace');
var Request = require('./request');
var Router = require('./router');
var Schema = require('./schema');
var Views = require('./views');
var Ext = require('./ext');
var Handler = require('./handler');
var Utils = require('./utils');
// Pack delayed required inline


// Declare internals

var internals = {};


module.exports = internals.Server = function (/* host, port, options */) {        // all optional

    Utils.assert(this.constructor === internals.Server, 'Server must be instantiated using new');

    var Pack = require('./pack');           // Delayed required to avoid circular dependencies

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Validate arguments

    Utils.assert(arguments.length <= 4, 'Too many arguments');          // 4th is for internal Pack usage

    var argMap = {
        string: 'host',
        number: 'port',
        object: 'options'
    };

    var args = {};
    for (var a = 0, al = arguments.length; a < al; ++a) {
        if (arguments[a] === undefined) {
            continue;
        }

        if (arguments[a] instanceof Pack) {
            args.pack = arguments[a];
            continue;
        }

        var type = typeof arguments[a];
        var key = argMap[type];
        Utils.assert(key, 'Bad server constructor arguments: no match for arg type:', type);
        Utils.assert(!args[key], 'Bad server constructor arguments: duplicated arg type:', type, '(values: `' + args[key] + '`, `' + arguments[a] + '`)');
        args[key] = arguments[a];
    }

    this.settings = Utils.applyToDefaults(Defaults.server, args.options || {});
    var schemaError = Schema.server(this.settings);
    Utils.assert(!schemaError, 'Invalid server options:', schemaError);

    // Set basic configuration

    this._unixDomainSocket = (args.host && args.host.indexOf('/') !== -1);
    this._windowsNamedPipe = (args.host && args.host.indexOf('\\\\.\\pipe\\') === 0);
    Utils.assert(!this._unixDomainSocket || args.port === undefined, 'Cannot specify port with a UNIX domain socket');
    Utils.assert(!this._windowsNamedPipe || args.port === undefined, 'Cannot specify port with a Windows named pipe');
    this._host = (args.host ? (this._unixDomainSocket ? Path.resolve(args.host) : (this._windowsNamedPipe ? args.host : args.host.toLowerCase())) : '');
    this._port = (args.port !== undefined ? args.port : (this.settings.tls ? 443 : 80));
    this._onConnection = null;          // Used to remove event listener on stop

    Utils.assert(!this.settings.location || this.settings.location.charAt(this.settings.location.length - 1) !== '/', 'Location setting must not contain a trailing \'/\'');

    var socketTimeout = (this.settings.timeout.socket === undefined ? 2 * 60 * 1000 : this.settings.timeout.socket);
    Utils.assert(!this.settings.timeout.server || !socketTimeout || this.settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout');
    Utils.assert(!this.settings.timeout.client || !socketTimeout || this.settings.timeout.client < socketTimeout, 'Client timeout must be shorter than socket timeout');

    // Server facilities

    this._started = false;
    this.auth = new Auth(this);                                                 // Required before _router
    this._router = new Router(this);
    this._etags = (this.settings.files.etagsCacheMaxSize ? LruCache({ max: this.settings.files.etagsCacheMaxSize }) : null);

    // Server load

    Utils.assert(this.settings.load.sampleInterval || (!this.settings.load.maxEventLoopDelay && !this.settings.load.maxHeapUsedBytes && !this.settings.load.maxRssBytes), 'Load sample interval must be set in enable load limits');

    this._eventLoopTimer = null;
    this._loadBench = new Utils.Bench();
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

    this._ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse'], Handler.invoke);

    this._stateDefinitions = {};
    this._dtrace = new DTrace('' + this._port);

    if (args.pack) {
        this.pack = args.pack;
    }
    else {
        this.pack = new Pack({ cache: this.settings.cache });
        this.pack._server(this);
    }

    this.plugins = {};                                      // Registered plugin APIs by plugin name
    this.app = {};                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.helpers = this.pack._helpers;                      // Helper functions

    // Generate CORS headers

    this.settings.cors = Utils.applyToDefaults(Defaults.cors, this.settings.cors);
    if (this.settings.cors) {
        this.settings.cors._headers = (this.settings.cors.headers || []).concat(this.settings.cors.additionalHeaders || []).join(', ');
        this.settings.cors._methods = (this.settings.cors.methods || []).concat(this.settings.cors.additionalMethods || []).join(', ');
        this.settings.cors._exposedHeaders = (this.settings.cors.exposedHeaders || []).concat(this.settings.cors.additionalExposedHeaders || []).join(', ');

        if (this.settings.cors.origin && this.settings.cors.origin.length) {
            this.settings.cors._origin = {
                any: false,
                qualified: [],
                qualifiedString: '',
                wildcards: []
            };

            if (this.settings.cors.origin.indexOf('*') !== -1) {
                Utils.assert(this.settings.cors.origin.length === 1, 'Cannot specify cors.origin * together with other values');
                this.settings.cors._origin.any = true;
            }
            else {
                for (var c = 0, cl = this.settings.cors.origin.length; c < cl; ++c) {
                    var origin = this.settings.cors.origin[c];
                    if (origin.indexOf('*') !== -1) {
                        this.settings.cors._origin.wildcards.push(new RegExp('^' + Utils.escapeRegex(origin).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$'));
                    }
                    else {
                        this.settings.cors._origin.qualified.push(origin);
                    }
                }

                Utils.assert(this.settings.cors.matchOrigin || !this.settings.cors._origin.wildcards.length, 'Cannot include wildcard origin values with matchOrigin disabled');
                this.settings.cors._origin.qualifiedString = this.settings.cors._origin.qualified.join(' ');
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

    if (this.settings.maxSockets !== null) {
        Https.globalAgent.maxSockets = this.settings.maxSockets;
        Http.globalAgent.maxSockets = this.settings.maxSockets;
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

Utils.inherits(internals.Server, Events.EventEmitter);


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
            ((limits.maxEventLoopDelay && (load.eventLoopDelay > limits.maxEventLoopDelay || self._loadBench.elapsed() - limits.sampleInterval > limits.maxEventLoopDelay)) ||
            (limits.maxHeapUsedBytes && load.heapUsed > limits.maxHeapUsedBytes) ||
            (limits.maxRssBytes && load.rss > limits.maxRssBytes))) {

            request._reply(Boom.serverTimeout('Server under heavy load', load));
        }
        else {

            // Execute request lifecycle

            request._execute();
        }
    };
};


internals.Server.prototype.table = function () {

    return this._router.table();
};


// Start server listener

internals.Server.prototype.start = function (callback) {

    this.pack.start(callback);
};


internals.Server.prototype._start = function (callback) {

    var self = this;

    callback = callback || Utils.ignore;

    if (this._started) {
        return Utils.nextTick(callback)();
    }

    this._started = true;

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

    if (this._unixDomainSocket ||
        this._windowsNamedPipe) {

        this.listener.listen(this._host);
    }
    else {
        this.listener.listen(this._port, this._host);
    }
};


// Stop server

internals.Server.prototype.stop = function (options, callback) {

    this.pack.stop(options, callback);
};


internals.Server.prototype._stop = function (options, callback) {

    var self = this;

    options = options || {};
    callback = callback || Utils.ignore;
    options.timeout = options.timeout || 5000;                                              // Default timeout to 5 seconds

    if (!this._started) {
        return Utils.nextTick(callback)();
    }

    this._started = false;

    if (this._eventLoopTimer) {
        clearTimeout(this._eventLoopTimer);
    }

    var timeoutId = setTimeout(function () {

        Object.keys(self._connections).forEach(function (key) {

            var connection = self._connections[key];
            return connection && connection.destroy();
        });
    }, options.timeout);

    this.listener.close(function () {

        self.listener.removeListener('connection', self._onConnection);
        clearTimeout(timeoutId);
        callback();
    });
};


internals.Server.prototype.log = function (tags, data, timestamp) {

    tags = (Array.isArray(tags) ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());

    var event = {
        timestamp: now,
        tags: tags,
        data: data
    };

    this.emit('log', event, Utils.mapToObject(event.tags));
};


// Register an extension function

internals.Server.prototype.ext = function () {

    return this._ext.add.apply(this._ext, arguments);
};


internals.Server.prototype._ext = function () {

    return this._ext._add.apply(this._ext, arguments);
};


// Add server route

internals.Server.prototype.route = function (configs) {

    this._route(configs);
};


internals.Server.prototype._route = function (configs, env) {

    this._router.add(configs, env);
};


internals.Server.prototype.state = function (name, options) {

    Utils.assert(name && typeof name === 'string', 'Invalid name');
    Utils.assert(!this._stateDefinitions[name], 'State already defined:', name);
    Utils.assert(!options || !options.encoding || ['base64json', 'base64', 'form', 'iron', 'none'].indexOf(options.encoding) !== -1, 'Bad encoding');

    this._stateDefinitions[name] = Utils.applyToDefaults(Defaults.state, options || {});
};


internals.Server.prototype.views = function (options) {

    Utils.assert(!this._views, 'Cannot set server views manager more than once');
    this._views = new Views.Manager(options);
};


internals.Server.prototype.cache = function (name, options) {

    var schemaError = Schema.cache(options);
    Utils.assert(!schemaError, 'Invalid cache options for', name, ':', schemaError);

    Utils.assert(!options.segment, 'Cannot override segment name in server cache');
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
            res.result = res.result || res.payload;
        }

        return callback(res);
    });
};


internals.Server.prototype.helper = function (name, method, options) {

    return this.pack._helper(name, method, options);
};
