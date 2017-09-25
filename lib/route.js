'use strict';

// Load modules

const Boom = require('boom');
const Catbox = require('catbox');
const Hoek = require('hoek');
const Subtext = require('subtext');

const Auth = require('./auth');
const Cors = require('./cors');
const Ext = require('./ext');
const Handler = require('./handler');
const Schema = require('./schema');
const Security = require('./security');
const Streams = require('./streams');
const Validation = require('./validation');


// Declare internals

const internals = {};


exports = module.exports = internals.Route = function (route, plugin, options) {

    options = options || {};

    // Apply plugin environment (before schema validation)

    const server = plugin.root;
    const realm = plugin.realm;
    if (realm.modifiers.route.vhost ||
        realm.modifiers.route.prefix) {

        route = Hoek.cloneWithShallow(route, ['config']);       // config is left unchanged
        route.path = (realm.modifiers.route.prefix ? realm.modifiers.route.prefix + (route.path !== '/' ? route.path : '') : route.path);
        route.vhost = realm.modifiers.route.vhost || route.vhost;
    }

    // Setup and validate route configuration

    Hoek.assert(route.path, 'Route missing path');
    const routeDisplay = route.method + ' ' + route.path;

    let config = route.config;
    if (typeof config === 'function') {
        config = config.call(realm.settings.bind, server);
    }

    Hoek.assert(route.handler || (config && config.handler), 'Missing or undefined handler:', routeDisplay);
    Hoek.assert(!!route.handler ^ !!(config && config.handler), 'Handler must only appear once:', routeDisplay);            // XOR
    Hoek.assert(route.path === '/' || route.path[route.path.length - 1] !== '/' || !server._settings.router.stripTrailingSlash, 'Path cannot end with a trailing slash when configured to strip:', routeDisplay);

    route = Schema.apply('route', route, routeDisplay);

    const handler = route.handler || config.handler;
    const method = route.method.toLowerCase();
    Hoek.assert(method !== 'head', 'Method name not allowed:', routeDisplay);

    // Apply settings in order: {server} <- {handler} <- {realm} <- {route}

    const handlerDefaults = Handler.defaults(method, handler, server);
    let base = Hoek.applyToDefaultsWithShallow(server._settings.routes, handlerDefaults, ['bind']);
    base = Hoek.applyToDefaultsWithShallow(base, realm.settings, ['bind']);
    this.settings = Hoek.applyToDefaultsWithShallow(base, config || {}, ['bind', 'validate.headers', 'validate.payload', 'validate.params', 'validate.query']);
    this.settings.handler = handler;
    this.settings = Schema.apply('routeConfig', this.settings, routeDisplay);

    const socketTimeout = (this.settings.timeout.socket === undefined ? 2 * 60 * 1000 : this.settings.timeout.socket);
    Hoek.assert(!this.settings.timeout.server || !socketTimeout || this.settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout:', routeDisplay);
    Hoek.assert(!this.settings.payload.timeout || !socketTimeout || this.settings.payload.timeout < socketTimeout, 'Payload timeout must be shorter than socket timeout:', routeDisplay);

    this.server = server;
    this.path = route.path;
    this.method = method;
    this.plugin = plugin;

    this.settings.vhost = route.vhost;
    this.settings.plugins = this.settings.plugins || {};            // Route-specific plugins settings, namespaced using plugin name
    this.settings.app = this.settings.app || {};                    // Route-specific application settings

    // Path parsing

    this._special = !!options.special;
    this._analysis = this.server._router.analyze(this.path);
    this.params = this._analysis.params;
    this.fingerprint = this._analysis.fingerprint;

    this.public = {
        method: this.method,
        path: this.path,
        vhost: this.vhost,
        realm: this.plugin.realm,
        settings: this.settings,
        fingerprint: this.fingerprint,
        auth: {
            access: (request) => Auth.access(request, this.public)
        }
    };

    // Validation

    const validation = this.settings.validate;
    if (this.method === 'get') {

        // Assert on config, not on merged settings

        Hoek.assert(!config || !config.payload, 'Cannot set payload settings on HEAD or GET request:', routeDisplay);
        Hoek.assert(!config || !config.validate || !config.validate.payload, 'Cannot validate HEAD or GET requests:', routeDisplay);

        validation.payload = null;
    }

    ['headers', 'params', 'query', 'payload'].forEach((type) => {

        validation[type] = Validation.compile(validation[type]);
    });

    if (this.settings.response.schema !== undefined ||
        this.settings.response.status) {

        this.settings.response._validate = true;

        const rule = this.settings.response.schema;
        this.settings.response.status = this.settings.response.status || {};
        const statuses = Object.keys(this.settings.response.status);

        if (rule === true &&
            !statuses.length) {

            this.settings.response._validate = false;
        }
        else {
            this.settings.response.schema = Validation.compile(rule);
            for (let i = 0; i < statuses.length; ++i) {
                const code = statuses[i];
                this.settings.response.status[code] = Validation.compile(this.settings.response.status[code]);
            }
        }
    }

    // Payload parsing

    if (this.method === 'get') {
        this.settings.payload = null;
    }
    else {
        this.settings.payload.decoders = this.server.root._compression._decoders;        // Reference the shared object to keep up to date
    }

    Hoek.assert(!this.settings.validate.payload || this.settings.payload.parse, 'Route payload must be set to \'parse\' when payload validation enabled:', routeDisplay);
    Hoek.assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name:', routeDisplay);

    // Authentication configuration

    this.settings.auth = (this._special ? false : this.server.auth._setupRoute(this.settings.auth, route.path));

    // Cache

    if (this.method === 'get' &&
        typeof this.settings.cache === 'object' &&
        (this.settings.cache.expiresIn || this.settings.cache.expiresAt)) {

        this.settings.cache._statuses = Hoek.mapToObject(this.settings.cache.statuses);
        this._cache = new Catbox.Policy({ expiresIn: this.settings.cache.expiresIn, expiresAt: this.settings.cache.expiresAt });
    }

    // CORS

    this.settings.cors = Cors.route(this.settings.cors);

    // Security

    this.settings.security = Security.route(this.settings.security);

    // Handler

    this.settings.handler = Handler.configure(this.settings.handler, this);
    this._prerequisites = Handler.prerequisitesConfig(this.settings.pre, this.server);

    // Route lifecycle

    this._extensions = {
        onPreResponse: Ext.combine(this, 'onPreResponse')
    };

    if (this._special) {
        this._cycle = [internals.drain, Handler.execute];
        return;
    }

    this._extensions.onPreAuth = Ext.combine(this, 'onPreAuth');
    this._extensions.onPostAuth = Ext.combine(this, 'onPostAuth');
    this._extensions.onPreHandler = Ext.combine(this, 'onPreHandler');
    this._extensions.onPostHandler = Ext.combine(this, 'onPostHandler');

    this.rebuild();
};


internals.Route.prototype.rebuild = function (event) {

    if (event) {
        this._extensions[event.type].add(event);
        if (event.type === 'onPreResponse') {
            return;
        }
    }

    // Build lifecycle array

    const cycle = [];

    // 'onRequest'

    if (this.settings.jsonp) {
        cycle.push(internals.parseJSONP);
    }

    if (this.settings.state.parse) {
        cycle.push(internals.state);
    }

    if (this._extensions.onPreAuth.nodes) {
        cycle.push(this._extensions.onPreAuth);
    }

    const authenticate = (this.settings.auth !== false);                          // Anything other than 'false' can still require authentication
    if (authenticate) {
        cycle.push(Auth.authenticate);
    }

    if (this.method !== 'get') {
        cycle.push(internals.payload);

        if (authenticate) {
            cycle.push(Auth.payload);
        }
    }

    if (this._extensions.onPostAuth.nodes) {
        cycle.push(this._extensions.onPostAuth);
    }

    if (this.settings.validate.headers) {
        cycle.push(Validation.headers);
    }

    if (this.settings.validate.params) {
        cycle.push(Validation.params);
    }

    if (this.settings.jsonp) {
        cycle.push(internals.cleanupJSONP);
    }

    if (this.settings.validate.query) {
        cycle.push(Validation.query);
    }

    if (this.settings.validate.payload) {
        cycle.push(Validation.payload);
    }

    if (this._extensions.onPreHandler.nodes) {
        cycle.push(this._extensions.onPreHandler);
    }

    cycle.push(Handler.execute);                                     // Must not call next() with an Error

    if (this._extensions.onPostHandler.nodes) {
        cycle.push(this._extensions.onPostHandler);                 // An error from here on will override any result set in handler()
    }

    if (this.settings.response._validate &&
        this.settings.response.sample !== 0) {

        cycle.push(Validation.response);
    }

    this._cycle = cycle;
};


internals.state = async function (request) {

    request.state = {};

    const req = request.raw.req;
    const cookies = req.headers.cookie;
    if (!cookies) {
        return;
    }

    let result;
    let parseError;
    try {
        result = await request.server.states.parse(cookies);
    }
    catch (err) {
        parseError = err;
    }

    const { states, failed = [] } = result || parseError;
    request.state = states || {};

    // Clear cookies

    for (let i = 0; i < failed.length; ++i) {
        const item = failed[i];

        if (item.settings.clearInvalid) {
            request._clearState(item.name);
        }
    }

    // failAction: 'error', 'log', 'ignore'

    if (!parseError ||
        request.route.settings.state.failAction === 'ignore') {

        return;
    }

    request._log(['state', 'error'], { header: cookies, errors: parseError.data });
    if (request.route.settings.state.failAction === 'error') {
        return parseError;
    }
};


internals.payload = async function (request) {

    if (request.method === 'get' ||
        request.method === 'head') {            // When route.method is '*'

        return;
    }

    if (request._expectContinue) {
        request.raw.res.writeContinue();
    }

    try {
        const { payload, mime } = await Subtext.parse(request.raw.req, request._tap(), request.route.settings.payload);

        request._isPayloadPending = !!(payload && payload._readableState);
        request.mime = mime;
        request.payload = (payload === undefined ? null : payload);
    }
    catch (err) {
        if (request._isPayloadPending) {
            await internals.drain(request);
        }

        request.mime = err.mime;
        request.payload = null;

        // failAction: 'error', 'log', 'ignore', function (request, reply, error)

        const failAction = request.route.settings.payload.failAction;
        if (failAction === 'ignore') {
            return;
        }

        request._log(['payload', 'error'], err);

        // Log only

        if (failAction === 'log') {
            return;
        }

        // Return error

        if (typeof failAction !== 'function') {
            throw err;
        }

        // Custom handler

        return await request.server._replier.execute(failAction, request, { realm: request.route.realm, args: [err] });
    }
};


internals.drain = async function (request) {

    // Flush out any pending request payload not consumed due to errors

    await Streams.drain(request.raw.req);
    request._isPayloadPending = false;
};


internals.jsonpRegex = /^[\w\$\[\]\.]+$/;


internals.parseJSONP = function (request) {

    const jsonp = request.query[request.route.settings.jsonp];
    if (jsonp) {
        if (internals.jsonpRegex.test(jsonp) === false) {
            throw Boom.badRequest('Invalid JSONP parameter value');
        }

        request.jsonp = jsonp;
    }
};


internals.cleanupJSONP = function (request) {

    if (request.jsonp) {
        delete request.query[request.route.settings.jsonp];
    }
};
