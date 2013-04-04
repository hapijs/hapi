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
        Utils.assert(key, 'Bad server constructor arguments: no match for arg type ' + type);
        Utils.assert(!args[key], 'Bad server constructor arguments: duplicated arg type: ' + type);
        args[key] = arguments[a];
    }

    this.settings = Utils.applyToDefaults(Defaults.server, args.options || {});
    Schema.server(this.settings, function (err) {

        Utils.assert(!err, 'Invalid server options: ' + err);
    });

    // Set basic configuration

    this.settings.host = args.host ? args.host.toLowerCase() : '0.0.0.0';
    this.settings.port = typeof args.port !== 'undefined' ? args.port : (this.settings.tls ? 443 : 80);
    if (this.settings.port) {
        this.settings.nickname = this.settings.host + ':' + this.settings.port;
        this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port;
    }

    Utils.assert(this.settings.timeout.server === null || this.settings.timeout.socket === null || this.settings.timeout.server < this.settings.timeout.socket, 'Server timeout must be shorter than socket timeout');
    Utils.assert(this.settings.timeout.client === null || this.settings.timeout.socket === null || this.settings.timeout.client < this.settings.timeout.socket, 'Client timeout must be shorter than socket timeout');

    // Server facilities

    this._started = false;
    this._auth = new Auth(this);                            // Required before _router
    this._router = new Router(this);
    this._ext = new Ext();
    this._stateDefinitions = {};

    if (args.pack) {
        this.plugin = args.pack;
    }
    else {
        this.plugin = new Pack({ cache: this.settings.cache });
        this.plugin._server(this);
    }

    this.plugins = {};                                      // Registered plugin APIs by plugin name
    this.app = {};                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.helpers = [];                                      // Helper functions

    // Generate CORS headers

    this.settings.cors = Utils.applyToDefaults(Defaults.cors, this.settings.cors);
    if (this.settings.cors) {
        this.settings.cors._headers = (this.settings.cors.headers || []).concat(this.settings.cors.additionalHeaders || []).join(', ');
        this.settings.cors._methods = (this.settings.cors.methods || []).concat(this.settings.cors.additionalMethods || []).join(', ');
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

    // Authentication

    if (this.settings.auth) {
        this._auth.addBatch(this.settings.auth);
    }

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

    this.plugin.start(callback);
};


internals.Server.prototype._start = function (callback) {

    var self = this;

    callback = callback || function () { };

    if (this._started) {
        return callback();
    }

    this._started = true;
    this.listener.once('listening', function () {

        var address = self.listener.address();                          // Update the port and uri with what was actually bound
        self.settings.port = address.port;
        self.settings.host = self.settings.host || address.address;
        self.settings.nickname = self.settings.host + ':' + self.settings.port;
        self.settings.uri = (self.settings.tls ? 'https://' : 'http://') + self.settings.host + ':' + self.settings.port;

        return callback();
    });

    this.listener.listen(this.settings.port, this.settings.host);
};


// Stop server

internals.Server.prototype.stop = function (options, callback) {

    this.plugin.stop(options, callback);
};


internals.Server.prototype._stop = function (options, callback) {

    var self = this;

    options = options || {};
    callback = callback || function () { };

    if (!this._started) {
        return callback();
    }

    self.listener.close(function () {

        self._started = false;
        callback();
    });
};


internals.Server.prototype._log = function (tags, data, timestamp) {

    this.log(['hapi'].concat(tags), data, timestamp);
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
    Utils.assert(!this._stateDefinitions[name], 'State already defined: ' + name);
    Utils.assert(!options || !options.encoding || ['base64json', 'base64', 'form', 'iron', 'none'].indexOf(options.encoding) !== -1, 'Bad encoding');

    this._stateDefinitions[name] = Utils.applyToDefaults(Defaults.state, options || {});
};


internals.Server.prototype.auth = function (name, options) {

    this._auth.add(name, options);
};


internals.Server.prototype.inject = function (options, callback) {

    var requestOptions = (options.credentials ? { credentials: options.credentials } : null);
    delete options.credentials;

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

    var cache = null;
    if (settings.cache) {
        Utils.assert(!settings.cache.mode, 'Cache mode not allowed in helper configuration (always server side)');
        cache = this.plugin._provisionCache(settings.cache, 'helper', name, settings.cache.segment);
    }

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

        if (!cache) {
            return generateFunc(function (err, result) {

                next(err || result);
            });
        }

        var key = settings.generateKey(args);
        if (key === null) {                             // Value can be ''
            self._log(['helper', 'key', 'error'], { name: name, args: args });
        }

        cache.getOrGenerate(key, generateFunc, function (err, value, cached, report) {

            return next(err || value);
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