'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');

const Config = require('./config');


// Declare internals

const internals = {
    missing: Symbol('missing')
};


exports = module.exports = internals.Auth = class {

    constructor(core) {

        this._core = core;
        this._schemes = {};
        this._strategies = {};
        this.settings = {
            default: null           // Strategy used as default if route has no auth settings
        };

        this.api = {};
    }

    scheme(name, scheme) {

        Hoek.assert(name, 'Authentication scheme must have a name');
        Hoek.assert(!this._schemes[name], 'Authentication scheme name already exists:', name);
        Hoek.assert(typeof scheme === 'function', 'scheme must be a function:', name);

        this._schemes[name] = scheme;
    }

    _strategy(server, name, scheme, ...args /*, mode, options */) {

        const hasMode = (typeof args[0] === 'string' || typeof args[0] === 'boolean');
        const mode = (hasMode ? args[0] : false);
        const options = (hasMode ? args[1] : args[0]) || null;

        Hoek.assert(name, 'Authentication strategy must have a name');
        Hoek.assert(name !== 'bypass', 'Cannot use reserved strategy name: bypass');
        Hoek.assert(!this._strategies[name], 'Authentication strategy name already exists');
        Hoek.assert(scheme, 'Authentication strategy', name, 'missing scheme');
        Hoek.assert(this._schemes[scheme], 'Authentication strategy', name, 'uses unknown scheme:', scheme);

        server = server._clone();
        const strategy = this._schemes[scheme](server, options);

        Hoek.assert(strategy.authenticate, 'Invalid scheme:', name, 'missing authenticate() method');
        Hoek.assert(typeof strategy.authenticate === 'function', 'Invalid scheme:', name, 'invalid authenticate() method');
        Hoek.assert(!strategy.payload || typeof strategy.payload === 'function', 'Invalid scheme:', name, 'invalid payload() method');
        Hoek.assert(!strategy.response || typeof strategy.response === 'function', 'Invalid scheme:', name, 'invalid response() method');
        strategy.options = strategy.options || {};
        Hoek.assert(strategy.payload || !strategy.options.payload, 'Cannot require payload validation without a payload method');

        this._strategies[name] = {
            methods: strategy,
            realm: server.realm
        };

        if (strategy.api) {
            this.api[name] = strategy.api;
        }

        if (mode) {
            this.default({ strategies: [name], mode: mode === true ? 'required' : mode });
        }
    }

    default(options) {

        Hoek.assert(!this.settings.default, 'Cannot set default strategy more than once');
        options = Config.apply('auth', options, 'default strategy');

        this.settings.default = this._setupRoute(Hoek.clone(options));      // Prevent changes to options

        const routes = this._core.router.table();
        for (let i = 0; i < routes.length; ++i) {
            routes[i].rebuild();
        }
    }

    async test(name, request) {

        Hoek.assert(name, 'Missing authentication strategy name');
        const strategy = this._strategies[name];
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

        return response.data.credentials;
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
            for (let i = 0; i < options.access.length; ++i) {
                const access = options.access[i];
                access.scope = internals.setupScope(access);
            }
        }

        if (options.payload === true) {
            options.payload = 'required';
        }

        let hasAuthenticatePayload = false;
        for (let i = 0; i < options.strategies.length; ++i) {
            const name = options.strategies[i];
            const strategy = this._strategies[name];
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

        for (let i = 0; i < config.strategies.length; ++i) {
            const name = config.strategies[i];
            const strategy = this._strategies[name];
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

    static access(request, route) {

        const auth = request._core.auth;
        const config = auth.lookup(route);
        if (!config) {
            return true;
        }

        const credentials = request.auth.credentials;
        if (!credentials) {
            return false;
        }

        return !internals.access(request, config, credentials, 'bypass');
    }

    _authenticate(request) {

        const config = this.lookup(request.route);
        return internals.authenticate(config, request, this);
    }

    static async payload(request) {

        if (!request.auth.isAuthenticated ||
            request.auth.strategy === 'bypass') {

            return;
        }

        const auth = request._core.auth;
        const strategy = auth._strategies[request.auth.strategy];

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

            return (setting === 'optional' ? undefined : Boom.unauthorized('Missing payload authentication'));
        }

        return response;
    }

    static async response(request) {

        const auth = request._core.auth;
        if (!request.auth.isAuthenticated ||
            request.auth.strategy === 'bypass') {

            return;
        }

        const strategy = auth._strategies[request.auth.strategy];
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

    if (!access.scope) {
        return false;
    }

    const scope = {};
    for (let i = 0; i < access.scope.length; ++i) {
        const value = access.scope[i];
        const prefix = value[0];
        const type = (prefix === '+' ? 'required' : (prefix === '!' ? 'forbidden' : 'selection'));
        const clean = (type === 'selection' ? value : value.slice(1));
        scope[type] = scope[type] || [];
        scope[type].push(clean);

        if ((!scope._parameters || !scope._parameters[type]) &&
            /{([^}]+)}/.test(clean)) {

            scope._parameters = scope._parameters || {};
            scope._parameters[type] = true;
        }
    }

    return scope;
};


internals.authenticate = async function (config, request, manager) {

    const errors = [];
    request.auth.mode = config.mode;

    // Injection bypass

    if (request.auth.credentials) {
        internals.validate(null, { credentials: request.auth.credentials, artifacts: request.auth.artifacts }, 'bypass', config, request, errors);
        return;
    }

    // Try each strategy

    for (let i = 0; i < config.strategies.length; ++i) {
        const name = config.strategies[i];
        const strategy = manager._strategies[name];

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
    if (config.mode !== 'optional' &&
        config.mode !== 'try') {

        throw err;
    }

    request.auth.isAuthenticated = false;
    request.auth.credentials = null;
    request.auth.error = err;
    request._log(['auth', 'unauthenticated']);
};


internals.validate = function (err, result, name, config, request, errors) {                 // err can be Boom, Error, or a valid response object

    result = result || {};

    // Unauthenticated

    if (err) {
        if (err instanceof Error === false) {
            request._log(['auth', 'unauthenticated', 'response', name], err.statusCode);
            return err;     // Non-error response
        }

        if (err.isMissing) {

            // Try next strategy

            request._log(['auth', 'unauthenticated', 'missing', name], err);
            errors.push(err.output.headers['WWW-Authenticate']);
            return internals.missing;
        }

        if (config.mode === 'try') {
            request.auth.isAuthenticated = false;
            request.auth.strategy = name;
            request.auth.credentials = result.credentials;
            request.auth.artifacts = result.artifacts;
            request.auth.error = err;
            request._log(['auth', 'unauthenticated', 'try', name], err);
            return;
        }

        request._log(['auth', 'unauthenticated', 'error', name], err);
        throw err;
    }

    // Authenticated

    const credentials = result.credentials;
    request.auth.strategy = name;
    request.auth.credentials = credentials;
    request.auth.artifacts = result.artifacts;

    // Check access rules

    const error = internals.access(request, config, credentials, name);
    if (error) {
        request._log(error.tags, error.data);
        throw error.err;
    }

    request.auth.isAuthenticated = true;
};


internals.access = function (request, config, credentials, name) {

    if (!config.access) {
        return null;
    }

    const requestEntity = (credentials.user ? 'user' : 'app');

    const scopeErrors = [];
    for (let i = 0; i < config.access.length; ++i) {
        const access = config.access[i];

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

        return null;
    }

    // Scope error

    if (scopeErrors.length) {
        const data = { got: credentials.scope, need: scopeErrors };
        return { err: Boom.forbidden('Insufficient scope', data), tags: ['auth', 'scope', 'error', name], data };
    }

    // Entity error

    if (requestEntity === 'app') {
        return { err: Boom.forbidden('Application credentials cannot be used on a user endpoint'), tags: ['auth', 'entity', 'user', 'error', name] };
    }

    return { err: Boom.forbidden('User credentials cannot be used on an application endpoint'), tags: ['auth', 'entity', 'app', 'error', name] };
};


internals.expandScope = function (request, scope) {

    if (!scope._parameters) {
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

    if (!scope[type] ||
        !scope._parameters[type]) {

        return scope[type];
    }

    const expanded = [];
    const context = {
        params: request.params,
        query: request.query
    };

    for (let i = 0; i < scope[type].length; ++i) {
        expanded.push(Hoek.reachTemplate(context, scope[type][i]));
    }

    return expanded;
};


internals.validateScope = function (credentials, scope, type) {

    if (!scope[type]) {
        return true;
    }

    const count = typeof credentials.scope === 'string' ?
        (scope[type].indexOf(credentials.scope) !== -1 ? 1 : 0) :
        Hoek.intersect(scope[type], credentials.scope).length;

    if (type === 'forbidden') {
        return count === 0;
    }

    if (type === 'required') {
        return count === scope.required.length;
    }

    return !!count;
};
