'use strict';

const { URL, URLSearchParams } = require('url');

const Boom = require('boom');
const Bounce = require('bounce');
const Hoek = require('hoek');
const Podium = require('podium');

const Cors = require('./cors');
const Response = require('./response');
const Transmit = require('./transmit');


const internals = {
    events: Podium.validate(['finish', { name: 'peek', spread: true }, 'disconnect']),
    reserved: ['server', 'url', 'query', 'path', 'method', 'mime', 'setUrl', 'setMethod', 'headers', 'id', 'app', 'plugins', 'route', 'auth', 'pre', 'preResponses', 'info', 'orig', 'params', 'paramsArray', 'payload', 'state', 'jsonp', 'response', 'raw', 'domain', 'log', 'logs', 'generateResponse']
};


exports = module.exports = internals.Request = class {

    constructor(server, req, res, options) {

        this._allowInternals = !!options.allowInternals;
        this._core = server._core;
        this._entity = null;                                                                                // Entity information set via h.entity()
        this._eventContext = { request: this };
        this._events = null;                                                                                // Assigned an emitter when request.events is accessed
        this._expectContinue = !!options.expectContinue;
        this._isPayloadPending = !!(req.headers['content-length'] || req.headers['transfer-encoding']);     // Changes to false when incoming payload fully processed
        this._isReplied = false;                                                                            // true when response processing started
        this._route = this._core.router.specials.notFound.route;                                            // Used prior to routing (only settings are used, not the handler)
        this._serverTimeoutId = null;
        this._states = {};
        this._transmitted = false;                                                                          // Indicates whether a response has been successful sent

        this.app = (options.app ? Object.assign({}, options.app) : {});                                     // Place for application-specific state without conflicts with hapi, should not be used by plugins (shallow cloned)
        this.headers = req.headers;
        this.info = internals.info(this._core, req);
        this.jsonp = null;
        this.logs = [];
        this.method = req.method.toLowerCase();
        this.mime = null;
        this.orig = {};
        this.params = null;
        this.paramsArray = null;                                                                            // Array of path parameters in path order
        this.path = null;
        this.payload = null;
        this.plugins = (options.plugins ? Object.assign({}, options.plugins) : {});                         // Place for plugins to store state without conflicts with hapi, should be namespaced using plugin name (shallow cloned)
        this.pre = {};                                                                                      // Pre raw values
        this.preResponses = {};                                                                             // Pre response values
        this.raw = { req, res };
        this.response = null;
        this.route = this._route.public;
        this.query = null;
        this.server = server;
        this.state = null;
        this.url = null;

        this.auth = {
            isAuthenticated: false,
            isAuthorized: false,
            credentials: options.credentials || null,       // Special keys: 'app', 'user', 'scope'
            artifacts: options.artifacts || null,           // Scheme-specific artifacts
            strategy: null,
            mode: null,
            error: null
        };

        // Parse request url

        try {
            this.setUrl(req.url, this._core.settings.router.stripTrailingSlash);
        }
        catch (err) {
            Bounce.ignore(err, 'boom');
            this.url = err;
        }
    }

    static generate(server, req, res, options) {

        const request = new server._core.Request(server, req, res, options);

        // Decorate

        if (server._core._decorations.requestApply) {
            for (const property in server._core._decorations.requestApply) {
                const assignment = server._core._decorations.requestApply[property];
                request[property] = assignment(request);
            }
        }

        request._listen();
        return request;
    }

    get events() {

        if (!this._events) {
            this._events = new Podium(internals.events);
        }

        return this._events;
    }

    setUrl(url, stripTrailingSlash) {

        Hoek.assert(this.params === null, 'Cannot change request URL after routing');

        if (url instanceof URL) {
            url = url.href;
        }

        Hoek.assert(typeof url === 'string', 'Url must be a string or URL object');

        const parseFull = url.length === 0 || url[0] !== '/';
        try {
            if (parseFull) {
                url = new URL(url);
            }
            else {
                const hostname = this.info.host || `${this._core.info.host}:${this._core.info.port}`;
                url = new URL(url, `${this._core.info.protocol}://${hostname}`);
            }
        }
        catch (err) {
            Bounce.ignore(err, TypeError);

            throw Boom.boomify(err, { statusCode: 400 });
        }

        // Apply path modifications

        let path = this._core.router.normalize(url.pathname);        // pathname excludes query

        if (stripTrailingSlash &&
            path.length > 1 &&
            path[path.length - 1] === '/') {

            path = path.slice(0, -1);
        }

        url.pathname = path;

        // Store request properties

        this.url = url;
        this.path = path;

        if (parseFull) {
            this.info.hostname = url.hostname;
            this.info.host = url.host;
        }
    }

    setMethod(method) {

        Hoek.assert(this.params === null, 'Cannot change request method after routing');
        Hoek.assert(method && typeof method === 'string', 'Missing method');

        this.method = method.toLowerCase();
    }

    active() {

        return !!this._eventContext.request;
    }

    async _execute() {

        this.info.acceptEncoding = this._core.compression.accept(this);

        try {
            await this._onRequest();
        }
        catch (err) {
            Bounce.rethrow(err, 'system');
            return this._reply(err);
        }

        this._lookup();
        this._queryParse();
        this._setTimeouts();
        await this._lifecycle();
        this._reply();
    }

    async _onRequest() {

        // onRequest (can change request method and url)

        if (this._core.extensions.route.onRequest.nodes) {
            const response = await this._invoke(this._core.extensions.route.onRequest);
            if (response) {
                if (!internals.skip(response)) {
                    throw Boom.badImplementation('onRequest extension methods must return an error, a takeover response, or a continue signal');
                }

                throw response;
            }
        }

        // Validate path

        if (this.url instanceof Error) {
            throw this.url;
        }
    }

    _listen() {

        if (this._isPayloadPending) {
            this.raw.req.on('end', internals.event.bind(this.raw.req, this._eventContext, 'end'));
        }

        this.raw.req.on('close', internals.event.bind(this.raw.req, this._eventContext, 'close'));
        this.raw.req.on('error', internals.event.bind(this.raw.req, this._eventContext, 'error'));
        this.raw.req.on('aborted', internals.event.bind(this.raw.req, this._eventContext, 'abort'));
    }

    _lookup() {

        const match = this._core.router.route(this.method, this.path, this.info.hostname);
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
    }

    _queryParse() {

        const { queryParser } = this._route.settings;

        const baseParser = (iterator) => {

            const query = Object.create(null);
            for (let [key, value] of iterator) {
                const entry = query[key];
                if (entry !== undefined) {
                    value = [].concat(entry, value);
                }

                query[key] = value;
            }

            return query;
        };

        if (queryParser) {
            try {
                let result = queryParser(this);

                Hoek.assert(typeof result === 'object' && result !== null, 'Parsed query must be an object');

                if (result instanceof URLSearchParams || result instanceof Map) {
                    result = baseParser(result);
                }

                this.query = result;
            }
            catch (err) {
                return this._reply(err);
            }
        }
        else {
            this.query = baseParser(this.url.searchParams);
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

        const elapsed = Date.now() - this.info.received;
        serverTimeout = Math.floor(serverTimeout - elapsed);            // Calculate the timeout from when the request was constructed

        if (serverTimeout <= 0) {
            internals.timeoutReply(this, serverTimeout);
            return;
        }

        this._serverTimeoutId = setTimeout(internals.timeoutReply, serverTimeout, this, serverTimeout);
    }

    async _lifecycle() {

        for (const func of this._route._cycle) {
            if (this._isReplied ||
                !this._eventContext.request) {

                return;
            }

            try {
                var response = (typeof func === 'function' ? func(this) : this._invoke(func));
                if (response && typeof response.then === 'function') {          // Skip await if no reason to
                    response = await response;
                }
            }
            catch (err) {
                Bounce.rethrow(err, 'system');
                response = Response.wrap(err, this);
            }

            if (!response ||
                response === this._core.toolkit.continue) {                     // Continue

                continue;
            }

            if (!internals.skip(response)) {
                response = Boom.badImplementation('Lifecycle methods called before the handler can only return an error, a takeover response, or a continue signal');
            }

            this._setResponse(response);
            return;
        }
    }

    async _invoke(event) {

        for (const ext of event.nodes) {
            const bind = (ext.bind || ext.realm.settings.bind);
            const realm = ext.realm;
            const response = await this._core.toolkit.execute(ext.func, this, { bind, realm });

            if (response === this._core.toolkit.continue) {
                continue;
            }

            if (internals.skip(response) ||
                this.response === null) {

                return response;
            }

            this._setResponse(response);
        }
    }

    async _reply(exit) {

        if (this._isReplied) {                                          // Prevent any future responses to this request
            return;
        }

        this._isReplied = true;

        if (this._serverTimeoutId) {
            clearTimeout(this._serverTimeoutId);
        }

        if (!this._eventContext.request) {
            this._finalize();
            return;
        }

        if (exit) {                                                     // Can be a valid response or error (if returned from an ext, already handled because this.response is also set)
            this._setResponse(Response.wrap(exit, this));               // Wrap to ensure any object thrown is always a valid Boom or Response object
        }

        if (typeof this.response === 'symbol') {                        // close or abandon
            this._abort();
            return;
        }

        await this._postCycle();

        if (!this._eventContext.request ||
            typeof this.response === 'symbol') {                        // close or abandon

            this._abort();
            return;
        }

        await Transmit.send(this);
        this._finalize();
    }

    async _postCycle() {

        for (const func of this._route._postCycle) {
            if (!this._eventContext.request) {
                return;
            }

            try {
                var response = await (typeof func === 'function' ? func(this) : this._invoke(func));
            }
            catch (err) {
                Bounce.rethrow(err, 'system');
                response = Response.wrap(err, this);
            }

            if (response &&
                response !== this._core.toolkit.continue) {                     // Continue

                this._setResponse(response);
            }
        }
    }

    _abort() {

        if (this.response === this._core.toolkit.close) {
            this.raw.res.end();                                     // End the response in case it wasn't already closed
        }

        this._finalize();
    }

    _finalize() {

        this.info.responded = Date.now();

        if (this.response &&
            this.response.statusCode === 500 &&
            this.response._error) {

            const tags = this.response._error.isDeveloperError ? ['internal', 'implementation', 'error'] : ['internal', 'error'];
            this._log(tags, this.response._error, 'error');
        }

        // Cleanup

        this._eventContext.request = null;              // Disable req events

        if (this.response &&
            this.response._close) {

            this.response._close(this);
        }

        if (!this._transmitted) {
            this.response = null;
        }

        this._core.events.emit('response', this);
        this._core.queue.release();
    }

    _setResponse(response) {

        if (this.response &&
            !this.response.isBoom &&
            this.response !== response &&
            (response.isBoom || this.response.source !== response.source)) {

            this.response._close(this);
        }

        if (this.info.responded) {
            if (response._close) {
                response._close(this);
            }

            return;
        }

        this.response = response;
    }

    _setState(name, value, options) {

        const state = { name, value };
        if (options) {
            Hoek.assert(!options.autoValue, 'Cannot set autoValue directly in a response');
            state.options = Hoek.clone(options);
        }

        this._states[name] = state;
    }

    _clearState(name, options = {}) {

        const state = { name };

        state.options = Hoek.clone(options);
        state.options.ttl = 0;

        this._states[name] = state;
    }

    _tap() {

        if (!this._events) {
            return null;
        }

        return (this._events.hasListeners('finish') || this._events.hasListeners('peek') ? new Response.Peek(this._events) : null);
    }

    log(tags, data) {

        return this._log(tags, data, 'app');
    }

    _log(tags, data, channel = 'internal') {

        if (!this._core.events.hasListeners('request') &&
            !this.route.settings.log.collect) {

            return;
        }

        if (!Array.isArray(tags)) {
            tags = [tags];
        }

        const timestamp = Date.now();
        const field = (data instanceof Error ? 'error' : 'data');

        let event = [this, { request: this.info.id, timestamp, tags, [field]: data, channel }];
        if (typeof data === 'function') {
            event = () => [this, { request: this.info.id, timestamp, tags, data: data(), channel }];
        }

        if (this.route.settings.log.collect) {
            if (typeof data === 'function') {
                event = event();
            }

            this.logs.push(event[1]);
        }

        this._core.events.emit({ name: 'request', channel, tags }, event);
    }

    generateResponse(source, options) {

        return new Response(source, this, options);
    }
};


internals.Request.reserved = internals.reserved;


internals.info = function (core, req) {

    const host = req.headers.host ? req.headers.host.trim() : '';
    const received = Date.now();

    const info = {
        received,
        remoteAddress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort || '',
        referrer: req.headers.referrer || req.headers.referer || '',
        host,
        hostname: host.split(':')[0],
        id: `${received}:${core.info.id}:${core.requestCounter.value++}`,

        // Assigned later

        acceptEncoding: null,
        cors: null,
        responded: 0
    };

    if (core.requestCounter.value > core.requestCounter.max) {
        core.requestCounter.value = core.requestCounter.min;
    }

    return info;
};


internals.event = function ({ request }, event, err) {

    if (!request) {
        return;
    }

    request._isPayloadPending = false;

    if (event === 'end') {
        return;
    }

    request._log(err ? ['request', 'error'] : ['request', 'error', event], err);

    if (event === 'error') {
        return;
    }

    request._eventContext.request = null;

    if (event === 'abort' &&
        request._events) {

        request._events.emit('disconnect');
    }
};


internals.timeoutReply = function (request, timeout) {

    const elapsed = Date.now() - request.info.received;
    request._log(['request', 'server', 'timeout', 'error'], { timeout, elapsed });
    request._reply(Boom.serverUnavailable());
};


internals.skip = function (response) {

    return (response.isBoom || response._takeover || typeof response === 'symbol');
};
