// Load modules

var Url = require('url');
var Events = require('events');
var Stream = require('stream');
var Qs = require('qs');
var Async = require('async');
var Boom = require('boom');
var Utils = require('./utils');
var Response = require('./response');
var Ext = require('./ext');
var Handler = require('./handler');


// Declare internals

var internals = {};


exports = module.exports = internals.Request = function (server, req, res, options) {

    var self = this;

    Events.EventEmitter.call(this);

    // Take measurement as soon as possible

    this._bench = new Utils.Bench();
    var now = Date.now();

    // Public members

    this.server = server;
    this.hapi = require('./');

    this.url = null;
    this.query = null;
    this.path = null;
    this.method = null;
    this.mime = null;                       // Set if payload is parsed

    this.setUrl = this._setUrl;             // Decoration removed after 'onRequest'
    this.setMethod = this._setMethod;

    this._pathSegments = null;
    this.setUrl(req.url);                   // Sets: this.url, this.path, this.query, this._pathSegments
    this.setMethod(req.method);             // Sets: this.method
    this.headers = req.headers;

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

    this.pre = {};                          // Pre raw values
    this.responses = {};                    // Pre response values

    this.info = {
        received: now,
        remoteAddress: (req.connection && req.connection.remoteAddress) || '',
        remotePort: (req.connection && req.connection.remotePort) || '',
        referrer: req.headers.referrer || req.headers.referer || '',
        host: req.headers.host ? req.headers.host.replace(/\s/g, '') : ''
    };

    // Apply options

    if (options.credentials) {
        this.auth.credentials = options.credentials;
    }

    // Defined elsewhere:

    this.params = {};
    this.payload = null;
    this.state = null;
    this.jsonp = null;
    this.response = null;

    // Semi-public members

    this.raw = {
        req: req,
        res: res
    };

    this.tail = this.addTail = this._addTail;       // Removed once wagging

    // Private members

    this._states = {};
    this._logger = [];
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

    // Listen to request errors

    this._onClose = function () {

        self.log(['hapi', 'request', 'error', 'closed']);
    };

    this.raw.req.once('close', this._onClose);

    this._onError = function (err) {

        self.log(['hapi', 'request', 'error'], err);
    };

    this.raw.req.once('error', this._onError);

    this._onAborted = function () {

        self.log(['hapi', 'request', 'error', 'aborted']);
    };

    this.raw.req.once('aborted', this._onAborted);

    // Log request

    var about = {
        id: this.id,
        method: this.method,
        url: this.url.href,
        agent: this.raw.req.headers['user-agent']
    };

    this.log(['hapi', 'received'], about, now);     // Must be last for object to be fully constructed
};

Utils.inherits(internals.Request, Events.EventEmitter);


internals.Request.prototype._setUrl = function (url) {

    this.url = Url.parse(url, false);
    this.url.query = Qs.parse(this.url.query) || {};    // Override parsed value
    this.query = this.url.query;
    this.path = this.url.pathname;                      // pathname excludes query

    if (this.path &&
        this.path.indexOf('%') !== -1) {

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

    this._pathSegments = this.path.split('/');
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
        tags: tags,
        data: data
    };

    var tagsMap = Utils.mapToObject(item.tags);

    // Add to request array

    this._logger.push(item);
    this.server.emit('request', this, item, tagsMap);

    if (this.server.settings.debug &&
        this.server.settings.debug.request &&
        Utils.intersect(tagsMap, this.server.settings.debug.request, true)) {

        console.error('Debug:', item.tags.join(', '), data ? '\n    ' +
            (data.stack || (typeof data === 'object' ? JSON.stringify(data) : data)) : '');
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

    var self = this;

    // Execute onRequest extensions (can change request method and url)

    this.server._ext.invoke(this, 'onRequest', function (err) {

        // Undecorate request

        self.setUrl = undefined;
        self.setMethod = undefined;

        if (err) {
            self._reply(err);
            return;
        }

        if (!self.path || self.path[0] !== '/') {
            self._reply(Boom.badRequest('Invalid path'));
            return;
        }

        // Lookup route

        self._route = self.server._router.route(self);
        self.route = self._route.settings;

        // Setup timer

        var serverTimeout = self.server.settings.timeout.server;
        if (serverTimeout) {
            serverTimeout -= self._bench.elapsed();                 // Calculate the timeout from when the request was constructed
            var timeoutReply = function () {

                self._reply(Boom.serverTimeout());
            };

            if (serverTimeout <= 0) {
                return timeoutReply();
            }

            self._serverTimeoutId = setTimeout(timeoutReply, serverTimeout);
        }

        Async.forEachSeries(self._route.cycle, function (func, next) {

            if (self._isReplied) {
                self.log(['hapi', 'server', 'timeout']);
                return next(true);                                  // Argument is ignored but aborts the series
            }

            if (typeof func === 'string') {
                self.server._ext.invoke(self, func, next);
                return;
            }

            func(self, next);
        },
        function (err) {

            self._reply(err);
        });
    });
};


internals.Request.prototype._reply = function (exit) {

    var self = this;

    if (this._isReplied) {                                      // Prevent any future responses to this request
        return;
    }

    this._isReplied = true;

    clearTimeout(this._serverTimeoutId);

    var process = function () {

        if (self.response &&                                   // Can be null if response coming from exit
            self.response.closed) {

            if (self.response.end) {
                self.raw.res.end();                             // End the response in case it wasn't already closed
            }
            return finalize();
        }

        if (exit) {
            self._setResponse(Response.wrap(exit, self));
        }

        self.server._ext.invoke(self, 'onPreResponse', function (err) {

            if (err) {                                         // err can be valid response or error
                self._setResponse(Response.wrap(err, self));
            }

            Response.send(self, finalize);
        });
    };

    var finalize = function () {

        self.server._dtrace.report('request.finalize', self.response);
        self.server.emit('response', self);

        self._isWagging = true;
        self.addTail = undefined;
        self.tail = undefined;

        if (Object.keys(self._tails).length === 0) {
            self.server.emit('tail', self);
        }

        self._cleanup();
    };

    process();
};


internals.Request.prototype._cleanup = function () {

    this.raw.req.removeListener('close', this._onClose);
    this.raw.req.removeListener('error', this._onError);
    this.raw.req.removeListener('aborted', this._onAborted);
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


internals.Request.prototype._setResponse = function (response) {

    var self = this;

    this.response = response;

    if (response.isBoom &&
        response.output.statusCode === 500) {

        this.server.emit('internalError', this, response);
        this.log(response.isDeveloperError ? ['hapi', 'internal', 'implementation', 'error'] : ['hapi', 'internal', 'error'], response);
    }
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


internals.Request.prototype._setState = function (name, value, options) {          // options: see Defaults.state

    var state = {
        name: name,
        value: value
    };

    if (options) {
        Utils.assert(!options.autoValue, 'Cannot set autoValue directly in a response');
        state.options = Utils.clone(options);
    }

    this._states[name] = state;
};


internals.Request.prototype._clearState = function (name) {

    var state = {
        name: name,
        options: {
            ttl: 0
        }
    };

    this._states[name] = state;
};


internals.Request.prototype._tap = function () {

    return (this.listeners('finish').length || this.listeners('peek').length ? new internals.Peek(this) : null);
};


internals.Peek = function (response) {

    Stream.Transform.call(this);
    this._response = response;
    this.once('finish', function () {

        response.emit('finish');
    });
};

Utils.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this._response.emit('peek', chunk, encoding);
    this.push(chunk, encoding);
    callback();
};
