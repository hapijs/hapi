// Load modules

var Fs = require('fs');
var Http = require('http');
var Https = require('https');
var NodeUtil = require('util');
var Events = require('events');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Defaults = require('./defaults');
var Monitor = require('./monitor');
var Session = require('./session');
var Cache = require('./cache');
var Request = require('./request');
var Route = require('./route');
var Debug = require('./debug');


// Declare internals

var internals = {};


// Create and configure server instance

module.exports = internals.Server = function (host, port, options) {

    var self = this;

    Utils.assert(this.constructor === internals.Server, 'Server must be instantiated using new');

    // Register as event emitter
    Events.EventEmitter.call(this);

    // Set basic configuration

    this.settings = Utils.applyToDefaults(Defaults.server, options);
    this.settings.host = host.toLowerCase();
    this.settings.port = port;
    this.settings.name = (this.settings.name ? this.settings.name.toLowerCase() : (this.settings.host + ':' + this.settings.port));
    this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port + '/';

    // Set optional configuration
    // false -> null, true -> defaults, {} -> override defaults

    this.settings.monitor = Utils.applyToDefaults(Defaults.monitor, this.settings.monitor);
    this.settings.authentication = Utils.applyToDefaults(Defaults.authentication, this.settings.authentication);
    this.settings.cache = Utils.applyToDefaults(Defaults.cache, this.settings.cache);
    this.settings.debug = Utils.applyToDefaults(Defaults.debug, this.settings.debug);

    // Create routing table

    this.routes = {};
    this.routeDefaults = null;

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

    // Initialize process monitoring

    if (this.settings.monitor) {

        this._monitor = new Monitor(this, this.settings.monitor);
        Log.event(['info', 'config'], 'Monitoring enabled');
    }

    // Setup authentication

    if (this.settings.authentication) {

        Utils.assert(this.settings.authentication.tokenEndpoint &&
                     this.settings.authentication.loadClientFunc &&
                     this.settings.authentication.loadUserFunc &&
                     this.settings.authentication.checkAuthorizationFunc &&
                     this.settings.authentication.aes256Keys.oauthRefresh &&
                     this.settings.authentication.aes256Keys.oauthToken, 'Invalid authentication configuration');

        this.addRoute({

            method: 'POST',
            path: this.settings.authentication.tokenEndpoint,
            config: Session.token
        });

        Log.event(['info', 'config'], 'Authentication enabled');
    }

    // Initialize cache engine

    if (this.settings.cache) {

        this.cache = new Cache.Client(this.settings.cache);
        this.cache.on('ready', function (err) {
            Utils.assert(!err, 'Failed to initialize cache engine: ' + err);
        });

        Log.event(['info', 'config'], 'Caching enabled');
    }
    else {
        this.cache = null;
    }

    // Setup debug endpoint

    if (this.settings.debug) {

        this.addRoute({ 

            method: 'GET',
            path: this.settings.debug.debugEndpoint,
            config: Debug.console
        });

        Log.event(['info', 'config'], 'Debug console enabled');
    }

    return this;
};

NodeUtil.inherits(internals.Server, Events.EventEmitter);


internals.Server.prototype.dispatch = function () {

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

internals.Server.prototype.unhandledRoute = function (request) {

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
        Route.respond(request, error.code, { error: error.text, message: error.message, code: error.code });
        request.log(['http', 'response', 'error'], error);
        this.emit('response', request);
    }
};


// Start server listener

internals.Server.prototype.start = function () {

    this.listener.listen(this.settings.port, this.settings.host);

    if (this.settings.debug) {
        Debug.initialize(this.settings.host, this.settings.debug.websocketPort);
    }

    Log.event('info', 'Server instance started at ' + this.settings.uri);
};


// Stop server

internals.Server.prototype.stop = function () {

    this.listener.close();
    Log.event('info', 'Server instance stopped at ' + this.settings.uri);
};


// Set route defauts

internals.Server.prototype.setRoutesDefaults = function (config) {

    Utils.assert(!config.handler, 'Defaults cannot include a handler');
    this.routeDefaults = config;
};


// Add server route

internals.Server.prototype.addRoute = function (options) {

    // Add route

    var route = new Route(options, this);                               // Do no use options beyond this point, use route members

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


internals.Server.prototype.addRoutes = function (routes) {

    for (var i = 0, il = routes.length; i < il; ++i) {
        this.addRoute(routes[i]);
    }
};


