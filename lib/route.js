/*
* Path regular expression parsing adapted from Express, Copyright (c) 2009-2012 TJ Holowaychuk <tj@vision-media.ca>
* Express is released under the MIT License and is available at http://expressjs.com
*/

// Load modules

var Async = require('async');
var Validation = require('./validation');
var Cache = require('./cache');
var Utils = require('./utils');
var Err = require('./error');
var Session = require('./session');
var Payload = require('./payload');
var Request = require('./request');


// Declare internals

var internals = {};


exports = module.exports = Route = function (options, server) {

    var self = this;

    // Setup and validate route configuration

    var settings = Utils.clone(options);        // Options can be reused

    Utils.assert(this.constructor === Route, 'Route must be instantiated using new');
    Utils.assert(settings.path, 'Route options missing path');
    Utils.assert(settings.method, 'Route options missing method');

    this.server = server;
    this.method = settings.method.toLowerCase();
    this.path = settings.path;
    this.config = Utils.applyToDefaults(server.routeDefaults, settings.config || {});
    this.keys = [];
    this.cache = null;

    Utils.assert(this.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(!!settings.config.handler ^ !!settings.handler, 'Handler must appear once and only once');         // XOR
    this.config.handler = settings.config.handler || settings.handler;

    // Authentication configuration

    this.config.auth = this.config.auth || {};
    if (!this.config.auth.mode) {
        this.config.auth.mode = (this.server.settings.authentication ? 'required' : 'none');
    }
    else {
        Utils.assert(this.config.auth.mode === 'none' || this.server.settings.authentication, 'Route requires authentication but none configured');
    }

    if (this.config.auth.mode !== 'none') {
        this.config.auth.scope = this.config.auth.scope || null;
        this.config.auth.tos = this.config.auth.tos || this.server.settings.authentication.tos.min;
        this.config.auth.user = this.config.auth.user || 'required';
    }

    // Cache

    if (this.config.cache) {
        Utils.assert(this.server.cache, 'No cache configured for server');
        Utils.assert(this.method === 'get', 'Only GET routes can use a cache');
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

        var pathRx = this.path.concat(self.server.settings.router.isTrailingSlashSensitive ? '' : '/?')
            .replace(/\/\(/g, '(?:/')
            .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, convFunc)
            .replace(/([\/.])/g, '\\$1')
            .replace(/\*/g, '(.*)');

        this.regexp = new RegExp('^' + pathRx + '$', self.server.settings.router.isCaseSensitive ? '' : 'i');
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

            // Decorate request with helper functions

            request.reply = function (result) {

                // Undecorate request

                delete request.reply;
                delete request.created;

                if (result instanceof Error) {
                    request.response.error = result;
                    request.log(['handler', 'error'], { msec: timer.elapsed() });
                    next();
                }
                else {
                    request.response.result = result;
                    request.log(['handler', 'result'], { msec: timer.elapsed() });

                    if (self.cache) {

                        // Lazy save

                        var record = {
                            result: request.response.result
                        };

                        self.cache.set(request.url.href, record, function (err) {

                            if (err) {
                                request.log(['cache', 'set', 'error'], err);
                            }
                            else {
                                request.log(['cache', 'set']);
                            }
                        });
                    }

                    next();
                }
            };

            request.created = function (uri) {

                Utils.assert(self.method === 'post' || self.method === 'put', 'Cannot create resource from a non-POST/PUT handler');
                request.response.created = self.server.settings.uri + uri;
            };

            self.config.handler(request);
        };

        if (self.cache) {
            timer.reset();

            self.cache.get(request.url.href, function (err, item) {

                if (err) {
                    request.log(['cache', 'get', 'error'], err);
                    call();
                }
                else {
                    if (item) {
                        request.response.result = item.result || null;
                        request.log(['cache', 'get'], { found: true, msec: timer.elapsed() });
                        next();
                    }
                    else {
                        request.log(['cache', 'get'], { found: false, msec: timer.elapsed() });
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
        if (request.response.created) {
            exports.respond(request, 201, request.response.result, { 'Location': request.response.created });
        }
        else {
            exports.respond(request, 200, request.response.result);
        }

        request.log(['http', 'response']);
    }
    else if (request.response.error) {
        exports.respond(request, request.response.error.code, Err._format(request.response.error));
        request.log(['http', 'response', 'error'], request.response.error);
    }
    else {
        exports.respond(request, 200);      // Catch-all for empty results
    }

    this.server.emit('response', request);
    next();
};


// Format and send HTTP response

exports.respond = function (request, code, payload, headers) {

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


