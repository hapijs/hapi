// Load modules

var Stream = require('stream');
var Url = require('url');
var Async = require('async');
var Boom = require('boom');
var Utils = require('./utils');
var Payload = require('./payload');
var State = require('./state');
var Auth = require('./auth');
var Validation = require('./validation');
var Response = require('./response');
var Cached = require('./response/cached');
var Closed = require('./response/closed');
var Ext = require('./ext');


// Declare internals

var internals = {};


exports = module.exports = internals.Request = function (server, req, res, options) {

    var now = Date.now();     // Take measurement as soon as possible

    Utils.assert(this.constructor === internals.Request, 'Request must be instantiated using new');
    Utils.assert(server, 'server must be provided');
    Utils.assert(req, 'req must be provided');
    Utils.assert(res, 'res must be provided');

    options = options || {};

    // Pause request

    req.pause();                // Must be done before switching event execution context

    // Public members

    this.server = server;
    this._setUrl(req.url);              // Sets: url, path, query
    this._setMethod(req.method);        // Sets: method
    this.id = now + '-' + process.pid + '-' + Math.floor(Math.random() * 0x10000);

    this.app = {};                      // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.plugins = {};                  // Place for plugins to store state without conflicts with hapi, should be namespaced using plugin name
    this.route = {};

    this.auth = {
        isAuthenticated: false,
        credentials: null,              // Special keys: 'app', 'user', 'scope', 'tos'
        artifacts: null                 // Scheme-specific artifacts
        // session: { set(), clear() }
    };

    this.session = null;                // Special key used by cookie auth as well as other extension session-based schemes (only one allowed)

    this.pre = {};
    this.info = {
        received: now,
        address: req.connection && req.connection.remoteAddress,
        referrer: req.headers.referrer || req.headers.referer
    };

    // Apply options

    if (options.credentials) {
        this.auth.credentials = options.credentials;
    }

    // Defined elsewhere:

    // query
    // params
    // rawBody
    // payload

    // state

    // setUrl()
    // setMethod()

    // reply(): { send(), close(), raw(), payload(), stream(), redirect(), view() }
    // response()

    // Semi-public members

    this.raw = {
        req: req,
        res: res
    };

    this.setState = this._setState;     // Remove once replied
    this.clearState = this._clearState;

    this.addTail = this._addTail;       // Removed once wagging

    // Private members

    this._timestamp = now;
    this._route = null;
    this._states = {};                  // Appended to response states when setting response headers
    this._logger = [];

    this._response = null;
    this._isReplied = false;

    this._tails = {};                   // tail id -> name (tracks pending tails)
    this._tailIds = 0;                  // Used to generate a unique tail id
    this._isWagging = false;            // true when request completed and only waiting on tails to complete

    this._paramsArray = [];             // Array of path parameters in path order

    // Log request

    var about = {
        id: this.id,
        method: this.method,
        url: this.url.href,
        agent: this.raw.req.headers['user-agent']
    };

    this._log(['received'], about, now);     // Must be last for object to be fully constructed

    return this;
};


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

    if (method) {
        this.method = method.toLowerCase();
    }
};


internals.Request.prototype._log = function (tags, data, timestamp) {

    this.log(['hapi'].concat(tags), data, timestamp);
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    tags = (tags instanceof Array ? tags : [tags]);

    // Prepare log item

    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());
    var item = {
        request: this.id,
        timestamp: now,
        tags: tags
    };

    var tagsMap = Utils.mapToObject(item.tags);

    if (data) {
        if (data instanceof Error) {
            item.tags = tags.concat('error');
            tagsMap.error = true;
            item.data = { message: data.message };
            if (tagsMap.uncaught) {
                item.data.trace = data.stack;
            }
        }
        else {
            item.data = data;
        }
    }

    // Add to request array

    this._logger.push(item);
    this.server.emit('request', this, item, tagsMap);

    if (this.server.listeners('request').length == 1 &&                 // Pack always listening
        this.server.settings.debug &&
        this.server.settings.debug.request &&
        Utils.intersect(tagsMap, this.server.settings.debug.request).length) {

        console.error(data.stack);
    }
};


internals.Request.prototype.getLog = function (tags) {

    if (tags === undefined) {       // Other falsy values are legal tags
        return this._logger;
    }

    var filter = Utils.mapToObject(tags instanceof Array ? tags : [tags]);
    var result = [];

    for (var i = 0, il = this._logger.length; i < il; ++i) {
        var event = this._logger[i];
        for (var t = 0, tl = event.tags.length; t < tl; ++t) {
            var tag = event.tags[t];
            if (filter[tag]) {
                result.push(event);
            }
        }
    }

    return result;
};


internals.Request.prototype._onRequestExt = function (callback) {

    var self = this;

    // Decorate request

    this.setUrl = this._setUrl;
    this.setMethod = this._setMethod;

    this.server._ext.invoke(this, 'onRequest', function (err) {

        // Undecorate request

        delete self.setUrl;
        delete self.setMethod;

        if (!err) {
            return callback();
        }

        // Send error response

        self._route = self.server._router.notfound;             // Only settings are used, not the handler
        self.route = self.server._router.notfound.settings;
        self._reply(err, function () {

            return callback(err);
        });
    });
};


internals.Request.prototype._execute = function (route) {

    var self = this;

    this._route = route;
    this.route = route.settings;

    var serverTimeout = self.server.settings.timeout.server;
    if (serverTimeout) {
        serverTimeout -= (Date.now() - self._timestamp);        // Calculate the timeout from when the request was constructed
        var timeoutReply = function () {

            self._reply(Boom.serverTimeout());
        };

        if (serverTimeout <= 0) {
            return timeoutReply();
        }

        self._serverTimeoutId = setTimeout(timeoutReply, serverTimeout);
    }

    var ext = function (event) {

        return function (request, next) {

            self.server._ext.invoke(self, event, next);
        };
    };

    var funcs = [
        // 'onRequest' in Server
        State.parseCookies,
        ext('onPreAuth'),
        Auth.authenticate,                                      // Authenticates the raw.req object
        internals.queryExtensions,
        Validation.query,
        Payload.read,
        Auth.authenticatePayload,
        Validation.payload,
        Validation.path,
        ext('onPreHandler'),
        internals.handler,                                      // Must not call next() with an Error
        ext('onPostHandler'),                                   // An error from here on will override any result set in handler()
        Validation.response
        // 'onPreResponse' in _reply                            // Always called
    ];

    Async.forEachSeries(funcs, function (func, next) {

        func(self, next);
    },
    function (err) {

        self._reply(err);
    });
};


internals.Request.prototype._reply = function (exit, callback) {

    var self = this;

    callback = callback || function () { };

    if (this._isReplied) {                                      // Prevent any future responses to this request
        return callback();
    }

    this._isReplied = true;

    clearTimeout(self._serverTimeoutId);

    var process = function () {

        if (self._response &&
            self._response.variety === 'closed') {

            self.raw.res.end();                                 // End the response in case it wasn't already closed
            return finalize();
        }

        if (exit) {
            override(exit);
        }

        self.server._ext.invoke(self, 'onPreResponse', function (err) {

            delete self.response;
            delete self.setState;
            delete self.clearState;

            if (err) {                                              // err can be valid response override
                override(err);
            }

            Response._respond(self._response, self, finalize);
        });
    };

    var override = function (value) {

        if (self._response &&
            !self._response.isBoom &&
            !self._response.varieties.error) {

            // Got error after valid result was already set

            self._route.cache.drop(self.url.path, function (err) {

                self._log(['cache', 'drop'], err);
            });
        }

        self._setResponse(Response.generate(value));
    };

    var finalize = function () {

        if (self._response &&
            ((self._response.isBoom && self._response.response.code === 500) ||
             (self._response.varieties && self._response.varieties.error && self._response._code === 500))) {

            var error = (self._response.isBoom ? self._response : self._response._err);
            self.server.emit('internalError', self, error);
            self._log(['internal'], error);
        }

        self.server.emit('response', self);

        self._isWagging = true;
        delete self.addTail;

        if (Object.keys(self._tails).length === 0) {
            self.server.emit('tail', self);
        }

        return callback();
    };

    process();
};


internals.queryExtensions = function (request, next) {

    // JSONP

    if (request.route.jsonp) {
        var jsonp = request.query[request.route.jsonp];
        if (jsonp) {
            if (!jsonp.match(/^[\w\$\[\]\.]+$/)) {
                return next(Boom.badRequest('Invalid JSONP parameter value'));
            }

            request.jsonp = jsonp;
            delete request.query[request.route.jsonp];
        }
    }

    return next();
};


internals.Request.prototype._replyInterface = function (callback, withProperties) {

    var self = this;

    // All the 'reply' methods execute inside a protected domain and can safetly throw

    var response = null;

    // Chain finalizers

    var process = function () {

        delete self.reply;
        return callback(response);
    };

    var reply = function (result) {

        Utils.assert(result instanceof Stream === false || !self.route.cache.mode.server, 'Cannot reply using a stream when caching enabled');
        response = Response.generate(result);
        process();
    };

    if (!withProperties) {
        return reply;
    }

    reply.send = function () {

        if (response === null) {
            response = Response.generate(null);
        }
        process();
    };

    if (!this.route.cache.mode.server) {
        reply.close = function () {

            response = new Closed();
            process();
        };
    }

    // Chain initializers

    reply.stream = function (stream) {

        Utils.assert(stream instanceof Stream, 'request.reply.stream() requires a stream');
        response = Response.generate(stream, process);
        return response;
    };

    reply.payload = function (result) {

        Utils.assert(result instanceof Stream === false, 'Must use request.reply.stream() with a Stream object');
        response = Response.generate(result, process);
        return response;
    };

    reply.raw = function (result) {

        response = Response.generate(new Response.Raw(self), process);
        return response;
    };

    reply.redirect = function (uri) {

        response = Response.generate(new Response.Redirection(uri), process);
        return response;
    };

    if (this.server._views ||
        this._route.env.views) {

        reply.view = function (template, context, options) {

            var viewsManager = self._route.env.views || self.server._views;
            response = Response.generate(new Response.View(viewsManager, template, context, options), process);
            return response;
        };
    }

    return reply;
};


internals.Request.bindPre = function (pre) {

    /*
        {
            method: function (request, next) {},
            assign: key,
            mode: parallel
        }
    */

    return function (request, callback) {

        Ext.runProtected(request._log.bind(request), 'pre', callback, function (run, next) {

            var timer = new Utils.Timer();
            var finalize = function (result) {

                if (result instanceof Error) {
                    request._log(['pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode, error: result });
                    return next(result);
                }

                request._log(['pre'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode });
                if (pre.assign) {
                    request.pre[pre.assign] = result;
                }

                return next();
            };

            run(function () {

                pre.method(request, finalize);
            });
        });
    };
};


internals.handler = function (request, next) {

    var check = function () {

        // Cached

        if (request.route.cache.mode.server) {
            return lookup();
        }

        // Not cached

        return generate(function (err, result) {

            return store(err || result);
        });
    };

    var lookup = function () {

        // Lookun in cache

        request._route.cache.getOrGenerate(request.url.path, generate, function (err, value, cached, report) {  // request.url.path contains query

            request._log(['cache', 'get'], report);

            if (err) {
                return store(err);
            }

            if (cached) {
                return store(new Cached(value, cached.ttl));
            }

            return store(value);
        });
    };

    var prerequisites = function (callback) {

        if (!request._route.prerequisites.parallel.length &&
            !request._route.prerequisites.serial.length) {

            return callback();
        }

        Async.series([
            function (nextSet) {

                Async.forEach(request._route.prerequisites.parallel, function (pre, nextPre) {

                    pre(request, nextPre);
                }, nextSet);
            },
            function (nextSet) {

                Async.forEachSeries(request._route.prerequisites.serial, function (pre, nextPre) {

                    pre(request, nextPre);
                }, nextSet);
            }
        ], function (err, results) {

            return callback(err);
        });
    };

    var generate = function (callback) {

        // Execute prerequisites

        prerequisites(function (err) {

            if (err) {
                return callback(err);
            }

            Ext.runProtected(request._log.bind(request), 'handler', callback, function (run, next) {

                var timer = new Utils.Timer();

                var finalize = function (response) {

                    // Check for Error result

                    if (response &&
                        (response.isBoom || response.varieties.error)) {

                        request._log(['handler', 'error'], { msec: timer.elapsed() });
                        return next(response);
                    }

                    if (request._route.cache.rule.strict) {
                        Utils.assert(response.varieties.cacheable, 'Attempted to cache non-cacheable item');    // Caught by the runProtected
                    }

                    request._log(['handler'], { msec: timer.elapsed() });
                    return next(null, response);
                };

                // Execute handler

                run(function () {

                    request.reply = request._replyInterface(finalize, true);
                    request.route.handler.call(request, request, request._replyInterface(finalize, false));
                });
            });
        });
    };

    var store = function (response) {

        request._setResponse(response);
        return next();                              // Must not include an argument
    };

    check();
};


internals.Request.prototype._setResponse = function (response) {

    var self = this;

    this._response = response;

    this.response = this.response || function () {

        return self._response;
    };
};


internals.Request.prototype._addTail = function (name) {

    var self = this;

    name = name || 'unknown';
    var tailId = this._tailIds++;
    this._tails[tailId] = name;
    this._log(['tail', 'add'], { name: name, id: tailId });

    var drop = function () {

        if (!self._tails[tailId]) {
            self._log(['tail', 'remove', 'error'], { name: name, id: tailId });             // Already removed
            return;
        }

        delete self._tails[tailId];

        if (Object.keys(self._tails).length === 0 &&
            self._isWagging) {

            self._log(['tail', 'remove', 'last'], { name: name, id: tailId });
            self.server.emit('tail', self);
        }
        else {
            self._log(['tail', 'remove'], { name: name, id: tailId });
        }
    };

    return drop;
};


internals.Request.prototype.removeTail = function (dropFunc) {

    dropFunc();
};


internals.Request.prototype._setState = function (name, value, options) {

    if (this._response &&
        this._response.state) {

        this._response.state(name, value, options);
    }
    else {
        Response.Base.prototype.state.call(this, name, value, options);
    }
};


internals.Request.prototype._clearState = function (name) {

    if (this._response &&
        this._response.unstate) {

        this._response.unstate(name);
    }
    else {
        Response.Base.prototype.unstate.call(this, name);
    }
};


internals.Request.prototype.generateView = function (template, context, options) {

    var viewsManager = this._route.env.views || this.server._views;
    Utils.assert(viewsManager, 'Cannot generate view without a views manager initialized');
    return new Response.View(viewsManager, template, context, options);
};

