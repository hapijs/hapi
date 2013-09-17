// Load modules

var Url = require('url');
var Boom = require('boom');
var Async = require('./async');
var Utils = require('./utils');
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
    Utils.assert(options, 'options must be provided');

    // Public members

    this.server = server;
    this.hapi = require('./');

    this.url = null;
    this.query = null;
    this.path = null;
    this.method = null;

    this.setUrl = this._setUrl;             // Decoration removed after 'onRequest'
    this.setMethod = this._setMethod;

    this.setUrl(req.url);                   // Sets: this.url, this.path, this.query
    this.setMethod(req.method);             // Sets: this.method

    this.id = now + '-' + process.pid + '-' + Math.floor(Math.random() * 0x10000);

    this.app = {};                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.plugins = {};                      // Place for plugins to store state without conflicts with hapi, should be namespaced using plugin name

    this._route = this.server._router.notfound;             // Used prior to routing (only settings are used, not the handler)
    this.route = this._route.settings;

    this.auth = {
        isAuthenticated: false,
        credentials: null,                  // Special keys: 'app', 'user', 'scope', 'tos'
        artifacts: null,                    // Scheme-specific artifacts
        session: null                       // Used by cookie auth { set(), clear() }
    };

    this.session = null;                    // Special key reserved for plugins implementing session support

    this.pre = {};
    this.info = {
        received: now,
        remoteAddress: (req.connection && req.connection.remoteAddress) || '',
        remotePort: (req.connection && req.connection.remotePort) || '',
        referrer: req.headers.referrer || req.headers.referer || '',
        host: req.headers.host ? req.headers.host.replace(/\s/g, '') : ''
    };

    this.info.address = this.info.remoteAddress;        // Backwards compatibility

    // Apply options

    if (options.credentials) {
        this.auth.credentials = options.credentials;
    }

    // Defined elsewhere:

    this.params = null;
    this.rawPayload = null;
    this.payload = null;
    this.state = null;
    this.jsonp = null;

    this.reply = null;          // this.reply(): { hold(), send(), close(), raw(), payload(), stream(), redirect(), view() }
    this.response = null;       // this.response()

    // Semi-public members

    this.raw = {
        req: req,
        res: res
    };

    this.setState = this._setState;                 // Remove once replied
    this.clearState = this._clearState;             // Remove once replied
    this.tail = this.addTail = this._addTail;       // Removed once wagging

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

    // Set socket timeout

    if (req.socket &&
        server.settings.timeout.socket !== undefined) {

        req.socket.setTimeout(server.settings.timeout.socket || 0);
    }

    // Log request

    var about = {
        id: this.id,
        method: this.method,
        url: this.url.href,
        agent: this.raw.req.headers['user-agent']
    };

    this.log(['hapi', 'received'], about, now);     // Must be last for object to be fully constructed
};


internals.Request.prototype._setUrl = function (url) {

    this.url = Url.parse(url, true);
    this.query = this.url.query || {};
    this.path = this.url.pathname;          // pathname excludes query

    if (this.path &&
        this.server.settings.router.normalizeRequestPath) {

        // Uppercase %encoded values

        var uppercase = this.path.replace(/%[0-9a-fA-F][0-9a-fA-F]/g, function (encoded) {

            return encoded.toUpperCase();
        });

        // Decode non-reserved path characters: a-z A-Z 0-9 _!$&'()*+,;=:@-.~
        // ! (%21) $ (%24) & (%26) ' (%27) ( (%28) ) (%29) * (%2A) + (%2B) , (%2C) - (%2D) . (%2E)
        // 0-9 (%30-39) : (%3A) ; (%3B) = (%3D)
        // @ (%40) A-Z (%41-5A) _ (%5F) a-z (%61-7A) ~ (%7E)

        var decoded = uppercase.replace(/%(?:2[146-9A-E]|3[\dABD]|4[\dA-F]|5[\dAF]|6[1-9A-F]|7[\dAE])/g, function (encoded) {

            return String.fromCharCode(parseInt(encoded.substring(1), 16));
        });

        this.path = decoded;
    }
};


internals.Request.prototype._setMethod = function (method) {

    if (method) {
        this.method = method.toLowerCase();
    }
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    tags = (Array.isArray(tags) ? tags : [tags]);

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

    if (this.server.settings.debug &&
        this.server.settings.debug.request &&
        Utils.intersect(tagsMap, this.server.settings.debug.request, true)) {

        console.error('Debug:', item.tags.join(', '), data ? (data.stack || data) : '');
    }
};


internals.Request.prototype.getLog = function (tags) {

    tags = [].concat(tags || []);
    if (!tags.length) {
        return this._logger;
    }

    var filter = Utils.mapToObject(tags);
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


internals.Request.prototype._execute = function () {

    // Execute onRequest extensions (can change request method and url)

    this.server._ext.invoke(this, 'onRequest', internals.onRequest);
};


internals.onRequest = function (err, request) {

    // Undecorate request

    delete request.setUrl;
    delete request.setMethod;

    if (err) {
        internals.reply(err, request);
        return;
    }

    if (!request.path || request.path[0] !== '/') {
        internals.reply(Boom.badRequest('Invalid path'), request);
        return;
    }

    // Lookup route

    request._route = request.server._router.route(request);
    request.route = request._route.settings;

    // Setup timer

    var serverTimeout = request.server.settings.timeout.server;
    if (serverTimeout) {
        serverTimeout -= (Date.now() - request._timestamp);        // Calculate the timeout from when the request was constructed
        var timeoutReply = function () {

            internals.reply(Boom.serverTimeout(), request);
        };

        if (serverTimeout <= 0) {
            return timeoutReply();
        }

        request._serverTimeoutId = setTimeout(timeoutReply, serverTimeout);
    }

    Async.forEachSeriesContext(request._route.cycle, request, internals.cycle, internals.reply);
};


internals.cycle = function (func, request, next) {

    if (request._isReplied) {
        request.log(['hapi', 'server', 'timeout']);
        return next(true);                                  // Argument is ignored but aborts the series
    }

    if (typeof func === 'string') {
        request.server._ext.invoke(request, func, next);
        return;
    }

    func(request, next);
};


internals.reply = function (exit, request) {

    if (request._isReplied) {                                      // Prevent any future responses to this request
        return;
    }

    request._isReplied = true;

    clearTimeout(request._serverTimeoutId);

    if (request._response &&
        request._response.variety === 'closed') {

        request.raw.res.end();                                 // End the response in case it wasn't already closed
        return Utils.nextTick(internals.reply.finalize)(request);
    }

    if (exit) {
        internals.reply.override(request, exit);
    }

    request.server._ext.invoke(request, 'onPreResponse', internals.onPreResponse);
};


internals.onPreResponse = function (err, request) {

    delete request.response;
    delete request.setState;
    delete request.clearState;

    if (err) {                                              // err can be valid response override
        internals.reply.override(request, err);
    }

    Response._respond(request._response, request, internals.reply.finalize);
};


internals.reply.override = function (request, value) {

    if (request._response &&
        !request._response.isBoom &&
        !request._response.varieties.error) {

        // Got error after valid result was already set

        request._route.cache.drop(request.url.path, function (err) {

            request.log(['hapi', 'cache', 'drop'], err);
        });
    }

    request._setResponse(Response._generate(value));
};


internals.reply.finalize = function (request) {

    request.server._dtrace.report('request.finalize', request._response);
    if (request._response &&
        ((request._response.isBoom && request._response.response.code === 500) ||
         (request._response.varieties && request._response.varieties.error && request._response._code === 500))) {

        var error = (request._response.isBoom ? request._response : request._response._err);
        request.server.emit('internalError', request, error);
        request.log(['hapi', 'internal'], error);
    }

    request.server.emit('response', request);

    request._isWagging = true;
    delete request.addTail;
    delete request.tail;

    if (Object.keys(request._tails).length === 0) {
        request.server.emit('tail', request);
    }

    request.raw.req.removeAllListeners();
    request.raw.res.removeAllListeners();
};


internals.Request.parseJSONP = function (request, next) {

    var jsonp = request.query[request.route.jsonp];
    if (jsonp) {
        if (!jsonp.match(/^[\w\$\[\]\.]+$/)) {
            return next(Boom.badRequest('Invalid JSONP parameter value'));
        }

        request.jsonp = jsonp;
        delete request.query[request.route.jsonp];
    }

    return next();
};


internals.Request.bindPre = function (pre) {

    /*
        {
            method: function (request, next) { }
            assign:     'key'
            mode:       'serial'*   | 'parallel'
            type:       'pre'*      | 'handler'
            output:     'raw'*      | 'response'
            failAction: 'error'*    | 'log'         | 'ignore'
        }
    */

    return function (request, next) {

        Ext.runProtected(request.log.bind(request), 'pre', next, function (enter, exit) {

            var timer = new Utils.Timer();
            var finalize = function (result) {

                request._undecorateReply();

                if (result instanceof Error) {
                    if (pre.failAction !== 'ignore') {
                        request.log(['hapi', 'pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode, error: result });
                    }

                    if (pre.failAction === 'error') {
                        return exit(result);
                    }
                }
                else {
                    request.log(['hapi', 'pre'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode });
                }

                var output = (!result.hasOwnProperty('_rawResult') || pre.output === 'response' ? result : result._rawResult);
                if (pre.assign) {
                    request.pre[pre.assign] = output;
                }

                request.server._dtrace.report('pre.end', pre.assign, output);
                return exit();
            };

            enter(function () {

                request.server._dtrace.report('pre.start', pre.assign);
                if (pre.type === 'handler') {
                    request._decorateReply(finalize);
                }

                pre.method.call(request, request, pre.type === 'handler' ? request.reply : finalize);
            });
        });
    };
};


internals.Request.handler = function (request, next) {

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

        // Lookup in cache

        request._route.cache.getOrGenerate(request.url.path, generate, function (err, value, cached, report) {  // request.url.path contains query

            request.log(['hapi', 'cache', 'get'], report);

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

            return Utils.nextTick(callback)();
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
        ], function (err) {

            return callback(err);
        });
    };

    var generate = function (callback) {

        // Execute prerequisites

        prerequisites(function (err) {

            if (err) {
                return callback(err);
            }

            Ext.runProtected(request.log.bind(request), 'handler', callback, function (enter, exit) {

                var timer = new Utils.Timer();

                var isFinalized = false;
                var finalize = function (response) {

                    if (isFinalized) {
                        return;
                    }

                    isFinalized = true;

                    request._undecorateReply();

                    // Check for Error result

                    if (response &&
                        (response.isBoom || response.varieties.error)) {

                        request.log(['hapi', 'handler', 'error'], { msec: timer.elapsed() });
                        return exit(response);
                    }

                    request.log(['hapi', 'handler'], { msec: timer.elapsed() });
                    return exit(null, response, !response.varieties.cacheable);
                };

                // Decorate request

                request._decorateReply(finalize);

                // Execute handler

                enter(function () {

                    request.server._dtrace.report('request.handler', request);
                    request.route.handler.call(request, request, request.reply);
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


internals.Request.prototype._decorateReply = function (finalize) {

    this.context = (this.route.context || this._route.env.context);

    this.reply = function (result) {

        return Response._generate(result, finalize);
    };

    this.reply.close = function () {

        finalize(new Closed());
    };

    this.reply.redirect = function (uri) {

        return Response._generate(new Response.Redirection(uri), finalize);
    };

    var viewsManager = this._route.env.views || this.server._views;
    if (viewsManager) {
        this.reply.view = function (template, context, options) {

            return Response._generate(new Response.View(viewsManager, template, context, options), finalize);
        };
    }
};


internals.Request.prototype._undecorateReply = function () {

    delete this.context;
    delete this.reply;
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
    this.log(['hapi', 'tail', 'add'], { name: name, id: tailId });

    var drop = function () {

        if (!self._tails[tailId]) {
            self.log(['hapi', 'tail', 'remove', 'error'], { name: name, id: tailId });             // Already removed
            return;
        }

        delete self._tails[tailId];

        if (Object.keys(self._tails).length === 0 &&
            self._isWagging) {

            self.log(['hapi', 'tail', 'remove', 'last'], { name: name, id: tailId });
            self.server.emit('tail', self);
        }
        else {
            self.log(['hapi', 'tail', 'remove'], { name: name, id: tailId });
        }
    };

    return drop;
};


internals.Request.prototype._setState = function (name, value, options) {

    if (this._response &&
        this._response.state) {

        this._response.state(name, value, options);
    }
    else {
        Response.Generic.prototype.state.call(this, name, value, options);
    }
};


internals.Request.prototype._clearState = function (name) {

    if (this._response &&
        this._response.unstate) {

        this._response.unstate(name);
    }
    else {
        Response.Generic.prototype.unstate.call(this, name);
    }
};


internals.Request.prototype.generateView = function (template, context, options) {

    var viewsManager = this._route.env.views || this.server._views;
    Utils.assert(viewsManager, 'Cannot generate view without a views manager initialized');
    return new Response.View(viewsManager, template, context, options);
};

