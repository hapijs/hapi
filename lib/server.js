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
    this.settings.uri = (this.settings.tls ? 'https://' : 'http://') + this.settings.host + ':' + this.settings.port;

    // Set optional configuration
    // false -> null, true -> defaults, {} -> override defaults

    this.settings.monitor = Utils.applyToDefaults(Defaults.monitor, this.settings.monitor);
    this.settings.authentication = Utils.applyToDefaults(Defaults.authentication, this.settings.authentication);
    this.settings.cache = Utils.applyToDefaults(Defaults.cache, this.settings.cache);
    this.settings.debug = Utils.applyToDefaults(Defaults.debug, this.settings.debug);

    // Validate configuration

    Utils.assert(!this.settings.ext.onUnknownRoute || !(this.settings.ext.onUnknownRoute instanceof Array), 'ext.onUnknownRoute cannot be an array');

    // Initialize process monitoring

    if (this.settings.monitor) {
        this._monitor = new Monitor(this);
        Log.event(['info', 'config'], this.settings.name + ': Monitoring enabled');
    }

    // Generate CORS headers

    if (this.settings.cors) {

        this.settings.cors._origin = (this.settings.cors.origin || []).join(' ');
        this.settings.cors._headers = (this.settings.cors.headers || []).concat(this.settings.cors.additionalHeaders || []).join(', ');
        this.settings.cors._methods = (this.settings.cors.methods || []).concat(this.settings.cors.additionalMethods || []).join(', ');
    }

    // Create routing table

    this._routes = {};
    this.routeDefaults = null;

    // Create server

    if (this.settings.tls) {
        var tls = {
            key: Fs.readFileSync(this.settings.tls.key),
            cert: Fs.readFileSync(this.settings.tls.cert)
        };

        this.listener = Https.createServer(tls, this._dispatch());
    }
    else {
        this.listener = Http.createServer(this._dispatch());
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

        Log.event(['info', 'config'], this.settings.name + ': Authentication enabled');
    }

    // Initialize cache engine

    if (this.settings.cache) {
        this.cache = new Cache.Client(this.settings.cache);
        this.cache.on('ready', function (err) {

            Utils.assert(!err, 'Failed to initialize cache engine: ' + err);
        });

        Log.event(['info', 'config'], this.settings.name + ': Caching enabled');
    }
    else {
        this.cache = null;
    }

    // Setup debug endpoint

    if (this.settings.debug) {

        this._debugConsole = new Debug.Console(this, this.settings.debug);
        this.addRoute({ 
            method: 'GET',
            path: this.settings.debug.debugEndpoint,
            config: this._debugConsole.endpoint()
        });

        Log.event(['info', 'config'], this.settings.name + ': Debug console enabled');
    }

    return this;
};

NodeUtil.inherits(internals.Server, Events.EventEmitter);


internals.Server.prototype._dispatch = function () {

    var self = this;

    return function (req, res) {

        // Create request object
        var request = new Request(self, req, res);

        // Execute onRequest extensions (can change request method, url, etc.)

        Utils.executeRequestHandlers(self.settings.ext.onRequest, request, function () {

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

            request._execute();
        });
    };
};


// Start server listener

internals.Server.prototype.start = function () {

    this.listener.listen(this.settings.port, this.settings.host);
    Log.event('info', this.settings.name + ': Instance started at ' + this.settings.uri);
};


// Stop server

internals.Server.prototype.stop = function () {

    this.listener.close();
    Log.event('info', this.settings.name + ': Instance stopped at ' + this.settings.uri);
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

    this._routes[route.method] = this._routes[route.method] || [];
    this._routes[route.method].push(route);

    // Setup CORS 'OPTIONS' handler

    if (route.method !== 'options' &&
        this.settings.cors &&
        route.config.cors !== false) {

        var optionsConfig = {
            path: route.path,
            method: 'options',
            config: {
                _skipValidation: true,
                auth: {
                    mode: 'none'
                },
                handler: function (request) {

                    request.reply({});
                }
            }
        };

        this._routes.options = this._routes.options || [];
        this._routes.options.push(new Route(optionsConfig, this));
    }
};


internals.Server.prototype.addRoutes = function (routes) {

    for (var i = 0, il = routes.length; i < il; ++i) {
        this.addRoute(routes[i]);
    }
};


