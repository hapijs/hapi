'use strict';

// Load modules

const Url = require('url');

const Boom = require('boom');
const Hoek = require('hoek');
const Podium = require('podium');

const Cors = require('./cors');
const Response = require('./response');
const Transmit = require('./transmit');


// Declare internals

const internals = {
    properties: ['server', 'url', 'query', 'path', 'method', 'mime', 'setUrl', 'setMethod', 'headers', 'id', 'app', 'plugins', 'route', 'auth', 'pre', 'preResponses', 'info', 'orig', 'params', 'paramsArray', 'payload', 'state', 'jsonp', 'response', 'raw', 'domain', 'log', 'getLog', 'generateResponse'],
    events: Podium.validate(['finish', { name: 'peek', spread: true }, 'disconnect'])
};


exports = module.exports = internals.Generator = function () {

    this._decorations = null;
};


internals.Generator.prototype.request = function (server, req, res, options) {

    const request = new internals.Request(server, req, res, options);

    // Decorate

    if (this._decorations) {
        const properties = Object.keys(this._decorations);
        for (let i = 0; i < properties.length; ++i) {
            const property = properties[i];
            const assignment = this._decorations[property];
            request[property] = (assignment.apply ? assignment.method(request) : assignment.method);
        }
    }

    return request;
};


internals.Generator.prototype.decorate = function (property, method, options) {

    options = options || {};

    Hoek.assert(!this._decorations || this._decorations[property] === undefined, 'Request interface decoration already defined:', property);
    Hoek.assert(internals.properties.indexOf(property) === -1, 'Cannot override built-in request interface decoration:', property);

    this._decorations = this._decorations || {};
    this._decorations[property] = { method, apply: options.apply };
};


internals.Request = class {

    constructor(server, req, res, options) {

        // Take measurement as soon as possible

        this._bench = new Hoek.Bench();
        const now = Date.now();

        // Public members

        this.server = server;

        this.url = null;
        this.query = null;
        this.path = null;
        this.method = null;
        this.mime = null;                       // Set if payload is parsed
        this.headers = req.headers;

        // Request info

        this.info = {
            received: now,
            responded: 0,
            remoteAddress: req.connection.remoteAddress,
            remotePort: req.connection.remotePort || '',
            referrer: req.headers.referrer || req.headers.referer || '',
            host: req.headers.host ? req.headers.host.replace(/\s/g, '') : ''
        };

        this.info.hostname = this.info.host.split(':')[0];

        this.setUrl = this._setUrl;             // Decoration removed after 'onRequest'
        this.setMethod = this._setMethod;

        this._setUrl(req.url, this.server.settings.router.stripTrailingSlash);      // Sets: this.url, this.path, this.query
        this._setMethod(req.method);                                                    // Sets: this.method

        this.id = now + ':' + server.info.id + ':' + server._requestCounter.value++;
        if (server._requestCounter.value > server._requestCounter.max) {
            server._requestCounter.value = server._requestCounter.min;
        }

        this.app = (options.app ? Hoek.shallow(options.app) : {});              // Place for application-specific state without conflicts with hapi, should not be used by plugins
        this.plugins = (options.plugins ? Hoek.shallow(options.plugins) : {});  // Place for plugins to store state without conflicts with hapi, should be namespaced using plugin name

        this._route = this.server._router.specials.notFound.route;    // Used prior to routing (only settings are used, not the handler)
        this.route = this._route.public;

        this.auth = {
            isAuthenticated: false,
            credentials: options.credentials || null,       // Special keys: 'app', 'user', 'scope'
            artifacts: options.artifacts || null,           // Scheme-specific artifacts
            strategy: null,
            mode: null,
            error: null
        };

        this.pre = {};                          // Pre raw values
        this.preResponses = {};                 // Pre response values

        // Assigned elsewhere:

        this.orig = {};
        this.params = {};
        this.paramsArray = [];              // Array of path parameters in path order
        this.payload = null;
        this.state = null;
        this.jsonp = null;
        this.response = null;

        // Semi-public members

        this.raw = { req, res };

        // Private members

        this._events = null;                // Assigned emitter when request.events is accessed
        this._states = {};
        this._entity = {};                  // Entity information set via responder.entity()
        this._logger = [];
        this._allowInternals = !!options.allowInternals;
        this._expectContinue = !!options.expectContinue;
        this._isPayloadPending = !!(req.headers['content-length'] || req.headers['transfer-encoding']);      // false when incoming payload fully processed
        this._isBailed = false;             // true when lifecycle should end
        this._isReplied = false;            // true when response processing started
        this._isFinalized = false;          // true when request completed

        // Encoding

        this.info.acceptEncoding = this.server.root._compression.accept(this);       // Delay until request object fully initialized

        // Listen to request state

        this._listenRequest();

        // Log request

        const about = {
            method: this.method,
            url: this.url.href,
            agent: this.raw.req.headers['user-agent']
        };

        this._log(['received'], about, now);     // Must be last for object to be fully constructed
    }

    get events() {

        if (!this._events) {
            this._events = new Podium(internals.events);
        }

        return this._events;
    }

    _listenRequest() {

        this._onEnd = () => {

            this._isPayloadPending = false;
        };

        this.raw.req.once('end', this._onEnd);

        this._onClose = () => {

            this._log(['request', 'closed', 'error']);
            this._isPayloadPending = false;
            this._isBailed = true;
        };

        this.raw.req.once('close', this._onClose);

        this._onError = (err) => {

            this._log(['request', 'error'], err);
            this._isPayloadPending = false;
        };

        this.raw.req.once('error', this._onError);

        this._onAbort = () => {

            this._log(['request', 'abort', 'error']);
            this._isPayloadPending = false;
            this._isBailed = true;

            if (this._events) {
                this._events.emit('disconnect');
            }
        };

        this.raw.req.once('aborted', this._onAbort);
    }

    _setUrl(url, stripTrailingSlash) {

        url = (typeof url === 'string' ? Url.parse(url, true) : Hoek.clone(url));

        // Apply path modifications

        let path = this.server._router.normalize(url.pathname || '');        // pathname excludes query

        if (stripTrailingSlash &&
            path.length > 1 &&
            path[path.length - 1] === '/') {

            path = path.slice(0, -1);
        }

        // Update derived url properties

        if (path !== url.pathname) {
            url.pathname = path;
            url.path = url.search ? path + url.search : path;
            url.href = Url.format(url);
        }

        // Store request properties

        this.url = url;
        this.query = url.query;
        this.path = url.pathname;

        if (url.hostname) {
            this.info.hostname = url.hostname;
            this.info.host = url.host;
        }
    }

    _setMethod(method) {

        Hoek.assert(method && typeof method === 'string', 'Missing method');
        this.method = method.toLowerCase();
    }

    log(tags, data, timestamp, _internal) {

        tags = [].concat(tags);
        timestamp = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());
        const internal = !!_internal;

        let update = (typeof data !== 'function' ? [this, { request: this.id, timestamp, tags, data, internal }] : () => {

            return [this, { request: this.id, timestamp, tags, data: data(), internal }];
        });

        if (this.route.settings.log) {
            if (typeof data === 'function') {
                update = update();
            }

            this._logger.push(update[1]);       // Add to request array
        }

        this.server.events.emit({ name: internal ? 'request-internal' : 'request', tags }, update);
    }

    _log(tags, data) {

        return this.log(tags, data, null, true);
    }

    getLog(tags, internal) {

        Hoek.assert(this.route.settings.log, 'Request logging is disabled');

        if (typeof tags === 'boolean') {
            internal = tags;
            tags = [];
        }

        tags = [].concat(tags || []);
        if (!tags.length &&
            internal === undefined) {

            return this._logger;
        }

        const filter = tags.length ? Hoek.mapToObject(tags) : null;
        const result = [];

        for (let i = 0; i < this._logger.length; ++i) {
            const event = this._logger[i];
            if (internal === undefined || event.internal === internal) {
                if (filter) {
                    for (let j = 0; j < event.tags.length; ++j) {
                        const tag = event.tags[j];
                        if (filter[tag]) {
                            result.push(event);
                            break;
                        }
                    }
                }
                else {
                    result.push(event);
                }
            }
        }

        return result;
    }

    async _execute() {

        // Execute onRequest extensions (can change request method and url)

        if (this.server.root._extensions.route.onRequest.nodes) {
            let response;
            try {
                response = await this._invoke(this.server.root._extensions.route.onRequest);
            }
            catch (err) {
                response = err;
            }

            if (response) {
                return this._reply(response);
            }
        }

        // Undecorate request

        this.setUrl = undefined;
        this.setMethod = undefined;

        if (!this.path ||
            this.path[0] !== '/') {

            return this._reply(Boom.badRequest('Invalid path'));
        }

        // Lookup route

        const match = this.server._router.route(this.method, this.path, this.info.hostname);
        if (!match.route.settings.isInternal ||
            this._allowInternals) {

            this._route = match.route;
            this.route = this._route.public;
        }

        this.params = match.params || {};
        this.paramsArray = match.paramsArray || [];

        if (this.route.settings.cors) {
            this.info.cors = {
                isOriginMatch: Cors.matchOrigin(this.headers.origin, this.route.settings.cors)
            };
        }

        // Set timeouts

        this._setTimeouts();

        // Lifecycle

        await this._lifecycle(this._route._cycle, false);
        this._reply();
    }

    async _lifecycle(cycle, postCycle) {

        for (let i = 0; i < cycle.length; ++i) {
            if ((this._isReplied && !postCycle) ||
                this._isBailed) {

                return;
            }

            const func = cycle[i];
            let response;
            try {
                if (typeof func === 'function') {
                    response = await func(this);
                }
                else {
                    response = await this._invoke(func);                              // Extension point
                }
            }
            catch (err) {
                response = Response.wrap(err, this);
            }

            if (response &&
                response !== this.server._replier.continue) {

                this._setResponse(response);

                if (!postCycle ||
                    typeof response === 'symbol') {

                    return;
                }
            }
        }
    }

    _setTimeouts() {

        if (this.raw.req.socket &&
            this.route.settings.timeout.socket !== undefined) {

            this.raw.req.socket.setTimeout(this.route.settings.timeout.socket || 0);    // Value can be false or positive
        }

        let serverTimeout = this.route.settings.timeout.server;
        if (!serverTimeout) {
            return;
        }

        serverTimeout = Math.floor(serverTimeout - this._bench.elapsed());          // Calculate the timeout from when the request was constructed
        const timeoutReply = () => {

            this._log(['request', 'server', 'timeout', 'error'], { timeout: serverTimeout, elapsed: this._bench.elapsed() });
            this._reply(Boom.serverUnavailable());
        };

        if (serverTimeout <= 0) {
            return timeoutReply();
        }

        this._serverTimeoutId = setTimeout(timeoutReply, serverTimeout);
    }

    async _invoke(event) {

        for (let i = 0; i < event.nodes.length; ++i) {
            const ext = event.nodes[i];
            const bind = (ext.bind || ext.plugin.realm.settings.bind);
            const realm = ext.plugin.realm;
            const response = await this.server._replier.execute(ext.func, this, { bind, realm });

            // Process response

            if (typeof response === 'symbol') {
                if (response === this.server._replier.continue) {
                    continue;
                }

                return response;
            }

            if (response.isBoom) {          // response can be replaced by prepare()
                throw response;
            }

            if (response._takeover) {
                return response;
            }

            if (event.type !== 'onPostHandler' &&
                event.type !== 'onPreResponse') {

                throw Boom.badImplementation(`${event.type} extension methods must return an error, a takeover response, or a continue signal`);
            }

            this._setResponse(response);
        }
    }

    async _reply(exit) {

        if (this._isReplied) {                                          // Prevent any future responses to this request
            return;
        }

        this._isReplied = true;

        clearTimeout(this._serverTimeoutId);

        if (this._isBailed) {
            this._finalize();
            return;
        }

        if (exit) {                                                     // Can be a valid response or error (if returned from an ext, already handled because this.response is also set)
            this._setResponse(Response.wrap(exit, this));               // Wrap to ensure any object thrown is always a valid Boom or Response object
        }

        if (typeof this.response === 'symbol') {                        // close or abort
            this._abort();
            return;
        }

        await this._lifecycle(this._route._postCycle, true);
        if (typeof this.response === 'symbol') {                        // close or abort
            this._abort();
            return;
        }

        await Transmit.send(this);
        this._finalize();
    }

    _abort() {

        if (this.response === this.server._replier.close) {
            this.raw.res.end();                                     // End the response in case it wasn't already closed
        }

        this._finalize();
    }

    _finalize() {

        this.info.responded = Date.now();

        if (this.response &&
            this.response.statusCode === 500 &&
            this.response._error) {

            this.server.events.emit('request-error', [this, this.response._error]);
            this._log(this.response._error.isDeveloperError ? ['internal', 'implementation', 'error'] : ['internal', 'error'], this.response._error);
        }

        this.server.events.emit('response', this);
        this._isFinalized = true;

        // Cleanup

        this.raw.req.removeListener('end', this._onEnd);
        this.raw.req.removeListener('close', this._onClose);
        this.raw.req.removeListener('error', this._onError);
        this.raw.req.removeListener('error', this._onAbort);

        if (this.response &&
            this.response._close) {

            this.response._close();
        }
    }

    _setResponse(response) {

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
    }

    _setState(name, value, options) {          // options: see Defaults.state

        const state = { name, value };
        if (options) {
            Hoek.assert(!options.autoValue, 'Cannot set autoValue directly in a response');
            state.options = Hoek.clone(options);
        }

        this._states[name] = state;
    }

    _clearState(name, options) {

        const state = { name };

        state.options = Hoek.clone(options || {});
        state.options.ttl = 0;

        this._states[name] = state;
    }

    _tap() {

        if (!this._events) {
            return null;
        }

        return (this._events.hasListeners('finish') || this._events.hasListeners('peek') ? new Response.Peek(this._events) : null);
    }

    generateResponse(source, options) {

        return new Response(source, this, options);
    }
};
