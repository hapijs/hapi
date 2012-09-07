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

var internals = {

    isStrict: false,
    isCaseSensitive: true
};


exports = module.exports = Route = function (options, server) {

    var self = this;

    Utils.assert(this.constructor === Route, 'Route must be instantiated using new');
    Utils.assert(options.path, 'Route options missing path');
    Utils.assert(options.method, 'Route options missing method');

    this.server = server;
    this.method = options.method.toLowerCase();
    this.path = options.path;
    this.config = options.config;
    this.keys = [];
    this.cache = null;

    Utils.assert(this.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(this.config.handler, 'Route missing handler');
    Utils.assert(!this.config.auth || this.config.auth.mode === 'none' || this.server.settings.authentication, 'Route requires authentication but none configured');

    // Cache

    if (this.config.cache) {

        Utils.assert(this.server.cache, 'No cache configured for server');
        Utils.assert(this.method === 'get', 'Only GET routes can use a cache');

        // Create cache

        this.cache = new Cache.Set(this.config.cache, this.server.cache);
    }

    // Parse path

    if (this.path instanceof RegExp) {
        this.regexp = this.path;
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

        var pathRx = this.path.concat(internals.isStrict ? '' : '/?')
            .replace(/\/\(/g, '(?:/')
            .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, convFunc)
            .replace(/([\/.])/g, '\\$1')
            .replace(/\*/g, '(.*)');

        this.regexp = new RegExp('^' + pathRx + '$', internals.isCaseSensitive ? '' : 'i');
    }

    return this;
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
        wrapper(Request.processDebug),
        wrapper(Validation.query),
        wrapper(Payload.read),
        wrapper(Validation.payload),
        ext(this.server.settings.ext.onPreHandler),
        this.handler(),                                         // Does not stop on error
        ext(this.server.settings.ext.onPostHandler)
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(request, next);

    },
    function (err) {

        if (err) {
            request.response.error = err;
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

        var timer = new Utils.Timer();

        var call = function () {

            timer.reset();

            request.reply = function (result, options) {

                delete request.reply;                           // Disable reply
                request.response.options = options || {};

                if (result instanceof Error) {

                    request.response.error = result;
                    request.log('handler', 'error', { msec: timer.elapsed() });
                    next();
                }
                else {

                    request.response.result = result;
                    request.log('handler', 'result', { msec: timer.elapsed() });

                    if (self.cache) {

                        // Lazy save

                        var record = {

                            result: request.response.result,
                            options: request.response.options
                        };

                        self.cache.set(request.url.href, record, function (err) {

                            if (err) {
                                request.log('cache', 'set', err);
                            }
                            else {
                                request.log('cache', 'set');
                            }
                        });
                    }

                    next();
                }
            };

            self.config.handler(request);
        };

        if (self.cache) {

            timer.reset();

            self.cache.get(request.url.href, function (err, item) {

                if (err) {

                    request.log('cache', 'get', err);
                    call();
                }
                else {

                    if (item) {

                        request.response.result = item.result || null;
                        request.response.options = item.options || {};
                        request.log('cache', 'get', { found: true, msec: timer.elapsed() });
                        next();
                    }
                    else {

                        request.log('cache', 'get', { found: false, msec: timer.elapsed() });
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


