/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*
* Path regular expression parsing adapted from Express, Copyright (c) 2009-2012 TJ Holowaychuk <tj@vision-media.ca>
* Express is released under the MIT License and is available at http://expressjs.com
*/

// Load modules

var Async = require('async');
var MAC = require('mac');
var Validation = require('./validation');
var Cache = require('./cache');
var Utils = require('./utils');
var Log = require('./log');
var Err = require('./error');
var Session = require('./session');


// Declare internals

var internals = {};


exports = module.exports = Route = function (config, server) {

    var self = this;

    this.server = server;
    this.config = (this.server.routeDefaults ? Utils.applyToDefaults(this.server.routeDefaults, config) : config);
    this.keys = [];
    this.cache = null;

    this.options = {

        isStrict: false,
        isCaseSensitive: true
    };

    // Validate configuration

    Utils.assert(this.config.path, 'Route missing path');
    Utils.assert(this.config.method, 'Route missing method');

    this.config.method = this.config.method.toLowerCase();

    Utils.assert(this.config.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(this.config.handler, 'Route missing handler');
    Utils.assert(this.config.authentication === 'none' || this.server.settings.authentication, 'Route requires authentication but none configured');

    if (this.config.cache) {

        Utils.assert(this.server.cache, 'No cache configured for server');
        Utils.assert(this.config.method === 'get', 'Only GET routes can use a cache');

        // Create cache

        this.cache = new Cache.Set(this.config.cache, this.server.cache);
    }

    // Parse path

    if (this.config.path instanceof RegExp) {

        this.regexp = this.config.path;
    }
    else {

        var convFunc = function (_, slash, format, key, capture, optional, star) {

            self.keys.push(key);
            slash = slash || '';
            return '' +
                   (optional ? '' : slash) +
                   '(?:' +
                   (optional ? slash : '') +
                   (format || '') +
                   (capture || (format && '([^/.]+?)' || '([^/]+?)')) +
                   ')' +
                   (optional || '') +
                   (star ? '(/*)?' : '');
        };

        var pathRx = this.config.path.concat(this.options.isStrict ? '' : '/?')
            .replace(/\/\(/g, '(?:/')
            .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, convFunc)
            .replace(/([\/.])/g, '\\$1')
            .replace(/\*/g, '(.*)');

        this.regexp = new RegExp('^' + pathRx + '$', this.options.isCaseSensitive ? '' : 'i');
    }
};


Route.prototype.match = function (request) {

    var match = this.regexp.exec(request.path);

    if (!match) {

        return false;
    }

    request.params = {};

    if (this.keys.length > 0) {

        for (var i = 1, il = match.length; i < il; ++i) {

            var key = this.keys[i - 1];
            if (key) {

                request.params[key] = (typeof match[i] === 'string' ? decodeURIComponent(match[i]) : match[i]);
            }
        }
    }

    return true;
};


Route.prototype.execute = function (request, callback) {

    // Handler wrappers

    var wrapper = function (func) {

        return function (request, next) {

            exports.executeExtensions(func, request, next);
        };
    };

    var funcs = [

        this.validate(),
        wrapper(this.server.settings.ext.onPreHandler),
        this.handler(),
        wrapper(this.server.settings.ext.onPostHandler),
        this.finalize(),
        wrapper(this.server.settings.ext.onPostRoute)
    ];

    Async.forEachSeries(funcs, function (item, next) {

        item(request, next);

    }, function (err) {

        callback(err);
    });
};


// Route validator

Route.prototype.validate = function () {
    
    var self = this;

    return function (request, next) {

        // Authentication

        internals.authenticate(request, self.config, self.server, function (err) {

            if (err === null) {

                // Query parameters

                Validation.validateQuery(request, Utils.map(self.config.query), function (err) {

                    if (err === null) {

                        // Load payload

                        internals.processBody(request, self.config.payload || (self.config.schema ? 'parse' : null), self.server, function (err) {

                            if (err === null) {

                                // Validate payload schema

                                Validation.validateData(request, self.config.schema || null, function (err) {

                                    if (err) {

                                        request.response.error = err;
                                    }

                                    next();
                                });
                            }
                            else {

                                request.response.error = err;
                                next();
                            }
                        });
                    }
                    else {

                        request.response.error = err;
                        next();
                    }
                });
            }
            else {

                request.response.error = err;
                next();
            }
        });
    };
};


// Request handler wrapper

Route.prototype.handler = function () {

    var self = this;

    return function (request, next) {

        var call = function () {

            request.reply = function (result, options) {

                delete request.reply;
                request.response[result instanceof Error ? 'error' : 'result'] = result;
                request.response.options = options || {};

                if (self.cache) {

                    self.cache.set(request.url.href, { result: request.response.result, error: request.response.error, options: request.response.options }, function (err) {

                        if (err) {

                            Log.err('Failed saving result to cache');
                        }
                    });
                }

                next();
            };

            self.config.handler(request);
        };

        if (!request.response.error) {

            if (self.cache) {

                self.cache.get(request.url.href, function (err, item) {

                    if (err === null) {

                        if (result) {

                            request.response.result = item.result || null;
                            request.response.error = item.error || null;
                            request.response.options = item.options || {};
                            next();
                        }
                        else {

                            call();
                        }
                    }
                    else {

                        call();
                    }
                });
            }
            else {

                call();
            }
        }
        else {

            next();
        }
    };
};


// Set default response headers and send response

Route.prototype.finalize = function () {

    var self = this;

    return function (request, next) {

        var res = request.raw.res;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', self.server.settings.cors.maxAge);
        res.setHeader('Cache-Control', 'must-revalidate');

        if (request.response.result) {

            if (request.response.options.headers) {

                for (var header in request.response.options.headers) {

                    if (request.response.options.headers.hasOwnProperty(header)) {

                        res.setHeader(header, request.response.options.headers[header]);
                    }
                }
            }

            if (request.response.options.created) {

                self.server.respond(request, 201, request.response.result, { 'Location': self.server.settings.uri + request.response.options.created });
            }
            else {

                self.server.respond(request, 200, request.response.result);
            }
        }
        else if (request.response.error) {

            if (request.response.error.type === 'oauth') {

                self.server.respond(request, request.response.error.code, { error: request.response.error.error, error_description: request.response.error.text });
            }
            else {

                self.server.respond(request, request.response.error.code, { error: request.response.error.text, message: request.response.error.message, code: request.response.error.code });
            }

            Log.err(request.response.error, request);
        }
        else {

            self.server.respond(request, 200);
        }

        self.server.emit('response', request);

        // Return control to router

        next();
    };
};


// Token Authentication

internals.authenticate = function (request, routeConfig, server, callback) {

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

    MAC.authenticate(request.raw.req, loadTokenFunc, { isHTTPS: server.settings.tls }, function (isAuthenticated, session, err) {

        if (isAuthenticated) {

            if (session) {

                request.session = session;

                if (session.client) {

                    request.clientId = session.client;

                    // Check scope

                    if (scope === null ||
                        session.scope[scope]) {

                        request.scope = session.scope;

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

                                    request.userId = session.user;
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
                !request.raw.req.headers.authorization) {

                callback(null);
            }
            else {

                request.raw.res.setHeader('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
                callback(Err.generic(401, 'Invalid authentication', err));
            }
        }
    });
};


// Read and parse body

internals.processBody = function (request, level, server, callback) {

    // Levels are: 'none', 'raw', 'parse'
    // Default is 'parse' for POST and PUT otherwise 'none'

    level = level || (request.method === 'post' || request.method === 'put' ? 'parse' : 'none');

    if (level === 'none') {

        return callback(null);
    }

    // Check content type (defaults to 'application/json')

    var contentType = request.raw.req.headers['content-type'];
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

    var contentLength = request.raw.req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > server.settings.payload.maxBytes) {

        return callback(Err.badRequest('Payload content length greater than maximum allowed: ' + server.settings.payload.maxBytes));
    }

    // Read incoming payload

    var payload = '';
    var isBailed = false;

    request.raw.req.setEncoding('utf8');
    request.raw.req.addListener('data', function (chunk) {

        if (payload.length + chunk.length <= server.settings.payload.maxBytes) {

            payload += chunk;
        }
        else {

            isBailed = true;
            return callback(Err.badRequest('Payload size greater than maximum allowed: ' + server.settings.payload.maxBytes));
        }
    });

    request.raw.req.addListener('end', function () {

        if (isBailed) {

            return;
        }

        request.rawBody = payload;

        if (level === 'parse') {

            if (payload) {

                request.payload = {};

                try {

                    request.payload = parserFunc(payload);
                }
                catch (err) {

                    return callback(Err.badRequest('Invalid JSON body'));
                }

                callback(null);
            }
        }
    });
};


// Excute extensions

exports.executeExtensions = function (ext, request, callback) {

    if (ext) {

        var extFuncs = (ext instanceof Array ? ext : [ext]);
        Async.forEachSeries(extFuncs, function (item, next) {

            item(request, next);

        }, function (err) {

            callback(err);
        });
    }
    else {

        callback(null);
    }
};

