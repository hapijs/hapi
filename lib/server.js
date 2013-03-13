// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
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

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Validate arguments

    Utils.assert(arguments.length <= 3, 'Too many arguments');

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
        var type = typeof arguments[a];
        var key = argMap[type];
        Utils.assert(key, 'Bad server constructor arguments: no match for arg type ' + type);
        Utils.assert(!args[key], 'Bad server constructor arguments: duplicated arg type: ' + type);
        args[key] = arguments[a];
    }

    // Set basic configuration

    this._started = false;
    this.settings = Utils.applyToDefaults(Defaults.server, args.options || {});

    Schema.server(this.settings, function (err) {

        Utils.assert(!err, 'Invalid server options: ' + err);
    });

    this.settings.host = args.host ? args.host.toLowerCase() : '0.0.0.0';
    this.settings.port = typeof args.port !== 'undefined' ? args.port : (this.settings.tls ? 443 : 80);

    if (this.settings.port) {
        this.settings.nickname = this.settings.host + ':' + this.settings.port;
        this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port;
    }

    Utils.assert(this.settings.timeout.server === null || this.settings.timeout.socket === null || this.settings.timeout.server < this.settings.timeout.socket, 'Server timeout must be shorter than socket timeout');
    Utils.assert(this.settings.timeout.client === null || this.settings.timeout.socket === null || this.settings.timeout.client < this.settings.timeout.socket, 'Client timeout must be shorter than socket timeout');

    // Extensions

    this._ext = new Ext();

    // Set optional configuration
    // false -> null, true -> defaults, {} -> override defaults

    this.settings.cors = Utils.applyToDefaults(Defaults.cors, this.settings.cors);

    // Create routing table

    Utils.assert(!this.settings.router.routeDefaults || !this.settings.router.routeDefaults.handler, 'Route defaults cannot include a handler');

    this._router = new Router(this);

    // Plugin interface (pack)

    this._pack = null;
    this.plugins = {};                              // Registered plugin APIs by plugin name
    this.app = {};                                  // Place for application-specific state without conflicts with hapi, should not be used by plugins

    // Initialize Views

    if (this.settings.views) {
        this.views = new Views(this.settings.views);
    }

    // Create server

    if (this.settings.tls) {
        this.listener = Https.createServer(this.settings.tls, this._dispatch());
    }
    else {
        this.listener = Http.createServer(this._dispatch());
    }

    // Helpers registry

    this.helpers = [];

    // State management

    this._stateDefinitions = {};

    // Generate CORS headers

    if (this.settings.cors) {
        this.settings.cors._headers = (this.settings.cors.headers || []).concat(this.settings.cors.additionalHeaders || []).join(', ');
        this.settings.cors._methods = (this.settings.cors.methods || []).concat(this.settings.cors.additionalMethods || []).join(', ');
    }

    // Initialize cache engine

    if (this.settings.cache) {
        this.settings.cache.logFunc = this.settings.cache.logFunc || this.log;
        this.cache = new Catbox.Client(this.settings.cache);
    }

    // Authentication

    if (this.settings.auth) {
        this.auth = new Auth(this, this.settings.auth);
    }

    this.__defineGetter__('plugin', this._plugin);

    return this;
};

Utils.inherits(internals.Server, Events.EventEmitter);


internals.Server.prototype._dispatch = function (options) {

    var self = this;

    return function (req, res) {

        // Create request object

        var request = new Request(self, req, res, options);
        if (req.socket &&
            self.settings.timeout.socket !== null) {

            req.socket.setTimeout(self.settings.timeout.socket);
        }

        // Execute onRequest extensions (can change request method and url)

        request._onRequestExt(function (err) {

            if (err) {
                return;         // Handled by the request
            }

            // Lookup route

            request._execute(self._router.route(request));
        });
    };
};


internals.Server.prototype.routingTable = function () {

    return this._router.routingTable();
};


// Start server listener

internals.Server.prototype.start = function (callback) {

    var self = this;

    callback = callback || function () { };

    if (this._started) {
        return callback();
    }

    this._started = true;
    this.listener.once('listening', function () {

        // update the port and uri with what was actually bound
        var address = self.listener.address();
        self.settings.port = address.port;
        self.settings.host = self.settings.host || address.address;
        self.settings.nickname = self.settings.host + ':' + self.settings.port;
        self.settings.uri = (self.settings.tls ? 'https://' : 'http://') + self.settings.host + ':' + self.settings.port;

        if (self.cache) {
            return self.cache.start(callback);
        }

        return callback();
    });

    this.listener.listen(this.settings.port, this.settings.host);
};


// Stop server

internals.Server.prototype.stop = function (callback) {

    var self = this;

    callback = callback || function () { };

    if (!this._started) {
        return callback();
    }

    this.listener.maxConnections = 0;                           // Stop accepting new connections

    var checkConnections = function () {

        process.nextTick(function () {

            if (self.listener.connections > 0) {
                return checkConnections();
            }

            self.listener.close();
            self._started = false;

            return callback();
        });
    };

    checkConnections();
};


internals.Server.prototype.log = function (tags, data, timestamp) {

    tags = (tags instanceof Array ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp : new Date(timestamp)) : new Date());

    var event = {
        timestamp: now.getTime(),
        tags: tags,
        data: data
    };

    this.emit('log', event, Utils.mapToObject(event.tags));
};


// Generate a pack interface

internals.Server.prototype._plugin = function () {

    if (this._pack) {
        return this._pack;
    }

    var Pack = require('./pack');           // Delayed required to avoid circular dependencies
    this._pack = new Pack();
    this._pack.server(this.settings.pack.name, this, this.settings.pack);
    this._pack.list = {};
    return this._pack;
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
    Utils.assert(!options || !options.encoding || ['base64json', 'base64', 'form', 'iron', 'none'].indexOf(options.encoding) !== -1, 'Bad encoding');

    this._stateDefinitions[name] = Utils.applyToDefaults(Defaults.state, options || {});
};


internals.Server.prototype.inject = function (options, callback) {

    var requestOptions = (options.session ? { session: options.session } : null);
    delete options.session;

    var onEnd = function (res) {

        if (res.raw.res.hapi) {
            res.result = res.raw.res.hapi.result;
            delete res.raw.res.hapi;
        }
        else {
            res.result = res.result || res.payload;
        }

        callback(res);
    };

    var needle = this._dispatch(requestOptions);
    Shot.inject(needle, options, onEnd);
};


internals.Server.prototype.helper = internals.Server.prototype.addHelper = function (name, method, options) {

    var self = this;

    Utils.assert(typeof method === 'function', 'method must be a function');
    Utils.assert(typeof name === 'string', 'name must be a string');
    Utils.assert(name.match(/^\w+$/), 'Invalid name: ' + name);
    Utils.assert(!this.helpers[name], 'Helper function name already exists');
    Utils.assert(!options || typeof options === 'object', 'options must be an object');
    Utils.assert(!options || !options.generateKey || typeof options.generateKey === 'function', 'options.key must be a function');

    var settings = Utils.clone(options || {});
    settings.generateKey = settings.generateKey || internals.generateKey;

    // Create helper

    if (settings.cache) {
        settings.cache.segment = settings.cache.segment || '#' + name;
    }

    var cache = new Catbox.Policy(settings.cache, this.cache);

    var log = function (tags, data) {

        return self.log(tags, data);
    };

    var helper = function (/* arguments, next */) {

        // Prepare arguments

        var args = arguments;
        var lastArgPos = args.length - 1;
        var next = args[lastArgPos];

        // Wrap method for Cache.Stale interface 'function (callback) { callback(err, value); }'

        var generateFunc = function (callback) {

            args[lastArgPos] = function (result) {

                if (result instanceof Error) {
                    return callback(result);
                }

                return callback(null, result);
            };

            method.apply(null, args);
        };

        var key = (cache.isEnabled() ? settings.generateKey(args) : null);
        if (cache.isEnabled() &&
            key === null) {                             // Value can be ''

            log(['helper', 'key', 'error'], { name: name, args: args });
        }

        cache.getOrGenerate(key, log, generateFunc, function (response, cached) {

            return next(response);
        });
    };

    this.helpers[name] = helper;
};


internals.generateKey = function (args) {

    var key = '';
    for (var i = 0, il = args.length - 1; i < il; ++i) {        // 'args.length - 1' to skip 'next'
        var arg = args[i];
        if (typeof arg !== 'string' &&
            typeof arg !== 'number' &&
            typeof arg !== 'boolean') {

            return null;
        }

        key += (i > 0 ? ':' : '') + encodeURIComponent(arg);
    }

    return key;
};