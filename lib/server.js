// Load modules

var Fs = require('fs');
var Http = require('http');
var Https = require('https');
var NodeUtil = require('util');
var Events = require('events');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Process = require('./process');
var Defaults = require('./defaults');
var Monitor = require('./monitor');
var Session = require('./session');
var Cache = require('./cache');
var Request = require('./request');
var Route = require('./route');
var Debug = require('./debug');


// Declare internals

var internals = {

    servers: {}             // Servers instances by uri or name
};


// Create and configure server instance

exports.Server = Server = function (host, port, options, routes) {

    var self = this;

    Utils.assert(this.constructor === Server, 'Server must be instantiated using new');

    // Register as event emitter
    Events.EventEmitter.call(this);

    // Set basic configuration

    this.settings = Utils.applyToDefaults(Defaults.server, options);
    this.settings.host = host.toLowerCase();
    this.settings.port = port;
    this.settings.name = (this.settings.name ? this.settings.name.toLowerCase() : (this.settings.host + ':' + this.settings.port));
    this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port + '/';

    // Initialize authentication configuration and validate

    if (this.settings.authentication) {

        this.settings.authentication = Utils.applyToDefaults(Defaults.authentication, this.settings.authentication);

        Utils.assert(this.settings.authentication.tokenEndpoint &&
                     this.settings.authentication.loadClientFunc &&
                     this.settings.authentication.loadUserFunc &&
                     this.settings.authentication.checkAuthorizationFunc &&
                     this.settings.authentication.aes256Keys.oauthRefresh &&
                     this.settings.authentication.aes256Keys.oauthToken, 'Invalid authentication configuration');
    }

    // Verify no existing instances using the same uri or name
    Utils.assert(!internals.servers[this.settings.name], 'Cannot configure multiple server instances using the same name or uri');

    // Add to instance list
    internals.servers[this.settings.name] = this;

    // Initialize cache engine

    if (this.settings.cache) {

        if (this.settings.cache.implementation) {

            this.cache = this.settings.cache.implementation;
            this.settings.cache.implementation = null;
        }
        else {

            this.settings.cache = Utils.applyToDefaults(Defaults.cache, this.settings.cache);

            this.cache = new Cache.Client(this.settings.cache.options);
            this.cache.on('ready', function (err) {
                Utils.assert(!err, 'Failed to initialize cache engine: ' + err);
            });
        }
    }
    else {
        this.cache = null;
    }

    // Create routing table
    this.routes = {};

    // Create server

    if (this.settings.tls) {

        var tls = {

            key: Fs.readFileSync(this.settings.tls.key),
            cert: Fs.readFileSync(this.settings.tls.cert)
        };

        this.listener = Https.createServer(tls, this.dispatch());
    }
    else {
        this.listener = Http.createServer(this.dispatch());
    }

    // Initialize monitoring if set
    this.monitor = new Monitor(this, this.settings);

    // Setup OAuth token endpoint

    if (this.settings.authentication) {

        this.addRoute({

            method: 'POST',
            path: this.settings.authentication.tokenEndpoint,
            config: Session.token
        });
    }

    // Setup debug endpoint

    if (this.settings.debug) {

        this.settings.debug = Utils.applyToDefaults(Defaults.debug, (typeof this.settings.debug === 'boolean' ? {} : this.settings.debug));

        this.addRoute({ 

            method: 'GET',
            path: this.settings.debug.debugEndpoint,
            config: Debug.console
        });
    }

    // Add routes

    if (routes) {
        this.addRoutes(routes);
    }

    return this;
};

NodeUtil.inherits(Server, Events.EventEmitter);


Server.prototype.dispatch = function () {

    var self = this;

    return function (req, res) {

        // Create request object

        var request = new Request(self, req, res);

        // Execute onRequest extensions (can change request method, url, etc.)

        Utils.executeRequestHandlers(self.settings.ext.onRequest, request, function () {

            // Lookup route

            var method = (request.method === 'head' ? 'get' : request.method);
            var routes = self.routes[method];
            if (routes) {

                for (var i = 0, il = routes.length; i < il; ++i) {

                    var route = routes[i];
                    if (route.match(request)) {

                        return route.execute(request);
                    }
                }

                return self.unhandledRoute(request);
            }
            else {
                return self.unhandledRoute(request);
            }
        });
    };
};


// 404 Route handler

Server.prototype.unhandledRoute = function (request) {

    var self = this;

    if (this.settings.ext.onUnknownRoute) {

        Utils.assert(!(this.settings.ext.onUnknownRoute instanceof Array), 'ext.onUnknownRoute cannot be an array');

        this.settings.ext.onUnknownRoute(request, function () {
            request.log(['http', 'response', 'ext']);
            self.emit('response', request);
        });
    }
    else {

        var error = Err.notFound('No such path or method');
        this.respond(request, error.code, { error: error.text, message: error.message, code: error.code });
        request.log(['http', 'response', 'error'], error);
        this.emit('response', request);
    }
};


// Start server listener

Server.prototype.start = function () {

    this.listener.listen(this.settings.port, this.settings.host);

    if (this.settings.debug) {
        Debug.initialize(this.settings.host, this.settings.debug.websocketPort);
    }

    Log.info('Server instance started at ' + this.settings.uri);
};


// Stop server

Server.prototype.stop = function () {

    this.listener.close();
    Log.info('Server instance stopped at ' + this.settings.uri);
};


// Set route defauts

Server.prototype.setRoutesDefaults = function (config) {

    Utils.assert(!config.handler, 'Defaults cannot include a handler');
    this.routeDefaults = config;
};


// Add server route

Server.prototype.addRoute = function (options) {

    // Normalize option stucture

    var routeOptions = Utils.clone(options);        // Options can be reused
    routeOptions.config = routeOptions.config || {};
    Utils.assert(!!routeOptions.handler ^ !!routeOptions.config.handler, 'Handler must appear once and only once: ' + options.path);     // XOR
    routeOptions.config.handler = routeOptions.config.handler || routeOptions.handler;

    // Apply defaults
    routeOptions.config = Utils.applyToDefaults(this.routeDefaults, routeOptions.config)

    // Add route

    var route = new Route(routeOptions, this);

    this.routes[route.method] = this.routes[route.method] || [];
    this.routes[route.method].push(route);

    // Setup CORS 'OPTIONS' handler

    if (route.config.cors !== false) {

        var optionsConfig = {

            path: route.path,
            method: 'options',
            config: {

                _skipValidation: true,
                auth: {

                    mode: 'none'
                },
                handler: function (request) { request.reply({}); }
            }
        };

        this.routes.options = this.routes.options || [];
        this.routes.options.push(new Route(optionsConfig, this));
    }
};


Server.prototype.addRoutes = function (routes) {

    for (var i = 0, il = routes.length; i < il; ++i) {

        this.addRoute(routes[i]);
    }
};


// Format and send HTTP response

Server.prototype.respond = function (request, code, payload, headers) {

    headers = headers || {};
    var data = null;

    if (payload) {

        if (typeof payload === 'object') {

            // Object

            headers['Content-Type'] = 'application/json';
            data = JSON.stringify(payload);
        }
        else {

            // String

            headers['Content-Type'] = 'text/html';
            data = payload;
        }

        headers['Content-Length'] = Buffer.byteLength(data);
    }

    request.raw.res.writeHeader(code, headers);
    request.raw.res.end(request.method !== 'head' ? data : '');
};


// Return server object

exports.instance = function (name) {

    if (name) {

        name = name.toLowerCase();

        var server = internals.servers[name];
        if (server) {
            return server;
        }
        else {
            return null;
        }
    }
    else {

        var names = Object.keys(internals.servers);
        if (names.length === 1) {

            return internals.servers[names[0]];
        }
        else if (names.length === 0) {
            return null;
        }
        else {
            Utils.abort('Cannot call Server.instance() without uri in a process with multiple server instances');
        }
    }
};


// Return server object configuration

exports.settings = function (name) {

    var server = exports.instance(name);
    if (server) {
        return server.settings;
    }
    else {
        return null;
    }
};


// Add routes to multiple instances

exports.addRoutes = function (arg0, arg1) { // [defaultInstances,] routes

    // Handle optional arguments

    var args = Array.prototype.slice.call(arguments); // Convert arguments to instanceof Array
    var defaultInstances = (args.length === 2 ? (args[0] instanceof Array ? args[0] : [args[0]]) : null);
    var routes = (args.length === 2 ? args[1] : args[0]);

    // Process each route

    routes = (routes instanceof Array ? routes : [routes]);
    for (var i = 0, il = routes.length; i < il; ++i) {

        var route = routes[i];
        if (route.instance || defaultInstances) {

            // Select instances

            var instances = (route.instance ? (route.instance instanceof Array ? route.instance : [route.instance]) : defaultInstances);
            for (var r = 0, rl = instances.length; r < rl; ++r) {

                var server = internals.servers[instances[r].toLowerCase()];
                Utils.assert(server, 'Cannot find server instance: ' + instances[r]);
                server.addRoute(route);
            }
        }
        else {

            // All instances

            for (var s in internals.servers) {

                if (internals.servers.hasOwnProperty(s)) {
                    internals.servers[s].addRoute(route);
                }
            }
        }
    }
};