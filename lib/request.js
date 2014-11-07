// Load modules

var Events = require('events');
var Stream = require('stream');
var Url = require('url');
var Accept = require('accept');
var Boom = require('boom');
var Hoek = require('hoek');
var Items = require('items');
var Qs = require('qs');
var Response = require('./response');
var Handler = require('./handler');
var Protect = require('./protect');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Request = function (server, req, res, options) {

    var self = this;

    Events.EventEmitter.call(this);

    // Take measurement as soon as possible

    this._bench = new Hoek.Bench();
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

    this._setUrl(req.url, server.settings.router.stripTrailingSlash);       // Sets: this.url, this.path, this.query
    this._setMethod(req.method);                                            // Sets: this.method
    this.headers = req.headers;

    this.id = now + '-' + process.pid + '-' + Math.floor(Math.random() * 0x10000);

    this.app = {};                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
    this.plugins = {};                      // Place for plugins to store state without conflicts with hapi, should be namespaced using plugin name

    this._route = this.server._router.specials.notFound.route;    // Used prior to routing (only settings are used, not the handler)
    this.route = this._route.settings;

    this.auth = {
        isAuthenticated: false,
        credentials: null,                  // Special keys: 'app', 'user', 'scope'
        artifacts: null,                    // Scheme-specific artifacts
        session: null                       // Used by cookie auth { set(), clear() }
    };

    this.session = null;                    // Special key reserved for plugins implementing session support

    this.pre = {};                          // Pre raw values
    this.responses = {};                    // Pre response values

    this.info = {
        received: now,
        remoteAddress: req.connection ? req.connection.remoteAddress : '',
        remotePort: req.connection ? req.connection.remotePort : '',
        referrer: req.headers.referrer || req.headers.referer || '',
        host: req.headers.host ? req.headers.host.replace(/\s/g, '') : '',
        acceptEncoding: Accept.encoding(this.headers['accept-encoding'], ['identity', 'gzip', 'deflate'])
    };

    this.info.hostname = this.info.host.split(':')[0];

    // Apply options

    if (options.credentials) {
        this.auth.credentials = options.credentials;
    }

    // Assigned elsewhere:

    this.orig = {};
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
    this._isBailed = false;             // true when lifecycle should end
    this._isReplied = false;            // true when response processing started
    this._isFinalized = false;          // true when request completed (may be waiting on tails to complete)
    this._tails = {};                   // tail id -> name (tracks pending tails)
    this._tailIds = 0;                  // Used to generate a unique tail id
    this._paramsArray = [];             // Array of path parameters in path order
    this._protect = new Protect(this);
    this.domain = this._protect.domain;

    // Set socket timeout

    if (req.socket &&
        server.settings.timeout.socket !== undefined) {

        req.socket.setTimeout(server.settings.timeout.socket || 0);     // Value can be false or positive
    }

    // Listen to request errors

    this._onClose = function () {

        self.log(['hapi', 'request', 'error', 'closed']);
        self._isBailed = true;
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

Hoek.inherits(internals.Request, Events.EventEmitter);


internals.Request.prototype._setUrl = function (url, stripTrailingSlash) {

    this.url = Url.parse(url, false);
    this.url.query = Qs.parse(this.url.query);          // Override parsed value
    this.query = this.url.query;
    this.path = this.url.pathname || '';                // pathname excludes query

    if (stripTrailingSlash &&
        this.path.length > 1 &&
        this.path[this.path.length - 1] === '/') {

        this.path = this.path.slice(0, -1);
        this.url.pathname = this.path;
    }

    this.path = this.server._router.normalize(this.path);
};


internals.Request.prototype._setMethod = function (method) {

    Hoek.assert(method && typeof method === 'string', 'Missing method');
    this.method = method.toLowerCase();
};


internals.Request.prototype.log = function (tags, data, timestamp) {

    tags = (Array.isArray(tags) ? tags : [tags]);
    var now = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());

    var event = {
        request: this.id,
        timestamp: now,
        tags: tags,
        data: data
    };

    var tagsMap = Hoek.mapToObject(event.tags);

    // Add to request array

    this._logger.push(event);
    this.server.emit('request', this, event, tagsMap);

    if (this.server.settings.debug &&
        this.server.settings.debug.request &&
        Hoek.intersect(tagsMap, this.server.settings.debug.request, true)) {

        console.error('Debug:', event.tags.join(', '), (data ? '\n    ' + (data.stack || (typeof data === 'object' ? Utils.stringify(data) : data)) : ''));
    }
};


internals.Request.prototype.getLog = function (tags) {

    tags = [].concat(tags || []);
    if (!tags.length) {
        return this._logger;
    }

    var filter = Hoek.mapToObject(tags);
    var result = [];

    for (var i = 0, il = this._logger.length; i < il; ++i) {
        var event = this._logger[i];
        for (var t = 0, tl = event.tags.length; t < tl; ++t) {
            var tag = event.tags[t];
            if (filter[tag]) {
                result.push(event);
                break;
            }
        }
    }

    return result;
};


internals.Request.prototype._execute = function () {

    var self = this;

    // Execute onRequest extensions (can change request method and url)

    Handler.invoke(this, 'onRequest', function (err) {

        // Undecorate request

        self.setUrl = undefined;
        self.setMethod = undefined;

        if (err) {
            return self._reply(err);
        }

        if (!self.path || self.path[0] !== '/') {
            return self._reply(Boom.badRequest('Invalid path'));
        }

        // Lookup route

        var match = self.server._router.route(self.method, self.path, self.info.hostname);
        self._route = match.route;
        self.route = self._route.settings;
        self.params = match.params;
        self._paramsArray = match.paramsArray;

        // Setup timer

        var serverTimeout = self.server.settings.timeout.server;
        if (serverTimeout) {
            serverTimeout = Math.floor(serverTimeout - self._bench.elapsed());      // Calculate the timeout from when the request was constructed
            var timeoutReply = function () {

                self.log(['hapi', 'server', 'timeout']);
                self._reply(Boom.serverTimeout());
            };

            if (serverTimeout <= 0) {
                return timeoutReply();
            }

            self._serverTimeoutId = setTimeout(timeoutReply, serverTimeout);
        }

        Items.serial(self._route._cycle, function (func, next) {

            if (self._isReplied ||
                self._isBailed) {

                return next(Boom.internal('Already closed'));
            }

            if (typeof func === 'string') {
                return Handler.invoke(self, func, next);
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

    if (this._isReplied) {                                  // Prevent any future responses to this request
        return;
    }

    this._isReplied = true;

    clearTimeout(this._serverTimeoutId);

    if (this.response &&                                    // Can be null if response coming from exit
        this.response.closed) {

        if (this.response.end) {
            this.raw.res.end();                             // End the response in case it wasn't already closed
        }

        return this._finalize();
    }

    if (exit) {
        this._setResponse(Response.wrap(exit, this));
    }

    Handler.invoke(this, 'onPreResponse', function (err) {

        if (err) {                                          // err can be valid response or error
            self._setResponse(Response.wrap(err, self));
        }

        if (self._isBailed) {
            return self._finalize();
        }

        Response.send(self, function () {

            return self._finalize();
        });
    });
};


internals.Request.prototype._finalize = function () {

    this.server.emit('response', this);

    this._isFinalized = true;
    this.addTail = undefined;
    this.tail = undefined;

    if (Object.keys(this._tails).length === 0) {
        this.server.emit('tail', this);
    }

    // Cleanup

    this.raw.req.removeListener('close', this._onClose);
    this.raw.req.removeListener('error', this._onError);
    this.raw.req.removeListener('aborted', this._onAborted);

    if (this.response._close) {
        this.response._close();
    }

    this._protect.logger = this.server;
};


internals.Request.prototype._setResponse = function (response) {

    if (this.response &&
        !this.response.isBoom &&
        this.response !== response &&
        (response.isBoom || this.response.source !== response.source)) {

        this.response._close();
    }

    if (this._isFinalized) {
        if (response._close) {
            response._close();
        }

        return;
    }

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
            self._isFinalized) {

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
        Hoek.assert(!options.autoValue, 'Cannot set autoValue directly in a response');
        state.options = Hoek.clone(options);
    }

    this._states[name] = state;
};


internals.Request.prototype._clearState = function (name, options) {

    var state = {
        name: name
    };

    state.options = Hoek.clone(options || {});
    state.options.ttl = 0;

    this._states[name] = state;
};


internals.Request.prototype._tap = function () {

    return (this.listeners('finish').length || this.listeners('peek').length ? new internals.Peek(this) : null);
};


internals.Request.prototype.generateResponse = function (source, options) {

    return new Response.Message(source, this, options);
};


internals.Peek = function (request) {

    Stream.Transform.call(this);
    this._request = request;
    this.once('finish', function () {

        request.emit('finish');
    });
};

Hoek.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this._request.emit('peek', chunk, encoding);
    this.push(chunk, encoding);
    callback();
};
