'use strict';

const Assert = require('assert');

const Boom = require('@hapi/boom');
const Bounce = require('@hapi/bounce');
const Catbox = require('@hapi/catbox');
const Hoek = require('@hapi/hoek');
const Joi = require('@hapi/joi');
const Subtext = require('@hapi/subtext');

const Auth = require('./auth');
const Config = require('./config');
const Cors = require('./cors');
const Ext = require('./ext');
const Handler = require('./handler');
const Headers = require('./headers');
const Security = require('./security');
const Streams = require('./streams');
const Validation = require('./validation');


const internals = {};


exports = module.exports = internals.Route = class {

    constructor(route, server, options = {}) {

        const core = server._core;
        const realm = server.realm;

        // Routing information

        Config.apply('route', route, route.method, route.path);

        const method = route.method.toLowerCase();
        Hoek.assert(method !== 'head', 'Cannot set HEAD route:', route.path);

        const path = realm.modifiers.route.prefix ? realm.modifiers.route.prefix + (route.path !== '/' ? route.path : '') : route.path;
        Hoek.assert(path === '/' || path[path.length - 1] !== '/' || !core.settings.router.stripTrailingSlash, 'Path cannot end with a trailing slash when configured to strip:', route.method, route.path);

        const vhost = realm.modifiers.route.vhost || route.vhost;

        // Set identifying members (assert)

        this.method = method;
        this.path = path;

        // Prepare configuration

        let config = route.options || route.config || {};
        if (typeof config === 'function') {
            config = config.call(realm.settings.bind, server);
        }

        config = Config.enable(config);     // Shallow clone

        // Verify route level config (as opposed to the merged settings)

        this._assert(method !== 'get' || !config.payload, 'Cannot set payload settings on HEAD or GET request');
        this._assert(method !== 'get' || !config.validate || !config.validate.payload, 'Cannot validate HEAD or GET request payload');

        // Rules

        this._assert(!route.rules || !config.rules, 'Route rules can only appear once');                    // XOR
        const rules = route.rules || config.rules;
        const rulesConfig = internals.rules(rules, { method, path, vhost }, server);
        delete config.rules;

        // Handler

        this._assert(route.handler || config.handler, 'Missing or undefined handler');
        this._assert(!!route.handler ^ !!config.handler, 'Handler must only appear once');                  // XOR

        const handler = Config.apply('handler', route.handler || config.handler);
        delete config.handler;

        const handlerDefaults = Handler.defaults(method, handler, core);

        // Apply settings in order: server <- handler <- realm <- route

        const settings = internals.config([core.settings.routes, handlerDefaults, realm.settings, rulesConfig, config]);
        this.settings = Config.apply('routeConfig', settings, method, path);

        // Validate timeouts

        const socketTimeout = this.settings.timeout.socket === undefined ? 2 * 60 * 1000 : this.settings.timeout.socket;
        this._assert(!this.settings.timeout.server || !socketTimeout || this.settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout');
        this._assert(!this.settings.payload.timeout || !socketTimeout || this.settings.payload.timeout < socketTimeout, 'Payload timeout must be shorter than socket timeout');

        // Route members

        this._core = core;
        this.realm = realm;

        this.settings.vhost = vhost;
        this.settings.plugins = this.settings.plugins || {};            // Route-specific plugins settings, namespaced using plugin name
        this.settings.app = this.settings.app || {};                    // Route-specific application settings

        // Path parsing

        this._special = !!options.special;
        this._analysis = this._core.router.analyze(this.path);
        this.params = this._analysis.params;
        this.fingerprint = this._analysis.fingerprint;

        this.public = {
            method: this.method,
            path: this.path,
            vhost,
            realm,
            settings: this.settings,
            fingerprint: this.fingerprint,
            auth: {
                access: (request) => Auth.testAccess(request, this.public)
            }
        };

        // Validation

        this._setupValidation();

        // Payload parsing

        if (this.method === 'get') {
            this.settings.payload = null;
        }
        else {
            this.settings.payload.decoders = this._core.compression.decoders;       // Reference the shared object to keep up to date
        }

        this._assert(!this.settings.validate.payload || this.settings.payload.parse, 'Route payload must be set to \'parse\' when payload validation enabled');
        this._assert(!this.settings.validate.state || this.settings.state.parse, 'Route state must be set to \'parse\' when state validation enabled');
        this._assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name');

        // Authentication configuration

        this.settings.auth = this._special ? false : this._core.auth._setupRoute(this.settings.auth, path);

        // Cache

        if (this.method === 'get' &&
            typeof this.settings.cache === 'object' &&
            (this.settings.cache.expiresIn || this.settings.cache.expiresAt)) {

            this.settings.cache._statuses = new Set(this.settings.cache.statuses);
            this._cache = new Catbox.Policy({ expiresIn: this.settings.cache.expiresIn, expiresAt: this.settings.cache.expiresAt });
        }

        // CORS

        this.settings.cors = Cors.route(this.settings.cors);

        // Security

        this.settings.security = Security.route(this.settings.security);

        // Handler

        this.settings.handler = Handler.configure(handler, this);
        this._prerequisites = Handler.prerequisitesConfig(this.settings.pre);

        // Route lifecycle

        this._extensions = {
            onPreResponse: Ext.combine(this, 'onPreResponse')
        };

        if (this._special) {
            this._cycle = [internals.drain, Handler.execute];
            this.rebuild();
            return;
        }

        this._extensions.onPreAuth = Ext.combine(this, 'onPreAuth');
        this._extensions.onCredentials = Ext.combine(this, 'onCredentials');
        this._extensions.onPostAuth = Ext.combine(this, 'onPostAuth');
        this._extensions.onPreHandler = Ext.combine(this, 'onPreHandler');
        this._extensions.onPostHandler = Ext.combine(this, 'onPostHandler');

        this.rebuild();
    }

    _setupValidation() {

        const validation = this.settings.validate;
        if (this.method === 'get') {
            validation.payload = null;
        }

        this._assert(!validation.params || this.params.length, 'Cannot set path parameters validations without path parameters');

        const validator = this._validator();

        for (const type of ['headers', 'params', 'query', 'payload', 'state']) {
            validation[type] = Validation.compile(validation[type], validator);
        }

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
                this.settings.response.schema = Validation.compile(rule, validator);
                for (const code of statuses) {
                    this.settings.response.status[code] = Validation.compile(this.settings.response.status[code], validator);
                }
            }
        }
    }

    rebuild(event) {

        if (event) {
            this._extensions[event.type].add(event);
        }

        if (this._special) {
            this._postCycle = this._extensions.onPreResponse.nodes ? [this._extensions.onPreResponse] : [];
            this._buildMarshalCycle();
            return;
        }

        // Build lifecycle array

        this._cycle = [];

        // 'onRequest'

        if (this.settings.jsonp) {
            this._cycle.push(internals.parseJSONP);
        }

        if (this.settings.state.parse) {
            this._cycle.push(internals.state);
        }

        if (this._extensions.onPreAuth.nodes) {
            this._cycle.push(this._extensions.onPreAuth);
        }

        if (this._core.auth._enabled(this, 'authenticate')) {
            this._cycle.push(Auth.authenticate);
        }

        if (this.method !== 'get') {
            this._cycle.push(internals.payload);

            if (this._core.auth._enabled(this, 'payload')) {
                this._cycle.push(Auth.payload);
            }
        }

        if (this._core.auth._enabled(this, 'authenticate') &&
            this._extensions.onCredentials.nodes) {

            this._cycle.push(this._extensions.onCredentials);
        }

        if (this._core.auth._enabled(this, 'access')) {
            this._cycle.push(Auth.access);
        }

        if (this._extensions.onPostAuth.nodes) {
            this._cycle.push(this._extensions.onPostAuth);
        }

        if (this.settings.validate.headers) {
            this._cycle.push(Validation.headers);
        }

        if (this.settings.validate.params) {
            this._cycle.push(Validation.params);
        }

        if (this.settings.jsonp) {
            this._cycle.push(internals.cleanupJSONP);
        }

        if (this.settings.validate.query) {
            this._cycle.push(Validation.query);
        }

        if (this.settings.validate.payload) {
            this._cycle.push(Validation.payload);
        }

        if (this.settings.validate.state) {
            this._cycle.push(Validation.state);
        }

        if (this._extensions.onPreHandler.nodes) {
            this._cycle.push(this._extensions.onPreHandler);
        }

        this._cycle.push(Handler.execute);

        if (this._extensions.onPostHandler.nodes) {
            this._cycle.push(this._extensions.onPostHandler);
        }

        this._postCycle = [];

        if (this.settings.response._validate &&
            this.settings.response.sample !== 0) {

            this._postCycle.push(Validation.response);
        }

        if (this._extensions.onPreResponse.nodes) {
            this._postCycle.push(this._extensions.onPreResponse);
        }

        this._buildMarshalCycle();
    }

    _buildMarshalCycle() {

        this._marshalCycle = [Headers.type];

        if (this.settings.cors) {
            this._marshalCycle.push(Cors.headers);
        }

        if (this.settings.security) {
            this._marshalCycle.push(Security.headers);
        }

        this._marshalCycle.push(Headers.entity);

        if (this.method === 'get' ||
            this.method === '*') {

            this._marshalCycle.push(Headers.unmodified);
        }

        this._marshalCycle.push(Headers.cache);
        this._marshalCycle.push(Headers.state);
        this._marshalCycle.push(Headers.content);

        if (this._core.auth._enabled(this, 'response')) {
            this._marshalCycle.push(Auth.response);                            // Must be last in case requires access to headers
        }
    }

    _assert(condition, message) {

        if (condition) {
            return;
        }

        if (this.method[0] !== '_') {
            message = `${message}: ${this.method.toUpperCase()} ${this.path}`;
        }

        throw new Assert.AssertionError({
            message,
            actual: false,
            expected: true,
            operator: '==',
            stackStartFunction: this._assert
        });
    }

    _validator() {

        if (this.settings.validate.validator) {
            return this.settings.validate.validator;
        }

        let realm = this.realm;
        while (realm) {
            if (realm.validator) {
                return realm.validator;
            }

            realm = realm.parent;
        }

        return this._core.validator;
    }
};


internals.state = async function (request) {

    request.state = {};

    const req = request.raw.req;
    const cookies = req.headers.cookie;
    if (!cookies) {
        return;
    }

    try {
        var result = await request._core.states.parse(cookies);
    }
    catch (err) {
        Bounce.rethrow(err, 'system');
        var parseError = err;
    }

    const { states, failed = [] } = result || parseError;
    request.state = states || {};

    // Clear cookies

    for (const item of failed) {
        if (item.settings.clearInvalid) {
            request._clearState(item.name);
        }
    }

    if (!parseError) {
        return;
    }

    parseError.header = cookies;

    return request._core.toolkit.failAction(request, request.route.settings.state.failAction, parseError, { tags: ['state', 'error'] });
};


internals.payload = async function (request) {

    if (request.method === 'get' ||
        request.method === 'head') {            // When route.method is '*'

        return;
    }

    if (request._expectContinue) {
        request.raw.res.writeContinue();
    }

    if (request.payload !== undefined) {
        return internals.drain(request);
    }

    try {
        const { payload, mime } = await Subtext.parse(request.raw.req, request._tap(), request.route.settings.payload);

        request._isPayloadPending = !!(payload && payload._readableState);
        request.mime = mime;
        request.payload = payload;
    }
    catch (err) {
        Bounce.rethrow(err, 'system');

        if (request._isPayloadPending) {
            await internals.drain(request);
        }

        request.mime = err.mime;
        request.payload = null;

        return request._core.toolkit.failAction(request, request.route.settings.payload.failAction, err, { tags: ['payload', 'error'] });
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


internals.config = function (chain) {

    if (!chain.length) {
        return {};
    }

    let config = chain[0];
    for (const item of chain) {
        config = Hoek.applyToDefaults(config, item, { shallow: ['bind', 'validate.headers', 'validate.payload', 'validate.params', 'validate.query', 'validate.state'] });
    }

    return config;
};


internals.rules = function (rules, info, server) {

    const configs = [];

    let realm = server.realm;
    while (realm) {
        if (realm._rules) {
            const source = !realm._rules.settings.validate ? rules : Joi.attempt(rules, realm._rules.settings.validate.schema, realm._rules.settings.validate.options);
            const config = realm._rules.processor(source, info);
            if (config) {
                configs.unshift(config);
            }
        }

        realm = realm.parent;
    }

    return internals.config(configs);
};
