// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Stream = require('stream');
var Url = require('url');
var Async = require('async');
var Utils = require('./utils');
var Err = require('./error');
var Payload = require('./payload');
var Validation = require('./validation');
var Cache = require('./cache');
var Response = require('./response');
var ResponseCache = require('./response/cache');


// Declare internals

var internals = {};


exports = module.exports = internals.Request = function (server, req, res, options) {

    var now = Date.now();     // Take measurement as soon as possible

    Utils.assert(this.constructor === internals.Request, 'Request must be instantiated using new');
    Utils.assert(server, 'server must be provided');
    Utils.assert(req, 'req must be provided');
    Utils.assert(res, 'res must be provided');

    // Pause request

    req.pause();                // Must be done before switching event execution context

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
    // session: { id, [app], [scope], [user], [ext.tos] }

    // setUrl()
    // setMethod()

    // reply(): { payload(), stream() }
    // close()

    // Semi-public members

    this.pre = {};

    this.raw = {
        req: req,
        res: res
    };

    this.addTail = this._addTail;       // Removed once wagging

    // Private members

    this._route = null;
    this._response = null;
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

    if (this.server._debugConsole) {
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
        internals.authenticate,
        internals.processDebug,
        Validation.query,
        Payload.read,
        Validation.payload,
        Validation.path,
        ext(this.server.settings.ext.onPreHandler),
        internals.handler,                              // Must not call next() with an Error
        ext(this.server.settings.ext.onPostHandler),    // An error from here on will override any result set in handler()
        Validation.response
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(self, next);
    },
    function (err) {

        if (err) {
            if (self._response &&
                !(self._response instanceof Error)) {

                // Got error after valid result was already set

                self._route.cache.drop(self.url.path, function (err) {

                    if (err) {
                        self.log(['request', 'cache', 'drop', 'error'], { error: err.message });
                    }
                });
            }

            self._response = err;
        }

        self._respond();

        Utils.executeRequestHandlers(self.server.settings.ext.onPostRoute, self, function () {

            self._wagTail();
        });
    });
};


internals.authenticate = function (request, next) {

    var config = request._route.config.auth;
    if (config.mode === 'none') {
        return next();
    }

    return request.server.auth.authenticate(request, next);
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


internals.Request.prototype._decorate = function (callback) {

    var self = this;

    var response = null;

    // Utilities

    var setResponse = function (result, process) {

        if (!(result instanceof Stream) &&
            self.server.settings.format.payload) {

            result = self.server.settings.format.payload(result);
        }

        response = Response.generate(result, process);
    };

    // Chain finalizers

    var process = function () {

        self._undecorate();
        return callback(response);
    };

    this.reply = function (result) {

        Utils.assert(!(result instanceof Stream) || !self._route || !self._route.cache.isMode('server'), 'Cannot reply using a stream when caching enabled');
        setResponse(result);
        process();
    };

    this.reply.send = function () {

        if (response === null) {
            setResponse(null);
        }
        process();
    };

    // Chain initializers

    this.reply.stream = function (stream) {

        Utils.assert(stream instanceof Stream, 'request.reply.stream() requires a stream');
        setResponse(stream, process);
        return response;
    };

    this.reply.payload = function (result) {

        Utils.assert(!(result instanceof Stream), 'Must use request.reply.stream() with a Stream object');
        setResponse(result, process);
        return response;
    };
};


internals.Request.prototype._undecorate = function () {

    delete this.reply;
};


internals.Request.prototype._unknown = function () {

    var self = this;

    if (!this.server.settings.ext.onUnknownRoute) {

        // No extension handler

        this._response = Err.notFound('No such path or method ' + this.path);
        this._respond();
        this._wagTail();
        return;
    }

    // Decorate request with extension helpers

    this._decorate(function (response) {

        // Called when reply...send() or reply() is called

        self._response = response;
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


internals.handler = function (request, next) {

    var lookup = function () {

        var logFunc = function () {

            return request.log.apply(request, arguments);
        };

        request._route.cache.getOrGenerate(request.url.path, logFunc, generate, function (response, cached) {  // request.url.path contains query

            if (cached &&
                !(response instanceof Error)) {

                response = new ResponseCache(response, cached.ttl);
            }

            // Store response

            request._response = response;
            return next();
        });
    };

    var generate = function (callback) {

        // Execute prerequisites

        request._prerequisites(function (err) {

            if (err) {
                return callback(err);
            }

            // Decorate request with helper functions

            var timer = new Utils.Timer();
            request._decorate(function (response) {

                // Check for Error result

                if (response instanceof Error) {
                    request.log(['handler', 'result', 'error'], { msec: timer.elapsed() });
                    return callback(response);
                }

                request.log(['handler', 'result'], { msec: timer.elapsed() });
                var ttl = (response instanceof Response.Cacheable ? response.options.ttl : 0);      // null/undefined: cache defaults, 0: not cached
                return callback(null, response, ttl);
            });

            // Execute handler

            request._route.config.handler(request);
        });
    };

    lookup();
};


internals.Request.prototype._respond = function () {

    var self = this;

    Response._respond(this._response, this, function () {

        if (!self._isResponded) {
            self.server.emit('response', self);
            self._isResponded = true;
        }
    });
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
