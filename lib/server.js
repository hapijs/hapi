/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

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


// Declare internals

var internals = {

    // Servers instances by uri or name

    servers: {}
};


// Create and configure server instance

exports.Server = Server = function (host, port, options, routes) {

    var self = this;

    // Confirm self Server is called as constructor

    if (this.constructor != Server) {

        Utils.abort('Server must be instantiated using new');
    }

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

        if (this.settings.authentication.tokenEndpoint === null ||
            this.settings.authentication.loadClientFunc === null ||
            this.settings.authentication.loadUserFunc === null ||
            this.settings.authentication.checkAuthorizationFunc === null ||
            this.settings.authentication.aes256Keys.oauthRefresh === null ||
            this.settings.authentication.aes256Keys.oauthToken === null) {

            Utils.abort('Invalid authentication configuration');
        }
    }

    // Verify no existing instances using the same uri or name

    if (internals.servers[this.settings.name]) {

        Utils.abort('Cannot configure multiple server instances using the same name or uri');
    }

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

                if (err) {

                    Utils.abort('Failed to initialize cache engine: ' + err);
                }
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

    // Initialize Monitoring if set

    this.monitor = new Monitor(this, this.settings, Log);

    // Setup OAuth token endpoint

    if (this.settings.authentication) {

        this.addRoute({

            method: 'POST',
            path: this.settings.authentication.tokenEndpoint,
            handler: Session.token,
            schema: Session.type.endpoint,
            authentication: 'optional',
            user: 'any',
            tos: 'none'
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

        // onRequest can change internal req values (e.g. url, method)

        Route.executeExtensions(self.settings.ext.onRequest, req, function () {

            // Create request object

            var request = new Request(self, req, res);

            // Lookup route

            var method = (request.method === 'head' ? 'get' : request.method);
            var routes = self.routes[method];
            if (routes) {

                for (var i = 0, il = routes.length; i < il; ++i) {

                    var route = routes[i];
                    if (route.match(request)) {

                        return route.execute(request, function (err) {

                            if (err) {

                                Log.err('Dispatch error: ' + err);
                                res.writeHead(500);
                                res.end();
                            }
                        });
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

            self.emit('response', request);
        });
    }
    else {

        var error = Err.notFound('No such path or method');
        this.respond(request.raw.res, error.code, { error: error.text, message: error.message, code: error.code });

        Log.info(error, request);

        this.emit('response', request);
    }
};


// Set CORS headers

Server.prototype.setCorsHeaders = function (res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', this.settings.cors.maxAge);
};


// Start server listener

Server.prototype.start = function () {

    this.listener.listen(this.settings.port, this.settings.host);
    Log.info(Process.settings.name + ' instance started at ' + this.settings.uri);
};


// Stop server

Server.prototype.stop = function () {

    this.listener.close();
    Log.info(Process.settings.name + ' instance stopped at ' + this.settings.uri);
};


// Set route defauts

Server.prototype.setRoutesDefaults = function (config) {

    this.routeDefaults = config;
};


// Add server route

Server.prototype.addRoute = function (config) {

    // Add route

    var route = new Route(config, this);

    this.routes[route.config.method] = this.routes[route.config.method] || [];
    this.routes[route.config.method].push(route);

    // Setup CORS 'OPTIONS' handler

    if (route.config.cors !== false) {

        var optionsConfig = {

            path: route.config.path,
            method: 'options',
            authentication: 'optional',
            user: 'any',
            tos: 'none',
            handler: function (request, reply) {

                reply({});
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

Server.prototype.respond = function (res, code, payload, headers) {

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

    res.writeHeader(code, headers);
    res.end(data);
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
                if (server) {

                    server.addRoute(route);
                }
                else {

                    Utils.abort('Cannot find server instance: ' + instances[r]);
                }
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
