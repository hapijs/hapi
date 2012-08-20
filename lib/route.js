/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*
* Path regular expression parsing adapted from Express, Copyright (c) 2009-2012 TJ Holowaychuk <tj@vision-media.ca>
* Express is released under the MIT License and is available at http://expressjs.com
*/

// Load modules

var Async = require('async');
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

                try {

                    request.params[key] = (typeof match[i] === 'string' ? decodeURIComponent(match[i]) : match[i]);
                }
                catch (err) {

                    // decodeURIComponent can throw
                    return false;
                }
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

        wrapper(Session.authenticate),
        wrapper(Validation.query),
        wrapper(Payload.read),
        wrapper(Validation.payload),
        ext(this.server.settings.ext.onPreHandler),
        this.handler(),                                         // Does not stop on error
        ext(this.server.settings.ext.onPostHandler)
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(request, next);

    }, function (err) {

        if (err) {

            request._response.error = err;
        }

        self.finalize(request, function () {

            Utils.executeRequestHandlers(extensions.onPostRoute, request);
        });
    });
};


// Request handler

Route.prototype.handler = function () {

    var self = this;

    return function (request, next) {

        var call = function () {

            request.reply = function (result, options) {

                delete request.reply;                           // Disable reply
                request._response.options = options || {};

                if (result instanceof Error) {

                    request._response.error = result;
                    next();
                }
                else {

                    request._response.result = result;

                    if (self.cache) {

                        var record = {

                            result: request._response.result,
                            options: request._response.options
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

                        request._response.result = item.result || null;
                        request._response.options = item.options || {};
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

    var res = request._raw.res;

    // Set CORS headers

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', this.server.settings.cors.maxAge);

    // Set caching headers

    res.setHeader('Cache-Control', 'must-revalidate');

    // Send response

    if (request._response.result) {

        if (request._response.options.headers) {

            for (var header in request._response.options.headers) {

                if (request._response.options.headers.hasOwnProperty(header)) {

                    res.setHeader(header, request._response.options.headers[header]);
                }
            }
        }

        if (request._response.options.created) {

            this.server.respond(request, 201, request._response.result, { 'Location': this.server.settings.uri + request._response.options.created });
        }
        else {

            this.server.respond(request, 200, request._response.result);
        }
    }
    else if (request._response.error) {

        if (request._response.error.type === 'oauth') {

            this.server.respond(request, request._response.error.code, { error: request._response.error.error, error_description: request._response.error.text });
        }
        else {

            this.server.respond(request, request._response.error.code, { error: request._response.error.text, message: request._response.error.message, code: request._response.error.code });
        }

        Log.err(request._response.error, request);
    }
    else {

        this.server.respond(request, 200);
    }

    this.server.emit('response', request);
    next();
};


