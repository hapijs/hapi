// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Path = require('path');
var Stream = require('stream');
var Url = require('url');
var Async = require('async');
var Utils = require('./utils');
var Err = require('./error');
var Payload = require('./payload');
var State = require('./state');
var Validation = require('./validation');
var Response = require('./response');
var Cached = require('./response/cached');


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
    this.id = now + '-' + process.pid + '-' + Math.floor(Math.random() * 0x10000);

    // Defined elsewhere:

    // query
    // params
    // rawBody
    // payload
    // session: { id, [app], [scope], [user], [ext.tos] }
    // state

    // setUrl()
    // setMethod()

    // reply(): { payload(), stream(), redirect(), view() }

    // Semi-public members

    this.pre = {};

    this.raw = {
        req: req,
        res: res
    };

    this.addTail = this._addTail;       // Removed once wagging

    // Private members

    this._timestamp = now;
    this._isReplied = false;
    this._route = null;
    this._response = null;
    this._log = [];
    this._analytics = {
        startTime: now
    };

    this._tails = {};                   // tail id -> name (tracks pending tails)
    this._tailIds = 0;                  // Used to generate a unique tail id
    this._isWagging = false;            // true when request completed and only waiting on tails to complete

    this._paramsArray = [];             // Array of path parameters in path order

    // Extract session debugging information

    if (this.server.settings.debug) {
        if (this.query[this.server.settings.debug.queryKey]) {
            this._debug = this.query[this.server.settings.debug.queryKey];
        }
    }

    // Apply options

    if (options &&
        options.session) {

        this.session = options.session;
    }

    // Log request

    var about = {
        id: this.id,
        method: this.method,
        url: this.url.href,
        agent: this.raw.req.headers['user-agent']
    };

    this.log(['http', 'received'], about, now);
    return this;
};

NodeUtil.inherits(internals.Request, Events.EventEmitter);


internals.Request.prototype._setUrl = function (url) {

    this.url = Url.parse(url, true);
    this.query = this.url.query || {};
    this.path = this.url.pathname;          // pathname excludes query

    if (this.path &&
        this.server.settings.router.normalizeRequestPath) {

        // Uppercase %encoded values

        var uppercase = this.path.replace(/%[0-9a-fA-F][0-9a-fA-F]/g, function (encoded) { return encoded.toUpperCase(); });

        // Decode non-reserved path characters: a-z A-Z 0-9 _!$&'()*+,;=:@-.~
        // ! (%21) $ (%24) & (%26) ' (%27) ( (%28) ) (%29) * (%2A) + (%2B) , (%2C) - (%2D) . (%2E)
        // 0-9 (%30-39) : (%3A) ; (%3B) = (%3D)
        // @ (%40) A-Z (%41-5A) _ (%5F) a-z (%61-7A) ~ (%7E)

        var decoded = uppercase.replace(/%(?:2[146-9A-E]|3[\dABD]|4[\dA-F]|5[\dAF]|6[1-9A-F]|7[\dAE])/g, function (encoded) { return String.fromCharCode(parseInt(encoded.substring(1), 16)); });
        this.path = decoded;
    }
};


internals.Request.prototype._setMethod = function (method) {

    Utils.assert(method, 'method must be provided');
    this.method = method.toLowerCase();
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    // Prepare log item

    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());
    var item = {
        request: this.id,
        timestamp: now,
        tags: (tags instanceof Array ? tags : [tags])
    };

    if (data) {
        if (data instanceof Error) {
            tags = tags.concat('error');
            item.data = { message: data.message };
        }
        else {
            item.data = data;
        }
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


internals.Request.prototype._ext = function (event, callback) {

    var self = this;

    var handlers = this.server._ext[event];         // onRequest, onPreHandler, onPostHandler
    if (!handlers) {
        return callback();
    }

    Async.forEachSeries(handlers, function (func, next) {

        func(self, next);
    },
    function (err) {

        return callback(err);
    });
};


internals.Request.prototype._onRequestExt = function (callback) {

    var self = this;

    // Decorate request

    this.setUrl = this._setUrl;
    this.setMethod = this._setMethod;

    this._ext('onRequest', function (err) {

        // Undecorate request

        delete self.setUrl;
        delete self.setMethod;

        if (!err) {
            return callback();
        }

        // Send error response

        self._route = self.server._router.notFound;             // Only settings are used, not the handler
        self._reply(err, function () {

            return callback(err);
        });
    });
};


internals.Request.prototype._execute = function (route) {

    var self = this;

    this._route = route;

    var serverTimeout = self.server.settings.timeout.server;
    if (serverTimeout) {
        serverTimeout -= (Date.now() - self._timestamp);        // Calculate the timeout from when the request was constructed
        var timeoutReply = function () {

            self._reply(Err.serverTimeout());
        };

        if (serverTimeout <= 0) {
            return timeoutReply();
        }

        self._serverTimeoutId = setTimeout(timeoutReply, serverTimeout);
    }

    var ext = function (event) { return function (request, next) { self._ext(event, next); }; };            // Handler wrappers

    var funcs = [
        // 'onRequest' in Server
        internals.authenticate,
        internals.processDebug,
        Validation.query,
        State.parseCookies,
        Payload.read,
        internals.authValidatePayload,
        Validation.payload,
        Validation.path,
        ext('onPreHandler'),
        internals.handler,                                      // Must not call next() with an Error
        ext('onPostHandler'),                                   // An error from here on will override any result set in handler()
        Validation.response
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(self, next);
    }, 
    function (err) {
     
        self._reply(err);
    });
};


internals.Request.prototype._reply = function (err, callback) {

    var self = this;

    callback = callback || function () { };

    if (this._isReplied) {                                      // Prevent any future responses to this request
        return callback();
    }

    this._isReplied = true;
    clearTimeout(self._serverTimeoutId);

    // Error exit

    if (err) {
        if (self._response &&
            self._response instanceof Error === false) {

            // Got error after valid result was already set

            self._route.cache.drop(self.url.path, function (err) {

                self.log(['request', 'cache', 'drop'], err);
            });
        }

        self._response = self._generateResponse(err);
    }

    var sendResponse = function () {

        if (!self._response) {                                  // Can only happen when request.reply.close() is called
            self.raw.res.end();                                 // End the response in case it wasn't already closed
            return finalize();
        }

        Response._respond(self._response, self, function () {

            return finalize();
        });
    };

    var finalize = function () {

        self.server.emit('response', self);

        self._isWagging = true;
        delete self.addTail;

        if (Object.keys(self._tails).length === 0) {
            self.server.emit('tail', self);
        }

        return callback();
    };

    sendResponse();
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


internals.authValidatePayload = function (request, next) {

    var config = request._route.config.auth;
    if (config.payload === 'none' || !request.session) {
        return next();
    }
    else if (config.payload === 'optional' && (!request.session || !request.session.hash)) {
        return next();
    }

    return request.server.auth.validatePayload(request, next);
};


internals.Request.prototype._generateResponse = function (result, onSend) {

    if (result instanceof Stream === false &&
        this.server.settings.format.payload) {

        result = this.server.settings.format.payload(result);
    }

    return Response.generate(result, onSend);
};


internals.Request.prototype._decorate = function (callback) {

    var self = this;

    var response = null;

    // Chain finalizers

    var process = function () {

        delete this.reply;
        return callback(response);
    };

    this.reply = function (result) {

        Utils.assert(result instanceof Stream === false || !self._route.cache.isMode('server'), 'Cannot reply using a stream when caching enabled');
        response = self._generateResponse(result);
        process();
    };

    this.reply.send = function () {

        if (response === null) {
            response = self._generateResponse(null);
        }
        process();
    };

    if (!this._route.cache.isMode('server')) {
        this.reply.close = function () {

            process();
        };
    }

    // Chain initializers

    this.reply.stream = function (stream) {

        Utils.assert(stream instanceof Stream, 'request.reply.stream() requires a stream');
        response = self._generateResponse(stream, process);
        return response;
    };

    this.reply.payload = function (result) {

        Utils.assert(result instanceof Stream === false, 'Must use request.reply.stream() with a Stream object');
        response = self._generateResponse(result, process);
        return response;
    };

    this.reply.raw = function (result) {

        response = self._generateResponse(new Response.Raw(self), process);
        return response;
    };

    this.reply.redirect = function (uri) {

        response = self._generateResponse(new Response.Redirection(uri), process);
        return response;
    };

    if (this.server.settings.views) {
        this.reply.view = function (template, context, options) {

            response = self._generateResponse(new Response.View(self.server.views, template, context, options), process);
            return response;
        };
    }
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

    var check = function () {

        // Cached

        if (request._route.cache.isMode('server')) {
            return lookup();
        }

        // Not cached

        return generate(function (err, result) {

            return store(err || result);
        });
    };

    var lookup = function () {

        // Lookun in cache

        var logFunc = function () {

            return request.log.apply(request, arguments);
        };

        request._route.cache.getOrGenerate(request.url.path, logFunc, generate, function (response, cached) {  // request.url.path contains query

            if (cached &&
                response instanceof Error === false) {

                response = new Cached(response, cached.ttl);
            }

            return store(response);
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

                if (request._route.cache.rule.strict) {
                    Utils.assert(response instanceof Response.Cacheable, 'Attempted to cache non-cacheable item');
                }

                request.log(['handler', 'result'], { msec: timer.elapsed() });
                return callback(null, response);
            });

            // Execute handler

            request._route.config.handler.call(request, request);
        });
    };

    var store = function (response) {

        request._response = response;
        return next();                              // Must not include an argument
    };

    check();
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


