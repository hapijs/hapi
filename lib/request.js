// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Stream = require('stream');
var Url = require('url');
var Async = require('async');
var Shot = require('shot');
var Utils = require('./utils');
var Err = require('./error');
var Session = require('./session');
var Payload = require('./payload');
var Validation = require('./validation');
var Cache = require('./cache');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Request = function (server, req, res, options) {

    var now = Date.now();     // Take measurement as soon as possible

    Utils.assert(this.constructor === internals.Request, 'Request must be instantiated using new');
    Utils.assert(server, 'server must be provided');
    Utils.assert(req, 'req must be provided');
    Utils.assert(res, 'res must be provided');

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

    // setUrl()
    // setMethod()

    // reply(): { pipe() }
    // close()

    // Semi-public members

    this.pre = {};
    this.response = {
        result: null,
        options: {}         // created, contentType, contentLength
        // injection
    };

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

    this.log(['http', 'received'], about, now);
    return this;
};

NodeUtil.inherits(internals.Request, Events.EventEmitter);


internals.Request.prototype._setUrl = function (url) {

    Utils.assert(url, 'url must be provided');

    this.url = Url.parse(url, true);
    this.path = this.url.pathname;          // pathname excludes query
    this.query = this.url.query || {};
};


internals.Request.prototype._setMethod = function (method) {

    Utils.assert(method, 'method must be provided');
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


internals.Request.prototype.getLog = function (tags) {

    if (tags === undefined) {       // Other falsy values are legal tags
        return this._log;
    }

    var filter = Utils.mapToObject(tags instanceof Array ? tags : [tags]);
    var result = [];

    for (var i = 0, il = this._log.length; i < il; ++i) {
        var event = this._log[i];
        for (var t = 0, tl = event.tags.length; t < tl; ++t) {
            var tag = event.tags[t];
            if (filter[tag]) {
                result.push(event);
            }
        }
    }

    return result;
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
        // ext.onRequest() in Server
        Session.authenticate,
        internals.processDebug,
        Validation.query,
        Payload.read,
        Validation.payload,
        ext(this.server.settings.ext.onPreHandler),
        internals.handler,                              // Must not call next() with an Error
        ext(this.server.settings.ext.onPostHandler),    // An error from onPostHandler will override any result set in handler()
        Validation.response
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(self, next);
    },
    function (err) {

        if (err) {
            if (self.response.result) {
                // Got error after result was already set
                self._route.cache.drop(self.url.path, function (err) {
                    if (err) {
                        self.log(['request', 'cache', 'drop', 'error'], { error: err.message });
                    }
                });
            }

            self.response.result = err;
            self.response.options = {};
        }

        self._respond();

        Utils.executeRequestHandlers(self.server.settings.ext.onPostRoute, self, function () {

            self._wagTail();
        });
    });
};


internals.Request.prototype._decorate = function (callback) {

    var self = this;

    var response = {
        result: null,
        options: {}
    };

    var process = function (result) {

        self._undecorate();
        response.result = result;

        return callback(response);
    };

    // Chain finalizers

    this.reply = function (result) {

        Utils.assert(!(result instanceof Stream), 'Cannot take a stream');
        Utils.assert(response.options.contentLength === undefined, 'Does not support custom content length');
        process(result);
    };

    this.reply.send = function (result) {

        self.reply(result);
    };

    this.reply.stream = function (stream, options) {

        Utils.assert(stream instanceof Stream, 'request.reply.stream() requires a stream');
        Utils.assert(!self._route || !self._route.cache.isMode('server'), 'Cannot reply using a stream when caching enabled');
        process(stream);
    };

    // Chain properties

    this.reply.created = function (uri) {

        Utils.assert(self.method === 'post' || self.method === 'put', 'Cannot create resource from a non-POST/PUT handler');
        var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
        response.options.created = (isAbsolute ? uri : self.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
        return self.reply;
    };

    this.reply.type = function (type) {

        response.options.contentType = type;
        return self.reply;
    };

    this.reply.bytes = function (bytes) {

        response.options.contentLength = bytes;
        return self.reply;
    };

    this.reply.ttl = function (msec) {

        Utils.assert(self._route.cache.isEnabled(), 'Cannot set ttl when route caching is not enabled');
        response.options.ttl = msec;
        return self.reply;
    };

    this.reply.header = function (name, value) {

        response.options.headers = response.options.headers || {};
        response.options.headers[name] = value;
        return self.reply;
    };
};


internals.Request.prototype._undecorate = function () {

    delete this.reply;
};


internals.Request.prototype._unknown = function () {

    var self = this;

    if (!this.server.settings.ext.onUnknownRoute) {

        // No extension handler

        this.response.result = Err.notFound('No such path or method ' + this.path);
        this._respond();
        this._wagTail();
        return;
    }

    // Decorate request with extension helpers

    this._decorate(function (response) {

        // Called when reply.send() or .pipe() is called

        self.response.result = response.result;
        self.response.options = response.options;

        self._respond();
        self._wagTail();
    });

    // Unknown-specific chain finalizer

    this.reply.close = function () {

        self._undecorate();

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

    // Log interface helper

    var logFunc = function () {

        return request.log.apply(request, arguments);
    };

    // Get from cache

    request._route.cache.getOrGenerate(request.url.path, logFunc, request._generateResponse(), function (response, cached) {  // request.url.path contains query

        // Store response

        request.response.result = response.result;
        request.response.options = response.options;

        // Set TTL

        if (cached) {
            request.response.options.ttl = cached.ttl;
        }
        else if (request._route.cache.isMode('client')) {
            request.response.options.ttl = request.response.options.ttl || request._route.cache.ttl();
        }

        return next();
    });
};


internals.Request.prototype._generateResponse = function () {

    var self = this;

    return function (callback) {

        // Execute prerequisites

        self._prerequisites(function (err) {

            if (err) {
                return callback(err);
            }

            // Decorate request with helper functions

            var timer = new Utils.Timer();
            self._decorate(function (response) {

                // Check for Error result

                if (response instanceof Error) {
                    self.log(['handler', 'result', 'error'], { msec: timer.elapsed() });
                    return callback(response);
                }

                self.log(['handler', 'result'], { msec: timer.elapsed() });
                return callback(null, response, response.options.ttl);
            });

            // Execute handler

            self._route.config.handler(self);
        });
    };
};


internals.Request.prototype._prerequisites = function (next) {

    var self = this;

    if (this._route.prerequisites.length === 0) {
        return next();
    }

    /*
        {
            method: function (request, next) {},
            assign: key,
            mode: parallel
        }
    */

    var parallelFuncs = [];
    var serialFuncs = [];

    var fetch = function (pre) {

        return function (callback) {

            var timer = new Utils.Timer();
            pre.method(self, function (result) {

                if (result instanceof Error) {
                    self.log(['prerequisites', 'error'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode, error: result });
                    return callback(result);
                }

                self.log(['prerequisites'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode });
                if (pre.assign) {
                    self.pre[pre.assign] = result;
                }
                callback();
            });
        };
    };

    for (var i = 0, il = self._route.prerequisites.length; i < il; ++i) {

        var pre = self._route.prerequisites[i];
        var list = (pre.mode === 'parallel' ? parallelFuncs : serialFuncs);
        list.push(fetch(pre));
    }

    Async.series([
        function (callback) {

            Async.parallel(parallelFuncs, callback);
        },
        function (callback) {

            Async.series(serialFuncs, callback);
        }
    ], function (err, results) {

        return next(err);
    });
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


// Set cache response headers

internals.Request.prototype._setCache = function (headers) {

    if (this._route &&
        this._route.cache.isMode('client') &&
        this.response.options.ttl &&
        !(this.response.result instanceof Error)) {

        headers['Cache-Control'] = 'max-age=' + Math.floor(this.response.options.ttl / 1000);       // Convert MSec ttl to Sec in HTTP header
    }
    else {
        headers['Cache-Control'] = 'must-revalidate';
    }
};


internals.Request.prototype._respond = function () {

    var self = this;

    var code = 200;
    var headers = this.response.options.headers || {};
    var data = null;

    var review = function () {

        self._setCors(headers);
        self._setCache(headers);

        var result = self.response.result;
        if (result) {

            // Response code and headers

            if (result instanceof Error) {
                code = result.code;
                self.log(['http', 'response', 'error'], result);
            }
            else {
                if (self.response.options.created) {
                    code = 201;
                    headers.Location = self.response.options.created;
                }

                if (self.response.options.contentType) {
                    headers['Content-Type'] = self.response.options.contentType;
                }

                if (self.response.options.contentLength) {
                    headers['Content-Length'] = self.response.options.contentLength;
                }

                self.log(['http', 'response']);
            }

            // Payload

            if (typeof result === 'object') {

                // Object

                if (result instanceof Error) {

                    // Error

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
                else if (result instanceof Stream) {

                    // Stream

                    data = result;
                    self.log(['http', 'response', 'stream']);
                    stream();
                }
                else {

                    // Object

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

        if (!headers['Content-Type']) {
            headers['Content-Type'] = contentType;
        }

        if (data !== null &&
            !headers['Content-Length']) {                                       // data can be empty string

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

    var stream = function () {

        // Check if data is a node HTTP response (data.*) or a (mikeal's) Request object (data.response.*)

        if (!self._route ||
            !self._route.config.proxy ||
            self._route.config.proxy.passThrough) {     // Pass headers only if not proxy or proxy with pass-through set

            var responseHeaders = data.response ? data.response.headers : data.headers;
            if (responseHeaders) {
                Utils.merge(headers, responseHeaders);
            }
        }

        code = data.statusCode || ((data.response && data.response.code) ? data.response.code : code);

        self.raw.res.writeHead(code, headers);

        self.raw.req.on('close', function () {

            data.destroy.bind(data);
        });

        data.on('error', function () {

            self.raw.req.destroy();
        });

        data.on('end', function () {

            self.raw.res.end();
        });

        data.pipe(self.raw.res);
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

        if (Object.keys(self._tails).length === 0 &&
            self._isWagging) {

            self.log(['tail', 'remove', 'last'], { name: name, id: tailId });
            self.server.emit('tail', self);
        }
        else {
            self.log(['tail', 'remove'], { name: name, id: tailId });
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
        this.log(['tail', 'empty']);
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

    return next();
};




