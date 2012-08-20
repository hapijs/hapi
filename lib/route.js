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
var Payload = require('./payload');


// Declare internals

var internals = {};


exports = module.exports = Route = function (config, server) {

    var self = this;

    this.server = server;
    this.config = Utils.applyToDefaults(this.server.routeDefaults, config);
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


Route.prototype.execute = function (request) {

    var self = this;

    // Handler wrappers

    var extensions = self.server.settings.ext;
    var ext = function (func) {

        return function (request, next) {

            Utils.executeRequestHandlers(func, request, next);
        };
    };

    var wrapper = function (func) {

        return function (request, next) {

            func(request, self.config, next);
        };
    };

    var funcs = [

        this.authenticate(),
        wrapper(Validation.validateQuery),
        wrapper(Payload.read),
        wrapper(Validation.validateData),
        ext(this.server.settings.ext.onPreHandler),
        this.handler(),                                         // Does not stop on error
        ext(this.server.settings.ext.onPostHandler)
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(request, next);

    }, function (err) {

        if (err) {

            request.response.error = err;
        }

        self.finalize(request, function () {

            Utils.executeRequestHandlers(extensions.onPostRoute, request);
        });
    });
};


// Token Authentication

Route.prototype.authenticate = function () {

    var self = this;

    return function (request, next) {

        var scope = self.config.scope || null;
        var minTos = self.config.tos || self.server.settings.tos.min;
        var userMode = self.config.user || 'required';
        var isOptional = (self.config.authentication === 'optional');

        if (self.config.authentication === 'none') {

            return next();
        }

        var loadTokenFunc = function (token, callback) {

            Session.loadToken(self.server.settings.authentication.aes256Keys.oauthToken, token, callback);
        };

        MAC.authenticate(request.raw.req, loadTokenFunc, { isHTTPS: self.server.settings.tls }, function (isAuthenticated, session, err) {

            if (!isAuthenticated) {

                // Unauthenticated

                if (isOptional &&
                    !request.raw.req.headers.authorization) {

                    return next();
                }
                else {

                    request.raw.res.setHeader('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
                    return next(Err.generic(401, 'Invalid authentication', err));
                }
            }

            if (!session) {

                return next(Err.internal('Missing user object in authenticated token'));
            }


            request.session = session;

            if (!session.client) {

                return next(Err.internal('Missing client identifier in authenticated token'));
            }

            request.clientId = session.client;

            // Check scope

            if (scope &&
                !session.scope[scope]) {

                return next(Err.forbidden('Insufficient token scope (\'' + scope + '\' expected for client ' + session.client + ')'));
            }

            request.scope = session.scope;

            if (userMode === 'any') {

                // User Mode: any

                return next();
            }
            else if (userMode === 'required') {

                    // User Mode: required

                if (session.user) {

                    // Check TOS

                    if (minTos === 'none' ||
                        (session.tos && session.tos >= minTos)) {

                        request.userId = session.user;
                        return next();
                    }
                    else {

                        return next(Err.forbidden('Insufficient TOS accepted'));
                    }
                }
                else {

                    return next(Err.forbidden('Client token cannot be used on a user endpoint'));
                }
            }
            else if (userMode === 'none') {

                    // User Mode: none

                if (session.user) {

                    return next(Err.forbidden('User token cannot be used on a client endpoint'));
                }
                else {

                    return next();
                }
            }
            else {

                return next(Err.internal('Unknown endpoint user mode'));
            }
        });
    };
};


// Request handler

Route.prototype.handler = function () {

    var self = this;

    return function (request, next) {

        var call = function () {

            request.reply = function (result, options) {

                delete request.reply;                           // Disable reply
                request.response.options = options || {};

                if (result instanceof Error) {

                    request.response.error = result;
                    next();
                }
                else {

                    request.response.result = result;

                    if (self.cache) {

                        var record = {

                            result: request.response.result,
                            options: request.response.options
                        };

                        self.cache.set(request.url.href, record, function (err) {

                            if (err) {

                                Log.err('Failed saving result to cache');
                            }
                        });
                    }

                    next();
                }
            };

            self.config.handler(request);
        };

        if (self.cache) {

            self.cache.get(request.url.href, function (err, item) {

                if (err) {

                    call();
                }
                else {

                    if (item) {

                        request.response.result = item.result || null;
                        request.response.options = item.options || {};
                        next();
                    }
                    else {

                        call();
                    }
                }
            });
        }
        else {

            call();
        }
    };
};


// Set default response headers and send response

Route.prototype.finalize = function (request, next) {

    var res = request.raw.res;

    // Set CORS headers

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', this.server.settings.cors.maxAge);

    // Set caching headers

    res.setHeader('Cache-Control', 'must-revalidate');

    // Send response

    if (request.response.result) {

        if (request.response.options.headers) {

            for (var header in request.response.options.headers) {

                if (request.response.options.headers.hasOwnProperty(header)) {

                    res.setHeader(header, request.response.options.headers[header]);
                }
            }
        }

        if (request.response.options.created) {

            this.server.respond(request, 201, request.response.result, { 'Location': this.server.settings.uri + request.response.options.created });
        }
        else {

            this.server.respond(request, 200, request.response.result);
        }
    }
    else if (request.response.error) {

        if (request.response.error.type === 'oauth') {

            this.server.respond(request, request.response.error.code, { error: request.response.error.error, error_description: request.response.error.text });
        }
        else {

            this.server.respond(request, request.response.error.code, { error: request.response.error.text, message: request.response.error.message, code: request.response.error.code });
        }

        Log.err(request.response.error, request);
    }
    else {

        this.server.respond(request, 200);
    }

    this.server.emit('response', request);
    next();
};


