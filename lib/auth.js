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

    if (mode) {
        this.default({ strategies: [name], mode: mode === true ? 'required' : mode });
    }
};


internals.Auth.prototype.default = function (options) {

    options = Schema.apply('auth', options, 'default strategy');
    Hoek.assert(!this.settings.default, 'Cannot set default strategy more than once');

    let settings = Hoek.clone(options);             // options can be reused

    if (typeof settings === 'string') {
        settings = {
            strategies: [settings],
            mode: 'required'
        };
    }
    else if (settings.strategy) {
        settings.strategies = [settings.strategy];
        delete settings.strategy;
    }

    Hoek.assert(settings.strategies && settings.strategies.length, 'Default authentication strategy missing strategy name');

    this.settings.default = settings;
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
        return options;         // Preseve the difference between undefined and false
    }

    if (typeof options === 'string') {
        options = { strategies: [options] };
    }
    else if (options.strategy) {
        options.strategies = [options.strategy];
        delete options.strategy;
    }

    if (!options.strategies) {
        Hoek.assert(this.settings.default, 'Route missing authentication strategy and no default defined:', path);
        options = Hoek.applyToDefaults(this.settings.default, options);
    }

    if (options.scope) {
        if (typeof options.scope === 'string') {
            options.scope = [options.scope];
        }

        for (let i = 0; i < options.scope.length; ++i) {
            if (/{([^}]+)}/.test(options.scope[i])) {
                options.hasScopeParameters = true;
                break;
            }
        }
    }

    Hoek.assert(options.strategies.length, 'Route missing authentication strategy:', path);

    options.mode = options.mode || 'required';
    if (options.payload === true) {
        options.payload = 'required';
    }

    let hasAuthenticatePayload = false;
    options.strategies.forEach((name) => {

        const strategy = this._strategies[name];
        Hoek.assert(strategy, 'Unknown authentication strategy:', name, 'in path:', path);
        Hoek.assert(strategy.methods.payload || options.payload !== 'required', 'Payload validation can only be required when all strategies support it in path:', path);
        hasAuthenticatePayload = hasAuthenticatePayload || strategy.methods.payload;
        Hoek.assert(!strategy.methods.options.payload || options.payload === undefined || options.payload === 'required', 'Cannot set authentication payload to', options.payload, 'when a strategy requires payload validation', path);
    });

    Hoek.assert(!options.payload || hasAuthenticatePayload, 'Payload authentication requires at least one strategy with payload support in path:', path);

    return options;
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

    request.auth.mode = config.mode;

    const authErrors = [];
    let strategyPos = 0;

    const authenticate = () => {

        // Find next strategy

        if (strategyPos >= config.strategies.length) {
            const err = Boom.unauthorized('Missing authentication', authErrors);

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

        const name = config.strategies[strategyPos];
        ++strategyPos;

        request._protect.run(validate, (exit) => {

            const transfer = (response, data) => {

                exit(response, name, data);
            };

            const strategy = this._strategies[name];
            const reply = request.server._replier.interface(request, strategy.realm, transfer);
            strategy.methods.authenticate(request, reply);
        });
    };

    const validate = (err, name, result) => {               // err can be Boom, Error, or a valid response object

        if (!name) {
            return next(err);
        }

        result = result || {};

        // Unauthenticated

        if (!err &&
            !result.credentials) {

            return next(Boom.badImplementation('Authentication response missing both error and credentials'));
        }

        if (err) {
            if (err instanceof Error === false) {
                request._log(['auth', 'unauthenticated', 'response', name], err.statusCode);
                return next(err);
            }

            if (err.isMissing) {

                // Try next name

                request._log(['auth', 'unauthenticated', 'missing', name], err);
                authErrors.push(err.output.headers['WWW-Authenticate']);
                return authenticate();
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

        // Check scope

        if (config.scope) {
            let scopes = config.scope;
            if (config.hasScopeParameters) {
                scopes = [];
                const context = { params: request.params, query: request.query };
                for (let i = 0; i < config.scope.length; ++i) {
                    scopes[i] = Hoek.reachTemplate(context, config.scope[i]);
                }
            }

            if (!credentials.scope ||
                (typeof credentials.scope === 'string' ? scopes.indexOf(credentials.scope) === -1 : !Hoek.intersect(scopes, credentials.scope).length)) {

                request._log(['auth', 'scope', 'error', name], { got: credentials.scope, need: scopes });
                return next(Boom.forbidden('Insufficient scope, expected any of: ' + scopes));
            }
        }

        // Check entity

        const entity = config.entity || 'any';

        // Entity: 'any'

        if (entity === 'any') {
            request._log(['auth', name]);
            request.auth.isAuthenticated = true;
            return next();
        }

        // Entity: 'user'

        if (entity === 'user') {
            if (!credentials.user) {
                request._log(['auth', 'entity', 'user', 'error', name]);
                return next(Boom.forbidden('Application credentials cannot be used on a user endpoint'));
            }

            request._log(['auth', name]);
            request.auth.isAuthenticated = true;
            return next();
        }

        // Entity: 'app'

        if (credentials.user) {
            request._log(['auth', 'entity', 'app', 'error', name]);
            return next(Boom.forbidden('User credentials cannot be used on an application endpoint'));
        }

        request._log(['auth', name]);
        request.auth.isAuthenticated = true;
        return next();
    };

    // Injection bypass

    if (request.auth.credentials) {
        return validate(null, 'bypass', { credentials: request.auth.credentials, artifacts: request.auth.artifacts });
    }

    // Authenticate

    authenticate();
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
