/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Express = require('express');
var Qs = require('qs');
var MAC = require('mac');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Process = require('./process');
var Validation = require('./validation');
var Defaults = require('./defaults');
var Fs = require('fs');


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

        // Initialize server
        // ----------------------------------------------------------------

        initialize: function () {

            // Set basic configuration

            server.settings.host = host.toLowerCase();
            server.settings.port = port;
            server.settings.name = (server.settings.name ? server.settings.name.toLowerCase() : (server.settings.host + ':' + server.settings.port));
            server.settings.uri = (server.settings.tls ? 'https://' : 'http://') + server.settings.host + ':' + server.settings.port + '/';

            // Verify no existing instances using the same uri or name

            if (internals.servers[server.settings.name]) {

                Log.err('Cannot configure multiple server instances using the same name or uri');
                process.exit(1);
            }

            // Create server

            if (server.settings.tls) {

                var tls = {

                    key: Fs.readFileSync(server.settings.tls.key),
                    cert: Fs.readFileSync(server.settings.tls.cert)
                };

                server.express = Express.createServer(tls);
            }
            else {

                server.express = Express.createServer();
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

            // Override generic OPTIONS route

            server.express.options(/.+/, function (req, res, next) {

                res.hapi.result = ' ';
                server.postRoute(req, res, next);
            });

            // Add to instance list

            internals.servers[server.settings.name] = server;

            // Add routes

            if (routes) {

                server.public.addRoutes(routes);
            }
        },

        // Route pre-processor
        // ----------------------------------------------------------------

        preRoute: function (req, res, next) {

            Log.info('Received', req);

            req.hapi = {};
            res.hapi = {};

            res.hapi.wasProcessed = false;

            next();
        },

        // Set default response headers and send response
        // ----------------------------------------------------------------

        postRoute: function (req, res, next) {

            if (res.hapi.isReplied !== true) {

                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match');
                res.header('Access-Control-Max-Age', server.settings.cors.maxAge);

                res.header('Cache-Control', 'must-revalidate');

                if (res.hapi.result) {

                    var rev = null;                         // Need to set to something useful
                    if (req.method === 'GET' && rev) {

                        res.header('ETag', rev);

                        var condition = internals.parseCondition(req.headers['if-none-match']);

                        if (condition[rev] ||
                            condition['*']) {

                            res.send('', 304);
                        }
                        else {

                            res.send(res.hapi.result);
                        }
                    }
                    else if (res.hapi.options.created) {

                        res.send(res.hapi.result, { 'Location': server.settings.uri + res.hapi.options.created }, 201);
                    }
                    else {

                        res.send(res.hapi.result);
                    }

                    Log.info('Replied', req);
                }
                else {

                    var error = res.hapi.error || Err.notFound('No such path or method');

                    if (error.type === 'oauth') {

                        res.send({ error: error.error, error_description: error.text }, error.code);
                    }
                    else {

                        res.send({ error: error.text, message: error.message, code: error.code }, error.code);
                    }

                    if (res.hapi.error) {

                        Log.err(res.hapi.error, req);
                    }
                    else {

                        Log.info(error, req);
                    }
                }

                res.hapi.isReplied = true;
            }
        },

        // Public members

        public: {

            // Start server listener
            // ----------------------------------------------------------------

            start: function () {

                server.express.listen(server.settings.port, server.settings.host);
                Log.info(Process.settings.name + ' Server instance started at ' + server.settings.uri);
            },

            // Stop server
            // ----------------------------------------------------------------

            stop: function () {

                server.express.close();
                Log.info(Process.settings.name + ' Server instance stopped at ' + server.settings.uri);
            },

            // Add server route
            // ----------------------------------------------------------------

            addRoute: function (config) {

                var handler = function (req, res, next) {

                    res.hapi.wasProcessed = true;

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

                                                if (err === null) {

                                                    // Route handler

                                                    if (config.handler) {

                                                        // Move req stuff into hapi object

                                                        req.hapi.url = req.url;
                                                        req.hapi.query = req.query;
                                                        req.hapi.params = req.params;

                                                        config.handler(req.hapi, function (result, options) {

                                                            if (result instanceof Error) {

                                                                res.hapi.error = result;
                                                            }
                                                            else {

                                                                res.hapi.result = result;
                                                            }

                                                            res.hapi.options = options || {};
                                                            next();
                                                        });
                                                    }
                                                    else {

                                                        res.hapi.error = Err.internal('Route missing handler');
                                                        next();
                                                    }
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
                        }
                        else {

                            res.hapi.error = err;
                            next();
                        }
                    });
                };

                // Add route to Express

                switch (config.method) {

                    case 'GET': server.express.get(config.path, handler); break;
                    case 'POST': server.express.post(config.path, handler); break;
                    case 'PUT': server.express.put(config.path, handler); break;
                    case 'DELETE': server.express.del(config.path, handler); break;
                    default: process.exit(1); break;
                }
            },

            addRoutes: function (routes) {

                for (var i = 0, il = routes.length; i < il; ++i) {

                    server.public.addRoute(routes[i]);
                }
            },

            // Access internal Express server object
            // ----------------------------------------------------------------

            getExpress: function () {

                return server.express;
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

    var getSession = function (id, callback) {

        if (server.settings.authentication.loadSessionFunc) {

            server.settings.authentication.loadSessionFunc(id, function (session) {

                callback(session);
            });
        }
        else {

            Log.err('Not configured to recieve authenticated requests');
            callback(null);
        }
    };

    MAC.authenticate(req, getSession, { isHTTPS: server.settings.tls }, function (isAuthenticated, session, err) {

        if (isAuthenticated) {

            if (session) {

                req.hapi.session = session;

                if (session.client) {

                    req.hapi.clientId = session.client;

                    // Check scope

                    if (scope === null ||
                        session.scope[scope]) {

                        req.hapi.scope = session.scope;

                        if (userMode === 'required') {

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

                            if (session.user) {

                                callback(Err.forbidden('User token cannot be used on a client endpoint'));
                            }
                            else {

                                callback(null);
                            }
                        }
                        else if (userMode === 'any') {

                            callback(null);
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

                res.header('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
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

        parserFunc = Qs.parse;
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
