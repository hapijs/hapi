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


exports = module.exports = internals.Generator = class {

    constructor() {

        this._decorations = null;
    }

    request(server, req, res, options) {

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
    }

    decorate(property, method, options) {

        options = options || {};

        Hoek.assert(!this._decorations || this._decorations[property] === undefined, 'Request interface decoration already defined:', property);
        Hoek.assert(internals.properties.indexOf(property) === -1, 'Cannot override built-in request interface decoration:', property);

        this._decorations = this._decorations || {};
        this._decorations[property] = { method, apply: options.apply };
    }
};


internals.Request = class {

    constructor(server, req, res, options) {

        this._allowInternals = !!options.allowInternals;
        this._core = server._core;
        this._entity = null;                                                                                // Entity information set via h.entity()
        this._events = null;                                                                                // Assigned an emitter when request.events is accessed
        this._expectContinue = !!options.expectContinue;
        this._isBailed = false;                                                                             // true when lifecycle should end
        this._isPayloadPending = !!(req.headers['content-length'] || req.headers['transfer-encoding']);     // Changes to false when incoming payload fully processed
        this._isReplied = false;                                                                            // true when response processing started
        this._logger = [];
        this._route = this._core.router.specials.notFound.route;                                               // Used prior to routing (only settings are used, not the handler)
        this._serverTimeoutId = null;
        this._states = {};

        this.app = (options.app ? Hoek.shallow(options.app) : {});                                          // Place for application-specific state without conflicts with hapi, should not be used by plugins
        this.headers = req.headers;
        this.info = internals.info(this._core, req);
        this.jsonp = null;
        this.method = req.method.toLowerCase();
        this.mime = null;
        this.orig = {};
        this.params = null;
        this.paramsArray = null;                                                                            // Array of path parameters in path order
        this.path = null;
        this.payload = null;
        this.plugins = (options.plugins ? Hoek.shallow(options.plugins) : {});                              // Place for plugins to store state without conflicts with hapi, should be namespaced using plugin name
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
            credentials: options.credentials || null,       // Special keys: 'app', 'user', 'scope'
            artifacts: options.artifacts || null,           // Scheme-specific artifacts
            strategy: null,
            mode: null,
            error: null
        };

        // Parse request url

        this.setUrl(req.url, this._core.settings.router.stripTrailingSlash);
    }

    get events() {

        if (!this._events) {
            this._events = new Podium(internals.events);
        }

        return this._events;
    }

    setUrl(url, stripTrailingSlash) {

        Hoek.assert(this.params === null, 'Cannot change request URL after routing');

        url = (typeof url === 'string' ? Url.parse(url, true) : Hoek.clone(url));

        // Apply path modifications

        let path = this._core.router.normalize(url.pathname || '');        // pathname excludes query

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

    setMethod(method) {

        Hoek.assert(this.params === null, 'Cannot change request method after routing');
        Hoek.assert(method && typeof method === 'string', 'Missing method');

        this.method = method.toLowerCase();
    }

    async _execute() {

        this._listenRequest();
        this.info.acceptEncoding = this._core.compression.accept(this);

        try {
            await this._onRequest();
        }
        catch (err) {
            return this._reply(err);
        }

        this._lookup();
        this._setTimeouts();
        await this._lifecycle(this._route._cycle, false);
        this._reply();
    }

    async _onRequest() {

        // onRequest (can change request method and url)

        if (this._core.extensions.route.onRequest.nodes) {
            let response;
            try {
                response = await this._invoke(this._core.extensions.route.onRequest);
            }
            catch (err) {
                response = err;
            }

            if (response) {
                throw response;
            }
        }

        // Validate path

        if (!this.path ||
            this.path[0] !== '/') {

            throw Boom.badRequest('Invalid path');
        }
    }

    _listenRequest() {

        this._errorContext = { request: this };
        this.raw.req.on('end', internals.error.bind(this.raw.req, this._errorContext, 'end'));
        this.raw.req.on('close', internals.error.bind(this.raw.req, this._errorContext, 'close'));
        this.raw.req.on('error', internals.error.bind(this.raw.req, this._errorContext, 'error'));
        this.raw.req.on('aborted', internals.error.bind(this.raw.req, this._errorContext, 'abort'));
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
                    response = func(this);
                }
                else {
                    response = this._invoke(func);                              // Extension point
                }

                if (response && typeof response.then === 'function') {          // Skip await if no reason to
                    response = await response;
                }
            }
            catch (err) {
                response = Response.wrap(err, this);
            }

            if (response &&
                response !== this._core.toolkit.continue) {

                this._setResponse(response);

                if (!postCycle ||
                    typeof response === 'symbol') {

                    return;
                }
            }
        }
    }

    async _invoke(event) {

        for (let i = 0; i < event.nodes.length; ++i) {
            const ext = event.nodes[i];
            const bind = (ext.bind || ext.realm.settings.bind);
            const realm = ext.realm;
            const response = await this._core.toolkit.execute(ext.func, this, { bind, realm });

            // Process response

            if (typeof response === 'symbol') {
                if (response === this._core.toolkit.continue) {
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

        if (this._serverTimeoutId) {
            clearTimeout(this._serverTimeoutId);
        }

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

            this._core.events.emit('request-error', [this, this.response._error]);
            this._log(this.response._error.isDeveloperError ? ['internal', 'implementation', 'error'] : ['internal', 'error'], this.response._error);
        }

        // Cleanup

        if (this._errorContext) {
            this._errorContext.request = null;              // Disable req events
        }

        if (this.response &&
            this.response._close) {

            this.response._close();
        }

        this._core.events.emit('response', this);
    }

    _setResponse(response) {

        if (this.response &&
            !this.response.isBoom &&
            this.response !== response &&
            (response.isBoom || this.response.source !== response.source)) {

            this.response._close();
        }

        if (this.info.responded) {
            if (response._close) {
                response._close();
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

    log(tags, data, timestamp, _internal) {

        tags = [].concat(tags);
        timestamp = (timestamp ? (timestamp instanceof Date ? timestamp.getTime() : timestamp) : Date.now());
        const internal = !!_internal;

        let update = (typeof data !== 'function' ? [this, { request: this.info.id, timestamp, tags, data, internal }] : () => {

            return [this, { request: this.info.id, timestamp, tags, data: data(), internal }];
        });

        if (this.route.settings.log.collect) {
            if (typeof data === 'function') {
                update = update();
            }

            this._logger.push(update[1]);       // Add to request array
        }

        this._core.events.emit({ name: internal ? 'request-internal' : 'request', tags }, update);
    }

    _log(tags, data) {

        return this.log(tags, data, null, true);
    }

    getLog(tags, internal) {

        Hoek.assert(this.route.settings.log.collect, 'Request logging is disabled');

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
};


internals.info = function (core, req) {

    const host = req.headers.host ? req.headers.host.replace(/\s/g, '') : '';
    const received = Date.now();

    const info = {
        received,
        remoteAddress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort || '',
        referrer: req.headers.referrer || req.headers.referer || '',
        host,
        hostname: host.split(':')[0],
        id: received + ':' + core.info.id + ':' + core.requestCounter.value++,

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


internals.error = function ({ request }, event, err) {

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

    request._isBailed = true;

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
