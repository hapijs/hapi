'use strict';

const Boom = require('@hapi/boom');
const Bounce = require('@hapi/bounce');
const Hoek = require('@hapi/hoek');

const Config = require('./config');
const Request = require('./request');


const internals = {
    missing: Symbol('missing')
};


exports = module.exports = internals.Auth = class {

    #core = null;
    #schemes = {};
    #strategies = {};

    api = {};                   // Do not reassign api or settings, as they are referenced in public()
    settings = {
        default: null           // Strategy used as default if route has no auth settings
    };

    constructor(core) {

        this.#core = core;
    }

    public(server) {

        return {
            api: this.api,
            settings: this.settings,
            scheme: this.scheme.bind(this),
            strategy: this._strategy.bind(this, server),
            default: this.default.bind(this),
            test: this.test.bind(this),
            verify: this.verify.bind(this),
            lookup: this.lookup.bind(this)
        };
    }

    scheme(name, scheme) {

        Hoek.assert(name, 'Authentication scheme must have a name');
        Hoek.assert(!this.#schemes[name], 'Authentication scheme name already exists:', name);
        Hoek.assert(typeof scheme === 'function', 'scheme must be a function:', name);

        this.#schemes[name] = scheme;
    }

    _strategy(server, name, scheme, options = {}) {

        Hoek.assert(name, 'Authentication strategy must have a name');
        Hoek.assert(typeof options === 'object', 'options must be an object');
        Hoek.assert(!this.#strategies[name], 'Authentication strategy name already exists');
        Hoek.assert(scheme, 'Authentication strategy', name, 'missing scheme');
        Hoek.assert(this.#schemes[scheme], 'Authentication strategy', name, 'uses unknown scheme:', scheme);

        server = server._clone();
        const strategy = this.#schemes[scheme](server, options);

        Hoek.assert(strategy.authenticate, 'Invalid scheme:', name, 'missing authenticate() method');
        Hoek.assert(typeof strategy.authenticate === 'function', 'Invalid scheme:', name, 'invalid authenticate() method');
        Hoek.assert(!strategy.payload || typeof strategy.payload === 'function', 'Invalid scheme:', name, 'invalid payload() method');
        Hoek.assert(!strategy.response || typeof strategy.response === 'function', 'Invalid scheme:', name, 'invalid response() method');
        strategy.options = strategy.options || {};
        Hoek.assert(strategy.payload || !strategy.options.payload, 'Cannot require payload validation without a payload method');

        this.#strategies[name] = {
            methods: strategy,
            realm: server.realm
        };

        if (strategy.api) {
            this.api[name] = strategy.api;
        }
    }

    default(options) {

        Hoek.assert(!this.settings.default, 'Cannot set default strategy more than once');
        options = Config.apply('auth', options, 'default strategy');

        this.settings.default = this._setupRoute(Hoek.clone(options));      // Prevent changes to options

        const routes = this.#core.router.table();
        for (const route of routes) {
            route.rebuild();
        }
    }

    async test(name, request) {

        Hoek.assert(name, 'Missing authentication strategy name');
        const strategy = this.#strategies[name];
        Hoek.assert(strategy, 'Unknown authentication strategy:', name);

        const bind = strategy.methods;
        const realm = strategy.realm;
        const response = await request._core.toolkit.execute(strategy.methods.authenticate, request, { bind, realm, auth: true });

        if (!response.isAuth) {
            throw response;
        }

        if (response.error) {
            throw response.error;
        }

        return response.data;
    }

    async verify(request) {

        const auth = request.auth;

        if (auth.error) {
            throw auth.error;
        }

        if (!auth.isAuthenticated) {
            return;
        }

        const strategy = this.#strategies[auth.strategy];
        Hoek.assert(strategy, 'Unknown authentication strategy:', auth.strategy);

        if (!strategy.methods.verify) {
            return;
        }

        const bind = strategy.methods;
        await strategy.methods.verify.call(bind, auth);
    }

    static testAccess(request, route) {

        const auth = request._core.auth;

        try {
            return auth._access(request, route);
        }
        catch (err) {
            Bounce.rethrow(err, 'system');
            return false;
        }
    }

    _setupRoute(options, path) {

        if (!options) {
            return options;         // Preserve the difference between undefined and false
        }

        if (typeof options === 'string') {
            options = { strategies: [options] };
        }
        else if (options.strategy) {
            options.strategies = [options.strategy];
            delete options.strategy;
        }

        if (path &&
            !options.strategies) {

            Hoek.assert(this.settings.default, 'Route missing authentication strategy and no default defined:', path);
            options = Hoek.applyToDefaults(this.settings.default, options);
        }

        path = path || 'default strategy';
        Hoek.assert(options.strategies && options.strategies.length, 'Missing authentication strategy:', path);

        options.mode = options.mode || 'required';

        if (options.entity !== undefined ||                                             // Backwards compatibility with <= 11.x.x
            options.scope !== undefined) {

            options.access = [{ entity: options.entity, scope: options.scope }];
            delete options.entity;
            delete options.scope;
        }

        if (options.access) {
            for (const access of options.access) {
                access.scope = internals.setupScope(access);
            }
        }

        if (options.payload === true) {
            options.payload = 'required';
        }

        let hasAuthenticatePayload = false;
        for (const name of options.strategies) {
            const strategy = this.#strategies[name];
            Hoek.assert(strategy, 'Unknown authentication strategy', name, 'in', path);

            Hoek.assert(strategy.methods.payload || options.payload !== 'required', 'Payload validation can only be required when all strategies support it in', path);
            hasAuthenticatePayload = hasAuthenticatePayload || strategy.methods.payload;
            Hoek.assert(!strategy.methods.options.payload || options.payload === undefined || options.payload === 'required', 'Cannot set authentication payload to', options.payload, 'when a strategy requires payload validation in', path);
        }

        Hoek.assert(!options.payload || hasAuthenticatePayload, 'Payload authentication requires at least one strategy with payload support in', path);

        return options;
    }

    lookup(route) {

        if (route.settings.auth === false) {
            return false;
        }

        return route.settings.auth || this.settings.default;
    }

    _enabled(route, type) {

        const config = this.lookup(route);
        if (!config) {
            return false;
        }

        if (type === 'authenticate') {
            return true;
        }

        if (type === 'access') {
            return !!config.access;
        }

        for (const name of config.strategies) {
            const strategy = this.#strategies[name];
            if (strategy.methods[type]) {
                return true;
            }
        }

        return false;
    }

    static authenticate(request) {

        const auth = request._core.auth;
        return auth._authenticate(request);
    }

    async _authenticate(request) {

        const config = this.lookup(request.route);

        const errors = [];
        request.auth.mode = config.mode;

        // Injection bypass

        if (request.auth.credentials) {
            internals.validate(null, { credentials: request.auth.credentials, artifacts: request.auth.artifacts }, request.auth.strategy, config, request, errors);
            return;
        }

        // Try each strategy

        for (const name of config.strategies) {
            const strategy = this.#strategies[name];

            const bind = strategy.methods;
            const realm = strategy.realm;
            const response = await request._core.toolkit.execute(strategy.methods.authenticate, request, { bind, realm, auth: true });

            const message = (response.isAuth ? internals.validate(response.error, response.data, name, config, request, errors) : internals.validate(response, null, name, config, request, errors));
            if (!message) {
                return;
            }

            if (message !== internals.missing) {
                return message;
            }
        }

        // No more strategies

        const err = Boom.unauthorized('Missing authentication', errors);
        if (config.mode === 'required') {
            throw err;
        }

        request.auth.isAuthenticated = false;
        request.auth.credentials = null;
        request.auth.error = err;
        request._log(['auth', 'unauthenticated']);
    }

    static access(request) {

        const auth = request._core.auth;
        request.auth.isAuthorized = auth._access(request);
    }

    _access(request, route) {

        const config = this.lookup(route || request.route);
        if (!config ||
            !config.access) {

            return true;
        }

        const credentials = request.auth.credentials;
        if (!credentials) {
            if (config.mode !== 'required') {
                return false;
            }

            throw Boom.forbidden('Request is unauthenticated');
        }

        const requestEntity = (credentials.user ? 'user' : 'app');

        const scopeErrors = [];
        for (const access of config.access) {

            // Check entity

            const entity = access.entity;
            if (entity &&
                entity !== 'any' &&
                entity !== requestEntity) {

                continue;
            }

            // Check scope

            let scope = access.scope;
            if (scope) {
                if (!credentials.scope) {
                    scopeErrors.push(scope);
                    continue;
                }

                scope = internals.expandScope(request, scope);
                if (!internals.validateScope(credentials, scope, 'required') ||
                    !internals.validateScope(credentials, scope, 'selection') ||
                    !internals.validateScope(credentials, scope, 'forbidden')) {

                    scopeErrors.push(scope);
                    continue;
                }
            }

            return true;
        }

        // Scope error

        if (scopeErrors.length) {
            request._log(['auth', 'scope', 'error']);
            throw Boom.forbidden('Insufficient scope', { got: credentials.scope, need: scopeErrors });
        }

        // Entity error

        if (requestEntity === 'app') {
            request._log(['auth', 'entity', 'user', 'error']);
            throw Boom.forbidden('Application credentials cannot be used on a user endpoint');
        }

        request._log(['auth', 'entity', 'app', 'error']);
        throw Boom.forbidden('User credentials cannot be used on an application endpoint');
    }

    static async payload(request) {

        if (!request.auth.isAuthenticated || !request.auth[Request.symbols.authPayload]) {
            return;
        }

        const auth = request._core.auth;
        const strategy = auth.#strategies[request.auth.strategy];
        Hoek.assert(strategy, 'Unknown authentication strategy:', request.auth.strategy);

        if (!strategy.methods.payload) {
            return;
        }

        const config = auth.lookup(request.route);
        const setting = config.payload || (strategy.methods.options.payload ? 'required' : false);
        if (!setting) {
            return;
        }

        const bind = strategy.methods;
        const realm = strategy.realm;
        const response = await request._core.toolkit.execute(strategy.methods.payload, request, { bind, realm });

        if (response.isBoom &&
            response.isMissing) {

            return setting === 'optional' ? undefined : Boom.unauthorized('Missing payload authentication');
        }

        return response;
    }

    static async response(response) {

        const request = response.request;
        const auth = request._core.auth;
        if (!request.auth.isAuthenticated) {
            return;
        }

        const strategy = auth.#strategies[request.auth.strategy];
        Hoek.assert(strategy, 'Unknown authentication strategy:', request.auth.strategy);

        if (!strategy.methods.response) {
            return;
        }

        const bind = strategy.methods;
        const realm = strategy.realm;
        const error = await request._core.toolkit.execute(strategy.methods.response, request, { bind, realm, continue: 'undefined' });
        if (error) {
            throw error;
        }
    }
};


internals.setupScope = function (access) {

    // No scopes

    if (!access.scope) {
        return false;
    }

    // Already setup

    if (!Array.isArray(access.scope)) {
        return access.scope;
    }

    const scope = {};
    for (const value of access.scope) {
        const prefix = value[0];
        const type = prefix === '+' ? 'required' : (prefix === '!' ? 'forbidden' : 'selection');
        const clean = type === 'selection' ? value : value.slice(1);
        scope[type] = scope[type] || [];
        scope[type].push(clean);

        if ((!scope._hasParameters || !scope._hasParameters[type]) &&
            /{([^}]+)}/.test(clean)) {

            scope._hasParameters = scope._hasParameters || {};
            scope._hasParameters[type] = true;
        }
    }

    return scope;
};


internals.validate = function (err, result, name, config, request, errors) {                 // err can be Boom, Error, or a valid response object

    result = result || {};
    request.auth.isAuthenticated = !err;

    if (err) {

        // Non-error response

        if (err instanceof Error === false) {
            request._log(['auth', 'unauthenticated', 'response', name], { statusCode: err.statusCode });
            return err;
        }

        // Missing authenticated

        if (err.isMissing) {
            request._log(['auth', 'unauthenticated', 'missing', name], err);
            errors.push(err.output.headers['WWW-Authenticate']);
            return internals.missing;
        }
    }

    request.auth.strategy = name;
    request.auth.credentials = result.credentials;
    request.auth.artifacts = result.artifacts;

    // Authenticated

    if (!err) {
        return;
    }

    // Unauthenticated

    request.auth.error = err;

    if (config.mode === 'try') {
        request._log(['auth', 'unauthenticated', 'try', name], err);
        return;
    }

    request._log(['auth', 'unauthenticated', 'error', name], err);
    throw err;
};


internals.expandScope = function (request, scope) {

    if (!scope._hasParameters) {
        return scope;
    }

    const expanded = {
        required: internals.expandScopeType(request, scope, 'required'),
        selection: internals.expandScopeType(request, scope, 'selection'),
        forbidden: internals.expandScopeType(request, scope, 'forbidden')
    };

    return expanded;
};


internals.expandScopeType = function (request, scope, type) {

    if (!scope._hasParameters[type]) {
        return scope[type];
    }

    const expanded = [];
    const context = {
        params: request.params,
        query: request.query,
        payload: request.payload,
        credentials: request.auth.credentials
    };

    for (const template of scope[type]) {
        expanded.push(Hoek.reachTemplate(context, template));
    }

    return expanded;
};


internals.validateScope = function (credentials, scope, type) {

    if (!scope[type]) {
        return true;
    }

    const count = typeof credentials.scope === 'string' ?
        scope[type].indexOf(credentials.scope) !== -1 ? 1 : 0 :
        Hoek.intersect(scope[type], credentials.scope).length;

    if (type === 'forbidden') {
        return count === 0;
    }

    if (type === 'required') {
        return count === scope.required.length;
    }

    return !!count;
};
