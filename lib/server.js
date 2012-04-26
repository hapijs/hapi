/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Fs = require('fs');
var Http = require('http');
var Https = require('https');
var Url = require('url');
var Querystring = require('querystring');
var Director = require('director');
var MAC = require('mac');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Process = require('./process');
var Validation = require('./validation');
var Defaults = require('./defaults');
var Fs = require('fs');
var Monitor = require("./monitor");
var Session = require('./session');


// Declare internals

var internals = {

    // Servers instances by uri or name

    servers: {}
};


// Create and configure server instance

exports.create = function (host, port, options, routes) {

    // Create server object

    var server = {

        // Private members
        // ----------------------------------------------------------------

        settings: Utils.merge(Utils.clone(Defaults.server), options || {}),
        express: null,
        monitor: null,
        listener: null,
        router: null,

        // Initialize server
        // ----------------------------------------------------------------

        initialize: function () {

            // Set basic configuration

            server.settings.host = host.toLowerCase();
            server.settings.port = port;
            server.settings.name = (server.settings.name ? server.settings.name.toLowerCase() : (server.settings.host + ':' + server.settings.port));
            server.settings.uri = (server.settings.tls ? 'https://' : 'http://') + server.settings.host + ':' + server.settings.port + '/';

            // Initialize Log downstream if set

            if (server.settings.monitor && server.settings.monitor.log && Object.keys(server.settings.monitor.log).length > 0){

                Log.externalStores = server.settings.monitor.log;
            }

            // Initialize authentication configuration and validate

            if (server.settings.authentication) {

                server.settings.authentication = Utils.merge(Utils.clone(Defaults.authentication), server.settings.authentication);

                if (server.settings.authentication.tokenEndpoint === null ||
                    server.settings.authentication.loadClientFunc === null ||
                    server.settings.authentication.loadUserFunc === null ||
                    server.settings.authentication.checkAuthorizationFunc === null ||
                    server.settings.authentication.aes256Keys.oauthRefresh === null ||
                    server.settings.authentication.aes256Keys.oauthToken === null) {

                    Log.err('Invalid authentication configuration');
                    process.exit(1);
                }
            }

            // Verify no existing instances using the same uri or name

            if (internals.servers[server.settings.name]) {

                Log.err('Cannot configure multiple server instances using the same name or uri');
                process.exit(1);
            }

            // Create router

            server.router = new Director.http.Router();
            server.router.configure({

                async: true,
                notfound: server.unhandledRoute
            });

            var listernerEntryFunc = function (req, res) {

                server.router.dispatch(req, res, function (err) {

                    if (err) {

                        // Should never get called since 'notfound' is set

                        Log.err('Internal routing error');
                        res.writeHead(500);
                        res.end();
                    }
                });
            };

            // Create server

            if (server.settings.tls) {

                var tls = {

                    key: Fs.readFileSync(server.settings.tls.key),
                    cert: Fs.readFileSync(server.settings.tls.cert)
                };

                server.listener = Https.createServer(tls, listernerEntryFunc);
            }
            else {

                server.listener = Http.createServer(listernerEntryFunc);
            }

            // Configure Monitoring (if enabled)

            if (Object.keys(server.settings.monitor).length > 0){

                server.monitor = new Monitor(server);
                server.express.configure(function () {

                    server.express.use(server.monitor.logger())
                })
            }

            // Configure Express

            server.express.configure(function () {

                server.express.use(server.settings.ext.onPreRoute);
                server.express.use(server.preRoute);                                                        // Pre-Routes Middleware
                server.express.use(server.settings.ext.onPreHandler);
                server.express.use(server.express.router);                                                  // Load Routes
                server.express.use(server.settings.ext.onPostHandler);
                server.express.use(server.postRoute);                                                       // Post-Routes Middleware
                server.express.use(server.settings.ext.onPostRoute);
            });
            
            // Add to instance list

            internals.servers[server.settings.name] = server;

            // Setup OPTIONS handler

            server.router.options(/.+/, function () {

                server.setCorsHeaders(this.res);
                internals.respond(this.res, 200);
            });

            // Setup OAuth token endpoint

            if (server.settings.authentication) {

                server.public.addRoute({

                    method: 'POST',
                    path: server.settings.authentication.tokenEndpoint,
                    handler: Session.token,
                    schema: Session.type.endpoint,
                    mode: 'raw',
                    authentication: 'optional',
                    user: 'any',
                    tos: 'none'
                });
            }

            // Add routes

            if (routes) {

                server.public.addRoutes(routes);
            }
        },

        // Route preprocessor handler
        // ----------------------------------------------------------------

        preRoute: function (req, res, next) {

            req._startTime = new Date; // Used to determine request response time 

            Log.info('Received', req);

            req.hapi = {};
            res.hapi = {};

            req.query = req.url.indexOf('?') >= 0 ? Url.parse(req.url, true).query : {};

            next();
        },

        // Route validator
        // ----------------------------------------------------------------

        routeValidator: function (config) {

            return function (req, res, next) {

                // Authentication

                internals.authenticate(req, res, config, server, function (err) {

                    if (err === null) {

                        // Query parameters

                        Validation.validateQuery(req, config.query ? Utils.map(config.query) : null, function (err) {

                            if (err === null) {

                                // Load payload

                                internals.processBody(req, config.payload || (config.schema ? 'parse' : null), server, function (err) {

                                    if (err === null) {

                                        // Validate payload schema

                                        Validation.validateData(req, config.schema || null, function (err) {

                                            if (err) {

                                                res.hapi.error = err;
                                            }

                                            next();
                                        });
                                    }
                                    else {

                                        res.hapi.error = err;
                                        next();
                                    }
                                });
                            }
                            else {

                                res.hapi.error = err;
                                next();
                            }
                        });
                    }
                    else {

                        res.hapi.error = err;
                        next();
                    }
                });
            };
        },

        // Request handler wrapper
        // ----------------------------------------------------------------

        routeHandler: function (config) {

            return function (req, res, next) {

                if (!res.hapi.error) {

                    // Link req stuff into hapi object

                    req.hapi.url = req.url;
                    req.hapi.query = req.query;
                    req.hapi.params = req.params;
                    req.hapi.server = server;

                    var request = (config.mode === 'raw' ? req : req.hapi);

                    config.handler(request, function (result, options) {

                        res.hapi[result instanceof Error ? 'error' : 'result'] = result;
                        res.hapi.options = options || {};
                        next();
                    });
                }
                else {

                    next();
                }
            };
        },

        // Set default response headers and send response
        // ----------------------------------------------------------------

        postRoute: function (req, res, next) {

            server.setCorsHeaders(res);
            res.setHeader('Cache-Control', 'must-revalidate');

            if (res.hapi.result) {

                var rev = null;                         // Need to set to something useful
                if (req.method === 'GET' && rev) {

                    res.setHeader('ETag', rev);

                    var condition = internals.parseCondition(req.headers['if-none-match']);

                    if (condition[rev] ||
                        condition['*']) {

                        internals.respond(res, 304);
                    }
                    else {

                        internals.respond(res, 200, res.hapi.result);
                    }
                }
                else if (res.hapi.options.created) {

                    internals.respond(res, 201, res.hapi.result, { 'Location': server.settings.uri + res.hapi.options.created });
                }
                else {

                    internals.respond(res, 200, res.hapi.result);
                }

                Log.info('Replied', req);
            }
            else if (req.hapi.error) {

                if (req.hapi.error.type === 'oauth') {

                    internals.respond(res, req.hapi.error.code, { error: req.hapi.error.error, error_description: req.hapi.error.text });
                }
                else {

                    internals.respond(res, req.hapi.error.code, { error: req.hapi.error.text, message: req.hapi.error.message, code: req.hapi.error.code });
                }

                Log.err(res.hapi.error, req);
            }
            else {

                internals.respond(res, 200);
                Log.info('Replied', req);
            }

            next();
        },

        // 404 Route handler
        // ----------------------------------------------------------------

        unhandledRoute: function (next) {

            this.req._startTime = new Date;                             // Used to determine request response time 

            if (server.settings.ext.onUnknownRoute) {

                // Extension handler is called, but the router continues processing the request regardless

                server.settings.ext.onUnknownRoute(this.req, this.res);
                next();
            }
            else {

                Log.info('Received', this.req);

                var error = Err.notFound('No such path or method');
                internals.respond(this.res, error.code, { error: error.text, message: error.message, code: error.code });

                Log.info(error, this.req);
                next();
            }
        },

        // Set CORS headers
        // ----------------------------------------------------------------

        setCorsHeaders: function (res) {

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match');
            res.setHeader('Access-Control-Max-Age', server.settings.cors.maxAge);
        },

        // Public members

        public: {

            // Start server listener
            // ----------------------------------------------------------------

            start: function () {

                server.listener.listen(server.settings.port, server.settings.host);
                Log.info(Process.settings.name + ' Server instance started at ' + server.settings.uri);
            },

            // Stop server
            // ----------------------------------------------------------------

            stop: function () {

                server.listener.close();
                Log.info(Process.settings.name + ' Server instance stopped at ' + server.settings.uri);
            },

            // Add server route
            // ----------------------------------------------------------------

            addRoute: function (config) {

                // Validate configuration

                if (config.authentication !== 'none' &&
                    server.settings.authentication === null) {

                    Log.err('Route requires authentication but none configured');
                    process.exit(1);
                }

                if (!config.path) {

                    Log.err('Route missing path');
                    process.exit(1);
                }

                if (!config.handler) {

                    Log.err('Route missing handler');
                    process.exit(1);
                }

                // Parse path to identify :parameter names, only if no other regex or wildcards are included

                var parameterNames = [];
                if (/\*|\(|\)/.test(config.path) === false) {

                    var names = config.path.match(/:([^\/]+)/ig);
                    if (names) {

                        for (var i = 0, il = names.length; i < il; ++i) {

                            parameterNames.push(names[i].slice(1));
                        }
                    }
                }

                // Handler wrapper

                var wrapper = function (func) {

                    return function () {

                        // Convert director arguements to parameters object

                        if (arguments.length - 1 === parameterNames.length) {

                            this.req.params = {};
                            for (var i = 0, il = parameterNames.length; i < il; ++i) {

                                this.req.params[parameterNames[i]] = arguments[i];
                            }
                        }

                        func(this.req, this.res, arguments[arguments.length - 1]);
                    };
                };

                // Add route to Director

                server.router[config.method.toLowerCase()](config.path, { stream: true }, [

                    wrapper(server.settings.ext.onPreRoute),
                    wrapper(server.preRoute),
                    wrapper(server.routeValidator(config)),
                    wrapper(server.settings.ext.onPreHandler),
                    wrapper(server.routeHandler(config)),
                    wrapper(server.settings.ext.onPostHandler),
                    wrapper(server.postRoute),
                    wrapper(server.settings.ext.onPostRoute)]);
            },

            addRoutes: function (routes) {

                for (var i = 0, il = routes.length; i < il; ++i) {

                    server.public.addRoute(routes[i]);
                }
            },

            // Access internal server instance
            // ----------------------------------------------------------------

            getListener: function () {

                return server.listener;
            }
        }
    };

    // Initialize

    server.initialize();

    // Return public interface

    return server.public;
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

            Log.err('Cannot call Server.instance() without uri in a process with multiple server instances');
            process.exit(1);
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

    var defaultInstances = (arguments.length === 2 ? (arguments[0] instanceof Array ? arguments[0] : [arguments[0]]) : null);
    var routes = (arguments.length === 2 ? arguments[1] : arguments[0]);

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

                    server.public.addRoute(route);
                }
                else {

                    Log.err('Cannot find server instance: ' + instances[r]);
                    process.exit(1);
                }
            }
        }
        else {

            // All instances

            for (var s in internals.servers) {

                if (internals.servers.hasOwnProperty(s)) {

                    internals.servers[s].public.addRoute(route);
                }
            }
        }
    }
};


// Token Authentication

internals.authenticate = function (req, res, routeConfig, server, callback) {

    var scope = routeConfig.scope || null;
    var minTos = routeConfig.tos || server.settings.tos.min;
    var userMode = routeConfig.user || 'required';
    var isOptional = (routeConfig.authentication === 'optional');

    if (routeConfig.authentication === 'none') {

        callback(null);
        return;
    }

    var loadTokenFunc = function (token, callback) {

        Session.loadToken(server.settings.authentication.aes256Keys.oauthToken, token, callback);
    };

    MAC.authenticate(req, loadTokenFunc, { isHTTPS: server.settings.tls }, function (isAuthenticated, session, err) {

        if (isAuthenticated) {

            if (session) {

                req.hapi.session = session;

                if (session.client) {

                    req.hapi.clientId = session.client;

                    // Check scope

                    if (scope === null ||
                        session.scope[scope]) {

                        req.hapi.scope = session.scope;

                        if (userMode === 'any') {

                            // User Mode: any

                            callback(null);
                        }
                        else if (userMode === 'required') {

                            // User Mode: required

                            if (session.user) {

                                // Check TOS

                                if (minTos === 'none' ||
                                    (session.tos && session.tos >= minTos)) {

                                    req.hapi.userId = session.user;
                                    callback(null);
                                }
                                else {

                                    callback(Err.forbidden('Insufficient TOS accepted'));
                                }
                            }
                            else {

                                callback(Err.forbidden('Client token cannot be used on a user endpoint'));
                            }
                        }
                        else if (userMode === 'none') {

                            // User Mode: none

                            if (session.user) {

                                callback(Err.forbidden('User token cannot be used on a client endpoint'));
                            }
                            else {

                                callback(null);
                            }
                        }
                        else {

                            callback(Err.internal('Unknown endpoint user mode'));
                        }
                    }
                    else {

                        callback(Err.forbidden('Insufficient token scope (\'' + scope + '\' expected for client ' + session.client + ')'));
                    }
                }
                else {

                    callback(Err.internal('Missing client identifier in authenticated token'));
                }
            }
            else {

                callback(Err.internal('Missing user object in authenticated token'));
            }
        }
        else {

            // Unauthenticated

            if (isOptional &&
                !req.headers.authorization) {

                callback(null);
            }
            else {

                res.setHeader('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
                callback(Err.generic(401, 'Invalid authentication', err));
            }
        }
    });
};


// Read and parse body

internals.processBody = function (req, level, server, callback) {

    // Levels are: 'none', 'raw', 'parse'
    // Default is 'parse' for POST and PUT otherwise 'none'

    level = level || (req.method === 'POST' || req.method === 'PUT' ? 'parse' : 'none');

    if (level === 'none') {

        return callback(null);
    }

    // Check content type (defaults to 'application/json')

    var contentType = req.headers['content-type'];
    var mime = (contentType ? contentType.split(';')[0] : 'application/json');
    var parserFunc = null;

    if (mime === 'application/json') {

        parserFunc = JSON.parse;
    }
    else if (mime === 'application/x-www-form-urlencoded') {

        parserFunc = Querystring.parse;
    }
    else {

        return callback(Err.badRequest('Unsupported content-type: ' + mime));
    }

    // Check content size

    var contentLength = req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > server.settings.payload.maxBytes) {

        return callback(Err.badRequest('Payload content length greater than maximum allowed: ' + server.settings.payload.maxBytes));
    }

    // Read incoming payload

    var payload = '';
    var isBailed = false;

    req.setEncoding('utf8');
    req.addListener('data', function (chunk) {

        if (payload.length + chunk.length <= server.settings.payload.maxBytes) {

            payload += chunk;
        }
        else {

            isBailed = true;
            return callback(Err.badRequest('Payload size greater than maximum allowed: ' + server.settings.payload.maxBytes));
        }
    });

    req.addListener('end', function () {

        if (isBailed) {

            return;
        }

        req.hapi.rawBody = payload;

        if (level === 'parse') {

            if (payload) {

                req.hapi.payload = {};

                try {

                    req.hapi.payload = parserFunc(payload);
                }
                catch (err) {

                    return callback(Err.badRequest('Invalid JSON body'));
                }

                callback(null);
            }
        }
    });
};


// Parse If-None-Match request header

internals.parseCondition = function (condition) {

    if (condition) {

        result = {};

        var conditionRegex = (condition.indexOf('"') !== -1 ? /(?:^|,)(?:\s*")([^"]+)(?:"\s*)/g : /(?:^|,)(?:\s*)([^\s]+)(?:\s*)/g);
        condition.replace(conditionRegex, function ($0) {

            if ($0) {

                result[$0] = true;
            }
        });

        return result;
    }
    else {

        return {};
    }
};


// Format and send HTTP response

internals.respond = function (res, code, payload, headers) {

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

            headers['Content-Type'] = 'text/plain';
            data = payload;
        }

        headers['Content-Length'] = Buffer.byteLength(data);
    }

    res.writeHeader(code, headers);
    res.end(data);
};

