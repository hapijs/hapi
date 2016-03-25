'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');
const Schema = require('./schema');


// Declare internals

const internals = {};


exports = module.exports = internals.Auth = function (connection) {

    this.connection = connection;
    this._schemes = {};
    this._strategies = {};
    this.settings = {
        default: null           // Strategy used as default if route has no auth settings
    };

    this.api = {};
};


internals.Auth.prototype.scheme = function (name, scheme) {

    Hoek.assert(name, 'Authentication scheme must have a name');
    Hoek.assert(!this._schemes[name], 'Authentication scheme name already exists:', name);
    Hoek.assert(typeof scheme === 'function', 'scheme must be a function:', name);

    this._schemes[name] = scheme;
};


internals.Auth.prototype.strategy = function (name, scheme /*, mode, options */) {

    const hasMode = (typeof arguments[2] === 'string' || typeof arguments[2] === 'boolean');
    const mode = (hasMode ? arguments[2] : false);
    const options = (hasMode ? arguments[3] : arguments[2]) || null;

    Hoek.assert(name, 'Authentication strategy must have a name');
    Hoek.assert(name !== 'bypass', 'Cannot use reserved strategy name: bypass');
    Hoek.assert(!this._strategies[name], 'Authentication strategy name already exists');
    Hoek.assert(scheme, 'Authentication strategy', name, 'missing scheme');
    Hoek.assert(this._schemes[scheme], 'Authentication strategy', name, 'uses unknown scheme:', scheme);

    const server = this.connection.server._clone([this.connection], '');
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
};


internals.Auth.prototype.default = function (options) {

    Hoek.assert(!this.settings.default, 'Cannot set default strategy more than once');
    options = Schema.apply('auth', options, 'default strategy');

    this.settings.default = this._setupRoute(Hoek.clone(options));      // Can change options
};


internals.Auth.prototype.test = function (name, request, next) {

    Hoek.assert(name, 'Missing authentication strategy name');
    const strategy = this._strategies[name];
    Hoek.assert(strategy, 'Unknown authentication strategy:', name);

    const transfer = (response, data) => {

        return next(response, data && data.credentials);
    };

    const reply = request.server._replier.interface(request, strategy.realm, transfer);
    strategy.methods.authenticate(request, reply);
};


internals.Auth.prototype._setupRoute = function (options, path) {

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
            access.scope = internals.scope(access);
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
};


internals.scope = function (access) {

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


internals.Auth.prototype.lookup = function (route) {

    if (route.settings.auth === false) {
        return false;
    }

    return route.settings.auth || this.settings.default;
};


internals.Auth.authenticate = function (request, next) {

    const auth = request.connection.auth;
    return auth._authenticate(request, next);
};


internals.Auth.prototype._authenticate = function (request, next) {

    const config = this.lookup(request.route);
    if (!config) {
        return next();
    }

    const authenticator = new internals.Authenticator(config, request, this);
    authenticator.authenticate(next);
};


internals.Auth.payload = function (request, next) {

    if (!request.auth.isAuthenticated ||
        request.auth.strategy === 'bypass') {

        return next();
    }

    const auth = request.connection.auth;
    const strategy = auth._strategies[request.auth.strategy];

    if (!strategy.methods.payload) {
        return next();
    }

    const config = auth.lookup(request.route);
    const setting = config.payload || (strategy.methods.options.payload ? 'required' : false);
    if (!setting) {
        return next();
    }

    const finalize = (response) => {

        if (response &&
            response.isBoom &&
            response.isMissing) {

            return next(setting === 'optional' ? null : Boom.unauthorized('Missing payload authentication'));
        }

        return next(response);
    };

    request._protect.run(finalize, (exit) => {

        const reply = request.server._replier.interface(request, strategy.realm, exit);
        strategy.methods.payload(request, reply);
    });
};


internals.Auth.response = function (request, next) {

    const auth = request.connection.auth;
    const config = auth.lookup(request.route);
    if (!config ||
        !request.auth.isAuthenticated ||
        request.auth.strategy === 'bypass') {

        return next();
    }

    const strategy = auth._strategies[request.auth.strategy];
    if (!strategy.methods.response) {
        return next();
    }

    request._protect.run(next, (exit) => {

        const reply = request.server._replier.interface(request, strategy.realm, exit);
        strategy.methods.response(request, reply);
    });
};


internals.Authenticator = class {
    constructor(config, request, manager) {

        this.config = config;
        this.request = request;
        this.manager = manager;

        this.errors = [];
        this.current = -1;
    }

    authenticate(next) {

        this.request.auth.mode = this.config.mode;

        // Injection bypass

        if (this.request.auth.credentials) {
            return this.validate(null, { credentials: this.request.auth.credentials, artifacts: this.request.auth.artifacts }, next);
        }

        // Authenticate

        return this.execute(next);
    }

    execute(next) {

        const config = this.config;
        const request = this.request;

        // Find next strategy

        ++this.current;
        if (this.current < config.strategies.length) {
            const name = config.strategies[this.current];
            const after = (err, result) => this.validate(err, result, next);
            request._protect.run(after, (exit) => {

                const strategy = this.manager._strategies[name];
                const reply = request.server._replier.interface(request, strategy.realm, exit);
                strategy.methods.authenticate(request, reply);
            });

            return;
        }

        // No more strategies

        const err = Boom.unauthorized('Missing authentication', this.errors);

        if (config.mode === 'optional' ||
            config.mode === 'try') {

            request.auth.isAuthenticated = false;
            request.auth.credentials = null;
            request.auth.error = err;
            request._log(['auth', 'unauthenticated']);
            return next();
        }

        return next(err);
    }

    validate(err, result, next) {                 // err can be Boom, Error, or a valid response object

        const config = this.config;
        const request = this.request;
        const name = config.strategies[this.current] || 'bypass';

        result = result || {};

        // Invalid

        if (!err &&
            !result.credentials) {

            return next(Boom.badImplementation('Authentication response missing both error and credentials'));
        }

        // Unauthenticated

        if (err) {
            if (err instanceof Error === false) {
                request._log(['auth', 'unauthenticated', 'response', name], err.statusCode);
                return next(err);
            }

            if (err.isMissing) {

                // Try next name

                request._log(['auth', 'unauthenticated', 'missing', name], err);
                this.errors.push(err.output.headers['WWW-Authenticate']);
                return this.execute(next);
            }

            if (config.mode === 'try') {
                request.auth.isAuthenticated = false;
                request.auth.strategy = name;
                request.auth.credentials = result.credentials;
                request.auth.artifacts = result.artifacts;
                request.auth.error = err;
                request._log(['auth', 'unauthenticated', 'try', name], err);
                return next();
            }

            request._log(['auth', 'unauthenticated', 'error', name], err);
            return next(err);
        }

        // Authenticated

        const credentials = result.credentials;
        request.auth.strategy = name;
        request.auth.credentials = credentials;
        request.auth.artifacts = result.artifacts;

        const authenticated = () => {

            request._log(['auth', name]);
            request.auth.isAuthenticated = true;
            return next();
        };

        // Check access rules

        if (!config.access) {
            return authenticated();
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

            return authenticated();
        }

        // Scope error

        if (scopeErrors.length) {
            request._log(['auth', 'scope', 'error', name], { got: credentials.scope, need: scopeErrors });
            return next(Boom.forbidden('Insufficient scope'));
        }

        // Entity error

        if (requestEntity === 'app') {
            request._log(['auth', 'entity', 'user', 'error', name]);
            return next(Boom.forbidden('Application credentials cannot be used on a user endpoint'));
        }

        request._log(['auth', 'entity', 'app', 'error', name]);
        return next(Boom.forbidden('User credentials cannot be used on an application endpoint'));
    }
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

    const count = (typeof credentials.scope === 'string' ? (scope[type].indexOf(credentials.scope) !== -1 ? 1 : 0)
                                                         : Hoek.intersect(scope[type], credentials.scope).length);

    if (type === 'forbidden') {
        return count === 0;
    }

    if (type === 'required') {
        return count === scope.required.length;
    }

    return !!count;
};
