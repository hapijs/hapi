// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Url = require('url');
var Async = require('async');
var Utils = require('./utils');
var Err = require('./error');
var Session = require('./session');
var Payload = require('./payload');
var Validation = require('./validation');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Request = function (server, req, res) {

    var now = Utils.getTimestamp();     // Take measurement as soon as possible

    Utils.assert(this.constructor === internals.Request, 'Request must be instantiated using new');

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Public members

    this.server = server;
    this.setUrl(req.url);               // Sets: url, path, query
    this.setMethod(req.method);

    // Defined elsewhere:
    //
    // params
    // rawBody
    // payload
    // session: { client, scope, user, tos }
    // reply()

    // Semi-public members

    this.response = {};                // { result, created }
    this.raw = {
        req: req,
        res: res
    };

    // Private members

    this._route = null;
    this._isResponded = false;
    this._log = [];
    this._analytics = {
        startTime: now
    };

    // Extract session debugging information

    if (this.server.settings.debug) {
        if (this.query[this.server.settings.debug.queryKey]) {
            this._debug = this.query[this.server.settings.debug.queryKey];
        }
    }

    // Log request

    var about = {
        method: this.method,
        url: this.url.href,
        agent: this.raw.req.headers['user-agent']
    };

    this.log(['http', 'received'], about, now)

    return this;
};

NodeUtil.inherits(internals.Request, Events.EventEmitter);


internals.Request.prototype.setUrl = function (url) {

    this.url = Url.parse(url, true);
    this.path = this.url.pathname;
    this.query = this.url.query || {};
};


internals.Request.prototype.setMethod = function (method) {

    this.method = method.toLowerCase();
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    // Prepare log item

    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Utils.getTimestamp());
    var item = {
        timestamp: now,
        tags: (tags instanceof Array ? tags : [tags])
    };

    if (data) {
        item.data = data;
    }

    // Add to request array
    this._log.push(item);

    // Pass to debug

    if (this._debug) {
        this.server._debugConsole.report(this._debug, item);
    }
};


internals.Request.prototype._execute = function (route) {

    var self = this;

    var extensions = this.server.settings.ext;

    if (route) {

        this._route = route;

        // Handler wrappers

        var ext = function (func) {

            return function (request, next) {

                Utils.executeRequestHandlers(func, request, next);
            };
        };

        var funcs = [
            Session.authenticate,
            internals.processDebug,
            Validation.query,
            Payload.read,
            Validation.payload,
            ext(extensions.onPreHandler),
            internals.handler,                 // Does not stop on error
            ext(extensions.onPostHandler)
        ];

        Async.forEachSeries(funcs, function (func, next) {

            func(self, next);
        },
        function (err) {

            if (err) {
                self.response.result = err;
            }

            internals.finalize(self, function () {

                Utils.executeRequestHandlers(extensions.onPostRoute, self);
            });
        });
    }
    else {

        // 404

        if (extensions.onUnknownRoute) {
            extensions.onUnknownRoute(self, function () {

                self.log(['http', 'response', 'ext']);

                if (!self._isResponded) {
                    self.server.emit('response', self);
                    self._isResponded = true;
                }
            });
        }
        else {
            self.response.result = Err.notFound('No such path or method');
            self._respond();
        }
    }
};


// Request handler

internals.handler = function (request, next) {

    var timer = new Utils.Timer();

    var call = function () {

        timer.reset();

        // Decorate request with helper functions

        request.reply = function (result) {

            // Store result
            request.response.result = result;

            // Undecorate request

            delete request.reply;
            delete request.created;

            if (result instanceof Error) {
                request.log(['handler', 'result', 'error'], { msec: timer.elapsed() });
                next();
            }
            else {
                request.log(['handler', 'result'], { msec: timer.elapsed() });

                if (request._route.cache) {

                    // Lazy save

                    var record = {
                        result: request.response.result
                    };

                    request._route.cache.set(request.url.href, record, function (err) {

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

            Utils.assert(request.method === 'post' || request.method === 'put', 'Cannot create resource from a non-POST/PUT handler');
            request.response.created = request.server.settings.uri + uri;
        };

        request._route.config.handler(request);
    };

    if (request._route.cache) {
        timer.reset();

        request._route.cache.get(request.url.href, function (err, item) {

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


// Set default response headers and send response

internals.finalize = function (request, next) {

    var res = request.raw.res;

    // Set CORS headers

    if (request.server.settings.cors &&
        request._route.config.cors !== false) {

        res.setHeader('Access-Control-Allow-Origin', request.server.settings.cors._origin);
        res.setHeader('Access-Control-Max-Age', request.server.settings.cors.maxAge);
        res.setHeader('Access-Control-Allow-Methods', request.server.settings.cors._methods);
        res.setHeader('Access-Control-Allow-Headers', request.server.settings.cors._headers);
    }

    // Set caching headers
    res.setHeader('Cache-Control', 'must-revalidate');

    // Send response
    request._respond();

    next();
};


internals.Request.prototype._respond = function () {

    var code = 200;
    var headers = {};
    var data = null;

    if (this.response.result) {

        if (this.response.result instanceof Error) {
            code = this.response.result.code;
            this.log(['http', 'response', 'error'], this.response.result);
        }
        else {
            if (this.response.created) {
                code = 201;
                headers = { 'Location': this.response.created };
            }

            this.log(['http', 'response']);
        }

        if (typeof this.response.result === 'object') {

            // Object

            headers['Content-Type'] = 'application/json';
            data = JSON.stringify(this.response.result instanceof Error ? Err.format(this.response.result) : this.response.result);
        }
        else {

            // String

            headers['Content-Type'] = 'text/html';
            data = (typeof this.response.result === 'string' ? this.response.result : JSON.stringify(this.response.result));
        }

        if (data !== null) {                                                // data can be empty string
            headers['Content-Length'] = Buffer.byteLength(data);
        }
    }
    else {
        this.log(['http', 'response', 'empty']);
    }

    this.raw.res.writeHead(code, headers);
    this.raw.res.end(this.method !== 'head' ? data : '');

    if (!this._isResponded) {
        this.server.emit('response', this);
        this._isResponded = true;
    }
};


internals.processDebug = function (request, next) {

    // Extract session debugging information

    if (request.server.settings.debug) {
        if (request.query[request.server.settings.debug.queryKey]) {
            delete request.url.search;
            delete request.query[request.server.settings.debug.queryKey];

            request.raw.req.url = Url.format(request.url);
            request.setUrl(request.raw.req.url);
        }
    }

    next();
};


