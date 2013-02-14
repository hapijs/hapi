// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var NodeUtil = require('util');
var Tv = require('tv');
var Good = require('good');
var Shot = require('shot');
var Auth = require('./auth');
var Batch = require('./batch');
var Catbox = require('catbox');
var Defaults = require('./defaults');
var Boom = require('boom');
var Request = require('./request');
var Route = require('./route');
var Schema = require('./schema');
var Views = require('./views');
var Utils = require('./utils');
// Pack delayed required inline


// Declare internals

var internals = {};


// Create and configure server instance

module.exports = internals.Server = function (/* host, port, options */) {        // all optional

    var self = this;

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
        var type = typeof arguments[a];
        var key = argMap[type];
        Utils.assert(key, 'Bad server constructor arguments: no match for arg type ' + type);
        Utils.assert(!args[key], 'Bad server constructor arguments: duplicated arg type: ' + type);
        args[key] = arguments[a];
    }

    // Set basic configuration

    this._started = false;
    this.settings = Utils.applyToDefaults(Defaults.server, args.options || {});

    if (this.settings.strict) {
        Schema.server(this.settings, function (err) {

            Utils.assert(!err, 'Invalid server options: ' + err);
        });
    }

    this.settings.host = args.host ? args.host.toLowerCase() : '0.0.0.0';
    this.settings.port = typeof args.port !== 'undefined' ? args.port : (this.settings.tls ? 443 : 80);

    if (this.settings.port) {
        this.settings.nickname = this.settings.host + ':' + this.settings.port;
        this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port;
    }

    // Extensions

    this._ext = {

        // The following extension functions use the following signature:
        // function (request, next) { next(); }

        onRequest: null,                            // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreHandler: null,                         // After validation and body parsing, before route handler
        onPostHandler: null                         // After route handler returns, before sending response
    };

    // Set optional configuration
    // false -> null, true -> defaults, {} -> override defaults

    this.settings.cors = Utils.applyToDefaults(Defaults.cors, this.settings.cors);
    this.settings.monitor = Utils.applyToDefaults(Defaults.monitor, this.settings.monitor);
    this.settings.debug = Utils.applyToDefaults(Defaults.debug, this.settings.debug);
    this.settings.docs = Utils.applyToDefaults(Defaults.docs, this.settings.docs);

    // Initialize process monitoring

    if (this.settings.monitor) {
        if (!this.settings.monitor.subscribers) {
            this.settings.monitor.subscribers = {
                console: ['ops', 'request', 'log']
            };
        }

        this._monitor = new Good.Monitor(this);
    }

    // Create routing table

    Utils.assert(!this.settings.router.routeDefaults || !this.settings.router.routeDefaults.handler, 'Route defaults cannot include a handler');

    this._router = {
        table: {}                                   // Array per HTTP method, including * for catch-all
    };

    this._router.notfound = new Route({
        method: 'notfound',
        path: '/{p*}',
        config: {
            auth: { mode: 'none' },                 // In case defaults are set otherwise
            handler: 'notFound'
        }
    }, this);

    // Plugin interface (pack)

    this._pack = null;
    this.plugins = {};                              // Registered plugin APIs by plugin name
    this.plugin.list = {};                          // Loaded plugins by plugin name
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

        var optionsConfig = {
            path: '/{p*}',
            method: 'options',
            config: {
                auth: { mode: 'none' },                 // In case defaults are set otherwise
                handler: function (request) {

                    request.reply({});
                }
            }
        };

        this._router.cors = new Route(optionsConfig, this);
    }

    // Initialize cache engine

    if (this.settings.cache) {
        this.cache = new Catbox.Client(this.settings.cache);
    }

    // Authentication

    if (this.settings.auth) {
        this.auth = new Auth(this, this.settings.auth);
    }

    // Setup debug endpoint

    if (this.settings.debug) {
        this._debugConsole = new Tv(this.settings.debug);
        var debugMarkup = this._debugConsole.getMarkup();
        this.route({
            method: 'GET',
            path: this.settings.debug.debugEndpoint,
            config: {
                auth: { mode: 'none' },                 // In case defaults are set otherwise
                handler: function (request) {

                    request.reply(debugMarkup);
                }
            }
        });
    }

    // Setup batch endpoint

    if (this.settings.batch) {
        this.settings.batch = Utils.applyToDefaults(Defaults.batch, (typeof this.settings.batch === 'boolean' ? {} : this.settings.batch));

        this.route({
            method: 'POST',
            path: this.settings.batch.batchEndpoint,
            config: Batch.config
        });
    }

    return this;
};

NodeUtil.inherits(internals.Server, Events.EventEmitter);


internals.Server.prototype._dispatch = function (options) {

    var self = this;

    return function (req, res) {

        // Create request object

        var request = new Request(self, req, res, options);

        // Execute onRequest extensions (can change request method and url)

        request._onRequestExt(function (err) {

            if (err) {
                return;         // Handled by the request
            }

            // Lookup route

            var method = (request.method === 'head' ? 'get' : request.method);

            var routes = self._router.table[method];
            if (routes) {
                for (var i = 0, il = routes.length; i < il; ++i) {
                    var route = routes[i];
                    if (route.match(request)) {
                        return request._execute(route);
                    }
                }
            }

            // CORS

            if (method === 'options' &&
                self.settings.cors) {

                return request._execute(self._router.cors);
            }

            // *

            routes = self._router.table['*'];
            if (routes) {
                for (i = 0, il = routes.length; i < il; ++i) {
                    var route = routes[i];
                    if (route.match(request)) {
                        return request._execute(route);
                    }
                }
            }

            // Not found

            return request._execute(self._router.notfound);
        });
    };
};


// Find a route match

internals.Server.prototype._match = function (method, path) {

    Utils.assert(method, 'The method parameter must be provided');
    Utils.assert(path, 'The path parameter must be provided');

    // Lookup route

    method = method.toLowerCase();
    method = (method === 'head' ? 'get' : method);
    var routes = this._router.table[method];

    if (routes) {
        for (var i = 0, il = routes.length; i < il; ++i) {
            var route = routes[i];
            if (route.test(path)) {
                return route;
            }
        }
    }

    return null;
};


internals.Server.prototype._routeTable = function () {

    var self = this;

    var flattenedRoutes = [];

    Object.keys(this._router.table).forEach(function (method) {

        self._router.table[method].forEach(function (route) {

            flattenedRoutes.push(route);
        });
    });

    return flattenedRoutes;
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

        return callback();
    });

    this.listener.listen(this.settings.port, this.settings.host);
};


// Stop server

internals.Server.prototype.stop = function () {

    if (!this._started) {
        return;
    }
    this.listener.close();
    this._started = false;
};


// Generate a pack interface

internals.Server.prototype.plugin = function (name, config, options) {

    Utils.assert(!this._pack || (!config && !options), 'Cannot configure server plugin interface more than once');

    if (this._pack) {
        return this._pack;
    }

    var Pack = require('./pack');           // Delayed required to avoid circular dependencies
    this._pack = new Pack(config);
    this._pack.server(name || 'default', this, options);
    return this._pack;
};


// Register an extension function

internals.Server.prototype.ext = function (event, func) {

    Utils.assert(['onRequest', 'onPreHandler', 'onPostHandler'].indexOf(event) !== -1, 'Unknown event type: ' + event);
    this._ext[event] = (this._ext[event] || []).concat(func);
};


// Add server route

internals.Server.prototype.route = internals.Server.prototype.addRoute = internals.Server.prototype.addRoutes = function (configs) {

    var self = this;

    Utils.assert(configs, 'Routes configs must exist');

    configs = (configs instanceof Array ? configs : [configs]);

    var methods = {};
    configs.forEach(function (config) {

        var route = new Route(config, self);                               // Do no use config beyond this point, use route members

        self._router.table[route.method] = self._router.table[route.method] || [];

        // Check for existing route with same fingerprint

        methods[route.method] = true;
        var routes = self._router.table[route.method];
        for (var ri = 0, rl = routes.length; ri < rl; ++ri) {
            Utils.assert(route.fingerprint !== routes[ri].fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + routes[ri].path);
        }

        routes.push(route);
    });

    Object.keys(methods).forEach(function (method) {

        self._router.table[method].sort(Route.sort);
    });
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

        callback(res);
    };

    var needle = this._dispatch(requestOptions);
    Shot.inject(needle, options, onEnd);
};


internals.Server.prototype.helper = internals.Server.prototype.addHelper = function (name, method, options) {

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

        return Good.event(tags, data);
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