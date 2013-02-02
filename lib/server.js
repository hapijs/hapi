// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var NodeUtil = require('util');
var Helmet = require('hapi-helmet');
var Log = require('hapi-log');
var Shot = require('shot');
var Auth = require('./auth');
var Batch = require('./batch');
var Catbox = require('catbox');
var Defaults = require('./defaults');
var Err = require('./error');
var Request = require('./request');
var Route = require('./route');
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
    this.settings = Utils.applyToDefaults(Defaults.server, args.options);
    this.settings.host = args.host ? args.host.toLowerCase() : '0.0.0.0';
    this.settings.port = typeof args.port !== 'undefined' ? args.port : (this.settings.tls ? 443 : 80);

    if (this.settings.port) {
        this.settings.nickname = this.settings.host + ':' + this.settings.port;
        this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port;
    }

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

        this._monitor = new Log.Monitor(this);
        Log.event(['info', 'config'], this.settings.nickname + ': Monitoring enabled');
    }

    // Create routing table

    this._routes = {};
    this.routeDefaults = null;
    this.setNotFound({ handler: 'notFound' });

    // Plugin interface (pack)

    this._pack = null;
    this.plugins = {};

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
        this.settings.cors._origin = (this.settings.cors.origin || []).join(' ');
        this.settings.cors._headers = (this.settings.cors.headers || []).concat(this.settings.cors.additionalHeaders || []).join(', ');
        this.settings.cors._methods = (this.settings.cors.methods || []).concat(this.settings.cors.additionalMethods || []).join(', ');

        var optionsConfig = {
            path: '/{p*}',
            method: 'options',
            config: {
                query: true,
                auth: { mode: 'none' },                 // In case defaults are set otherwise
                handler: function (request) {

                    request.reply({});
                }
            }
        };

        this._routes.cors = new Route(optionsConfig, this);
    }

    // Initialize cache engine

    if (this.settings.cache) {
        this.cache = new Catbox.Client(this.settings.cache);
        Log.event(['info', 'config'], this.settings.nickname + ': Caching enabled');
    }
    else {
        this.cache = null;
    }

    // Authentication

    if (this.settings.auth) {
        this.auth = new Auth(this, this.settings.auth);
    }

    // Setup debug endpoint

    if (this.settings.debug) {
        this._debugConsole = new Helmet(this.settings.debug);
        var debugMarkup = this._debugConsole.getMarkup();
        this.addRoute({
            method: 'GET',
            path: this.settings.debug.debugEndpoint,
            config: {
                auth: {
                    mode: 'none'
                },
                handler: function (request) {

                    request.reply(debugMarkup);
                }
            }
        });

        Log.event(['info', 'config'], this.settings.nickname + ': Debug console enabled');
    }

    // Setup batch endpoint

    if (this.settings.batch) {
        this.settings.batch = Utils.applyToDefaults(Defaults.batch, (typeof this.settings.batch === 'boolean' ? {} : this.settings.batch));

        this.addRoute({
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

        request._onRequestExt(self.settings.ext.onRequest, function () {

            // Lookup route

            var method = (request.method === 'head' ? 'get' : request.method);
            var routes = self._routes[method];

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

                return request._execute(self._routes.cors);
            }

            // Not found

            return request._execute(self._routes.notFound);
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
    var routes = this._routes[method];

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

    Object.keys(this._routes).forEach(function (method) {

        if (method !== 'notFound') {
            self._routes[method].forEach(function (route) {

                flattenedRoutes.push(route);
            });
        }
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

        Log.event('info', self.settings.nickname + ': Instance started at ' + self.settings.uri);

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
    Log.event('info', this.settings.nickname + ': Instance stopped at ' + this.settings.uri);
};


// Generate a pack interface

internals.Server.prototype.plugin = function (config, options) {

    Utils.assert(!this._pack || (!config && !options), 'Cannot configure server plugin interface more than once');

    if (this._pack) {
        return this._pack;
    }

    var Pack = require('./pack');           // Delayed required to avoid circular dependencies
    this._pack = new Pack(config, options);
    this._pack.addServer('default', this);
    return this._pack;
};


// Set route defauts

internals.Server.prototype.setRoutesDefaults = function (config) {

    Utils.assert(!config.handler, 'Defaults cannot include a handler');
    this.routeDefaults = config;
};


// Set notFound route for the server

internals.Server.prototype.setNotFound = function (routeConfig) {

    Utils.assert(routeConfig && routeConfig.handler, 'routeConfig must exist and provide a handler');

    this._routes.notFound = new Route({ method: 'notFound', path: '/{p*}', config: routeConfig }, this);
};


// Add server route

internals.Server.prototype.addRoute = function (options) {

    // Add route

    var route = new Route(options, this);                               // Do no use options beyond this point, use route members

    this._routes[route.method] = this._routes[route.method] || [];

    // Check for existing route with same fingerprint

    var routes = this._routes[route.method];

    for (var ri = 0, rl = routes.length; ri < rl; ++ri) {
        Utils.assert(route.fingerprint !== routes[ri].fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + routes[ri].path);
    }

    routes.push(route);
    routes.sort(Route.sort);
};


internals.Server.prototype.addRoutes = function (routes) {

    Utils.assert(routes, 'Routes parameter must exist');

    for (var i = 0, il = routes.length; i < il; ++i) {
        this.addRoute(routes[i]);
    }
};


internals.Server.prototype.addState = function (name, options) {

    Utils.assert(name && typeof name === 'string', 'Invalid name');
    Utils.assert(!options || !options.encoding || ['base64json', 'base64', 'form', 'none'].indexOf(options.encoding) !== -1, 'Bad encoding');

    this._stateDefinitions[name] = Utils.applyToDefaults(Defaults.state, options);
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


internals.Server.prototype.addHelper = function (name, method, options) {

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

        return Log.event(tags, data);
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