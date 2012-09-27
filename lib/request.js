// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Url = require('url');
var Async = require('async');
var Shot = require('shot');
var Utils = require('./utils');
var Err = require('./error');
var Session = require('./session');
var Payload = require('./payload');
var Validation = require('./validation');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Request = function (server, req, res, options) {

    var now = Date.now();     // Take measurement as soon as possible

    Utils.assert(this.constructor === internals.Request, 'Request must be instantiated using new');

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Public members

    this.server = server;
    this._setUrl(req.url);              // Sets: url, path, query
    this._setMethod(req.method);        // Sets: method

    // Defined elsewhere:

    // query
    // params
    // rawBody
    // payload
    // session: { client, scope, user, tos }

    // reply()
    // created()
    // setUrl()
    // setMethod()
    // close()

    // Semi-public members

    this.response = {};                 // { result, created, injection }
    this.raw = {
        req: req,
        res: res
    };

    this.addTail = this._addTail;       // Removed once wagging

    // Private members

    this._route = null;
    this._isResponded = false;
    this._log = [];
    this._analytics = {
        startTime: now
    };

    this._tails = {};                   // tail id -> name (tracks pending tails)
    this._tailIds = 0;                  // Used to generate a unique tail id
    this._isWagging = false;            // true when request completed and only waiting on tails to complete

    // Extract session debugging information

    if (this.server.settings.debug) {
        if (this.query[this.server.settings.debug.queryKey]) {
            this._debug = this.query[this.server.settings.debug.queryKey];
        }
    }

    // Apply options

    if (options) {
        if (options.session) {
            this.session = options.session;
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


internals.Request.prototype._setUrl = function (url) {

    this.url = Url.parse(url, true);
    this.path = this.url.pathname;          // pathname excludes query
    this.query = this.url.query || {};
};


internals.Request.prototype._setMethod = function (method) {

    this.method = method.toLowerCase();
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    // Prepare log item

    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());
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


internals.Request.prototype._onRequestExt = function (func, callback) {

    // Decorate request

    this.setUrl = this._setUrl;
    this.setMethod = this._setMethod;

    Utils.executeRequestHandlers(func, this, function () {

        // Undecorate request

        delete this.setUrl;
        delete this.setMethod;

        callback();
    });
};


internals.Request.prototype._execute = function (route) {

    var self = this;

    if (!route) {
        // 404
        return this._unknown();
    }

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
        ext(this.server.settings.ext.onPreHandler),
        internals.handler,                              // Must not return Error
        ext(this.server.settings.ext.onPostHandler)
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(self, next);
    },
    function (err) {

        if (err) {
            self.response.result = err;
        }

        self._respond();

        Utils.executeRequestHandlers(self.server.settings.ext.onPostRoute, self, function () {

            self._wagTail();
        });
    });
};


internals.Request.prototype._unknown = function () {

    var self = this;

    if (!this.server.settings.ext.onUnknownRoute) {

        // No extension handler

        this.response.result = Err.notFound('No such path or method');
        this._respond();
        this._wagTail();
        return;
    }

    // Decorate request with extension helpers

    var undecorate = function () {

        delete self.reply;
        delete self.close;
    };

    this.reply = function (result) {

        self.response.result = result;
        undecorate();
        self._respond();
        self._wagTail();
    };

    this.close = function () {

        undecorate();

        self.log(['http', 'response', 'ext']);

        if (!self._isResponded) {
            self.server.emit('response', self);
            self._isResponded = true;
        }

        self._wagTail();
    };

    // Extension handler

    this.server.settings.ext.onUnknownRoute(this);
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

                    request._route.cache.set(request.url.path, record, function (err) {     // path contains query

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
            var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
            request.response.created = (isAbsolute ? url : request.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
        };

        request._route.config.handler(request);
    };

    if (request._route.cache) {
        timer.reset();

        request._route.cache.get(request.url.path, function (err, item) {       // path contains query

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

internals.Request.prototype._setCors = function (headers) {

    // Set CORS headers

    if (this.server.settings.cors &&
        (!this._route || this._route.config.cors !== false)) {

        headers['Access-Control-Allow-Origin'] = this.server.settings.cors._origin;
        headers['Access-Control-Max-Age'] = this.server.settings.cors.maxAge;
        headers['Access-Control-Allow-Methods'] = this.server.settings.cors._methods;
        headers['Access-Control-Allow-Headers'] = this.server.settings.cors._headers;
    }
};


internals.Request.prototype._respond = function () {

    var self = this;

    var code = 200;
    var headers = {};
    var data = null;

    var review = function () {

        self._setCors(headers);

        // Set caching headers
        headers['Cache-Control'] = 'must-revalidate';

        var result = self.response.result;
        if (result) {

            if (result instanceof Error) {
                code = result.code;
                self.log(['http', 'response', 'error'], result);
            }
            else {
                if (self.response.created) {
                    code = 201;
                    headers.Location = self.response.created;
                }

                self.log(['http', 'response']);
            }

            if (typeof result === 'object') {

                // Object

                if (result instanceof Error) {
                    if (self.server.settings.errors &&
                        self.server.settings.errors.format) {

                        self.server.settings.errors.format(result, function (formatted) {

                            inject(formatted);
                            var isString = (typeof formatted === 'string');
                            data = (isString ? formatted : JSON.stringify(formatted));
                            prepare(isString ? 'text/html' : 'application/json');
                        });
                    }
                    else {
                        var formatted = Err.format(result);
                        inject(formatted);
                        data = JSON.stringify(formatted);
                        prepare('application/json');
                    }
                }
                else {
                    inject(result);
                    data = JSON.stringify(result);
                    prepare('application/json');
                }
            }
            else {

                // Non-object (String, etc.)

                inject(result);
                data = (typeof result === 'string' ? result : JSON.stringify(result));
                prepare('text/html');
            }
        }
        else {
            inject(null);
            self.log(['http', 'response', 'empty']);
            send();
        }
    };

    var inject = function (result) {

        if (Shot.isInjection(self.raw.req)) {
            self.raw.res.hapi = { result: result };
        }
    };

    var prepare = function (contentType) {

        headers['Content-Type'] = contentType;

        if (data !== null) {                                                // data can be empty string
            headers['Content-Length'] = Buffer.byteLength(data);
        }

        send();
    };

    var send = function () {

        self.raw.res.writeHead(code, headers);
        self.raw.res.end(self.method !== 'head' ? data : '');

        if (!self._isResponded) {
            self.server.emit('response', self);
            self._isResponded = true;
        }
    };

    review();
};


internals.Request.prototype._addTail = function (name) {

    var self = this;

    name = name || 'unknown';
    var tailId = this._tailIds++;
    this._tails[tailId] = name;
    this.log(['tail', 'add'], { name: name, id: tailId });

    var drop = function () {

        if (!self._tails[tailId]) {
            // Already removed
            self.log(['tail', 'remove', 'error'], { name: name, id: tailId });
            return;
        }

        delete self._tails[tailId];
        self.log(['tail', 'remove'], { name: name, id: tailId });

        if (Object.keys(self._tails).length === 0 &&
            self._isWagging) {

            self.server.emit('tail', self);
        }
    };

    return drop;
};


internals.Request.prototype.removeTail = function (dropFunc) {

    dropFunc();
};


internals.Request.prototype._wagTail = function () {

    this._isWagging = true;
    delete this.addTail;

    if (Object.keys(this._tails).length === 0) {
        this.server.emit('tail', this);
    }
};


internals.processDebug = function (request, next) {

    // Extract session debugging information

    if (request.server.settings.debug) {
        if (request.query[request.server.settings.debug.queryKey]) {
            delete request.url.search;
            delete request.query[request.server.settings.debug.queryKey];

            request.raw.req.url = Url.format(request.url);
            request._setUrl(request.raw.req.url);
        }
    }

    next();
};


