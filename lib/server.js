// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Shot = require('shot');
var Boom = require('boom');
var Catbox = require('catbox');
var Auth = require('./auth');
var Defaults = require('./defaults');
var Request = require('./request');
var Router = require('./router');
var Schema = require('./schema');
var Views = require('./views');
var Ext = require('./ext');
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
        Utils.assert(!args[key], 'Bad server constructor arguments: duplicated arg type:', type);
        args[key] = arguments[a];
    }

    this.settings = Utils.applyToDefaults(Defaults.server, args.options || {});
    var schemaError = Schema.server(this.settings);
    Utils.assert(!schemaError, 'Invalid server options:', schemaError);

    // Set basic configuration

    this._host = args.host ? args.host.toLowerCase() : '';
    this._port = typeof args.port !== 'undefined' ? args.port : (this.settings.tls ? 443 : 80);

    Utils.assert(!this.settings.location || this.settings.location.charAt(this.settings.location.length - 1) !== '/', 'Location setting must not contain a trailing \'/\'');

    var socketTimeout = (this.settings.timeout.socket === undefined ? 2 * 60 * 1000 : this.settings.timeout.socket);
    Utils.assert(!this.settings.timeout.server || !socketTimeout || this.settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout');
    Utils.assert(!this.settings.timeout.client || !socketTimeout || this.settings.timeout.client < socketTimeout, 'Client timeout must be shorter than socket timeout');

    // Server facilities

    this._started = false;
    this._auth = new Auth(this);                            // Required before _router
    this._router = new Router(this);
    this._ext = new Ext();
    this._stateDefinitions = {};

    if (args.pack) {
        this.pack = args.pack;
    }
    else {
        this.pack = new Pack({ cache: this.settings.cache });
        this.pack._server(this);
    }

    this.plugins = {};                                      // Registered plugin APIs by plugin name
    this.app = {};                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.helpers = [];                                      // Helper functions

    // Generate CORS headers

    this.settings.cors = Utils.applyToDefaults(Defaults.cors, this.settings.cors);
    if (this.settings.cors) {
        this.settings.cors._headers = (this.settings.cors.headers || []).concat(this.settings.cors.additionalHeaders || []).join(', ');
        this.settings.cors._methods = (this.settings.cors.methods || []).concat(this.settings.cors.additionalMethods || []).join(', ');
        this.settings.cors._exposedHeaders = (this.settings.cors.exposedHeaders || []).concat(this.settings.cors.additionalExposedHeaders || []).join(', ');
    }

    // Initialize Views

    if (this.settings.views) {
        this._views = new Views(this.settings.views);
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

    // Authentication

    if (this.settings.auth) {
        this._auth.addBatch(this.settings.auth);
    }

    // Server information

    this.info = {
        host: this._host || '0.0.0.0',
        port: this._port || 0,
        protocol: (this.settings.tls ? 'https' : 'http')
    };

    if (this.info.port) {
        this.info.uri = this.info.protocol + '://' + (this._host || Os.hostname() || 'localhost') + ':' + this.info.port;
    }
};

Utils.inherits(internals.Server, Events.EventEmitter);


internals.Server.prototype._dispatch = function (options) {

    var self = this;

    options = options || {};

    return function (req, res) {

        var request = new Request(self, req, res, options);
        request._execute();
    };
};


internals.Server.prototype.routingTable = function () {

    return this._router.routingTable();
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
    this._connections = {};
    this.listener.once('listening', function () {

        // Update the host, port, and uri with active values

        var address = self.listener.address();
        self.info.host = self._host || address.address || '0.0.0.0';
        self.info.port = address.port;
        self.info.uri = self.info.protocol + '://' + (self._host || Os.hostname() || 'localhost')  + ':' + self.info.port;

        return callback();
    });

    this.listener.on('connection', function(connection) {

        var key = connection.remoteAddress + ':' + connection.remotePort;
        self._connections[key] = connection;

        connection.once('close', function() {

            delete self._connections[key];
        });
    });

    this.listener.listen(this._port, this._host);
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

    self._started = false;

    var timeoutId = setTimeout(function () {

        Object.keys(self._connections).forEach(function (key) {

            var connection = self._connections[key];
            return connection && connection.destroy();
        });
    }, options.timeout);

    self.listener.close(function () {
        
        self.listener.removeAllListeners();
        clearTimeout(timeoutId);
        callback();
    });
};


internals.Server.prototype.log = function (tags, data, timestamp) {

    tags = (tags instanceof Array ? tags : [tags]);
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

internals.Server.prototype.route = internals.Server.prototype.addRoute = internals.Server.prototype.addRoutes = function (configs) {

    this._route(configs);
};


internals.Server.prototype._route = function (configs, env) {

    this._router.add(configs, env);
};

internals.Server.prototype.state = internals.Server.prototype.addState = function (name, options) {

    Utils.assert(name && typeof name === 'string', 'Invalid name');
    Utils.assert(!this._stateDefinitions[name], 'State already defined:', name);
    Utils.assert(!options || !options.encoding || ['base64json', 'base64', 'form', 'iron', 'none'].indexOf(options.encoding) !== -1, 'Bad encoding');

    this._stateDefinitions[name] = Utils.applyToDefaults(Defaults.state, options || {});
};


internals.Server.prototype.auth = function (name, options) {

    this._auth.add(name, options);
};


internals.Server.prototype.views = function (options) {

    Utils.assert(!this._views, 'Cannot set server views manager more than once');
    this._views = new Views(options);
};


internals.Server.prototype.inject = function (options, callback) {

    var requestOptions = (options.credentials ? { credentials: options.credentials } : null);
    delete options.credentials;

    var needle = this._dispatch(requestOptions);
    Shot.inject(needle, options, function (res) {

        if (res.raw.res.hapi) {
            res.result = res.raw.res.hapi.result;
            delete res.raw.res.hapi;
        }
        else {
            res.result = res.result || res.payload;
        }

        return callback(res);
    });
};


internals.Server.prototype.helper = internals.Server.prototype.addHelper = function (name, method, options) {

    var self = this;

    Utils.assert(typeof method === 'function', 'method must be a function');
    Utils.assert(typeof name === 'string', 'name must be a string');
    Utils.assert(name.match(/^\w+$/), 'Invalid name:', name);
    Utils.assert(!this.helpers[name], 'Helper function name already exists');
    Utils.assert(!options || typeof options === 'object', 'options must be an object');
    Utils.assert(!options || !options.generateKey || typeof options.generateKey === 'function', 'options.key must be a function');

    var settings = Utils.clone(options || {});
    settings.generateKey = settings.generateKey || internals.generateKey;

    // Create helper

    var cache = null;
    if (settings.cache) {
        Utils.assert(!settings.cache.mode, 'Cache mode not allowed in helper configuration (always server side)');
        cache = this.pack._provisionCache(settings.cache, 'helper', name, settings.cache.segment);
    }

    var helper = function (/* arguments, next */) {

        // Prepare arguments

        var args = arguments;
        var lastArgPos = args.length - 1;
        var helperNext = args[lastArgPos];

        // Wrap method for Cache.Stale interface 'function (next) { next(err, value); }'

        var generateFunc = function (next) {

            args[lastArgPos] = function (result) {

                if (result instanceof Error) {
                    return next(result);
                }

                return next(null, result);
            };

            method.apply(null, args);
        };

        if (!cache) {
            return generateFunc(function (err, result) {

                helperNext(err || result);
            });
        }

        var key = settings.generateKey.apply(null, args);
        if (key === null) {                             // Value can be ''
            self.log(['hapi', 'helper', 'key', 'error'], { name: name, args: args });
        }

        cache.getOrGenerate(key, generateFunc, function (err, value, cached, report) {

            return helperNext(err || value);
        });
    };

    this.helpers[name] = helper;
};


internals.generateKey = function () {

    var key = '';
    for (var i = 0, il = arguments.length - 1; i < il; ++i) {        // 'arguments.length - 1' to skip 'next'
        var arg = arguments[i];
        if (typeof arg !== 'string' &&
            typeof arg !== 'number' &&
            typeof arg !== 'boolean') {

            return null;
        }

        key += (i > 0 ? ':' : '') + encodeURIComponent(arg);
    }

    return key;
};