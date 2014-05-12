// Load modules

var Boom = require('boom');
var Semver = require('semver');
var Handler = require('./handler');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Auth = function (server) {

    this.server = server;
    this._schemes = {};
    this._strategies = {};
    this._defaultStrategy = {           // Strategy used as default if route has no auth settings
        name: null,
        mode: 'required'
    };
};


internals.Auth.prototype.scheme = function (name, scheme) {

    Utils.assert(name, 'Authentication scheme must have a name');
    Utils.assert(!this._schemes[name], 'Authentication scheme name already exists:', name);
    Utils.assert(typeof scheme === 'function', 'scheme must be a function:', name);

    this._schemes[name] = scheme;
};


internals.Auth.prototype.strategy = function (name, scheme /*, mode, options */) {

    var hasMode = (typeof arguments[2] === 'string' || typeof arguments[2] === 'boolean');
    var mode = (hasMode ? arguments[2] : false);
    var options = (hasMode ? arguments[3] : arguments[2]) || null;

    Utils.assert(name, 'Authentication strategy must have a name');
    Utils.assert(name !== 'bypass', 'Cannot use reserved strategy name: bypass');
    Utils.assert(!this._strategies[name], 'Authentication strategy name already exists');
    Utils.assert(scheme, 'Authentication strategy', name, 'missing scheme');
    Utils.assert(this._schemes[scheme], 'Authentication strategy', name, 'uses unknown scheme:', scheme);
    Utils.assert(!mode || !this._defaultStrategy.name, 'Cannot set default required strategy more than once:', name, '- already set to:', this._defaultStrategy);

    this._strategies[name] = this._schemes[scheme](this.server, options);

    if (mode) {
        this._defaultStrategy.name = name;
        this._defaultStrategy.mode = (typeof mode === 'string' ? mode : 'required');
        Utils.assert(['required', 'optional', 'try'].indexOf(this._defaultStrategy.mode) !== -1, 'Unknown default authentication mode:', this._defaultStrategy.mode);
    }
};


internals.Auth.prototype._setupRoute = function (options) {

    var self = this;

    if (!options) {
        return options;         // Preseve the difference between undefined and false
    }

    var names = Object.keys(this._strategies);
    var defaultName = (names.length === 1 ? names[0] : null);

    if (typeof options === 'string') {
        options = { strategies: [options] };
    }
    else if (options === true) {
        Utils.assert(defaultName, 'Cannot set auth to true when more than one configured');
        options = { strategies: [defaultName] };
    }

    options.mode = options.mode || 'required';
    Utils.assert(['required', 'optional', 'try'].indexOf(options.mode) !== -1, 'Unknown authentication mode:', options.mode);

    Utils.assert(!options.entity || ['user', 'app', 'any'].indexOf(options.entity) !== -1, 'Unknown authentication entity type:', options.entity);
    Utils.assert(!options.payload || ['required', 'optional'].indexOf(options.payload) !== -1, 'Unknown authentication payload mode:', options.entity);
    Utils.assert(!(options.strategy && options.strategies), 'Route can only have a auth.strategy or auth.strategies (or use the default) but not both');
    Utils.assert(!options.strategies || options.strategies.length, 'Cannot have empty auth.strategies array');
    Utils.assert(options.strategies || options.strategy || defaultName, 'Cannot use default strategy when none or more than one configured');
    options.strategies = options.strategies || [options.strategy || defaultName];
    delete options.strategy;

    options.payload = options.payload || false;
    var hasAuthenticatePayload = false;
    options.strategies.forEach(function (strategy) {

        Utils.assert(self._strategies[strategy], 'Unknown authentication strategy:', strategy);
        hasAuthenticatePayload = hasAuthenticatePayload || typeof self._strategies[strategy].payload === 'function';
        Utils.assert(options.payload !== 'required' || hasAuthenticatePayload, 'Payload validation can only be required when all strategies support it');
    });

    Utils.assert(!options.payload || hasAuthenticatePayload, 'Payload authentication requires at least one strategy with payload support');

    return options;
};


internals.Auth.prototype._routeConfig = function (request) {

    if (request.route.auth) {
        return request.route.auth;
    }

    if (request.route.auth === false ||
        request.route.auth === null) {

        return false;
    }

    if (this._defaultStrategy.name) {
        return {
            mode: this._defaultStrategy.mode,
            strategies: [this._defaultStrategy.name]
        };
    }

    return false;
};


internals.Auth.authenticate = function (request, next) {

    var auth = request.server.auth;
    var config = auth._routeConfig(request);
    if (!config) {
        return next();
    }

    return auth._authenticate(request, next);
};


internals.Auth.prototype._authenticate = function (request, next) {

    var self = this;

    var config = this._routeConfig(request);

    var authErrors = [];
    var strategyPos = 0;

    var authenticate = function () {

        // Injection

        if (request.auth.credentials) {
            return validate('bypass', null, { credentials: request.auth.credentials });
        }

        // Find next strategy

        if (strategyPos >= config.strategies.length) {

            if (config.mode === 'optional' ||
                config.mode === 'try') {

                request.auth.isAuthenticated = false;
                request.auth.credentials = null;
                request.log(['hapi', 'auth', 'unauthenticated']);
                return next();
            }

            return next(Boom.unauthorized('Missing authentication', authErrors));
        }

        var strategy = config.strategies[strategyPos];
        ++strategyPos;

        request._protect.run(validate, function (exit) {

            var savedResults = undefined;
            var transfer = function (err) {

                exit(strategy, err, savedResults);
            };

            var root = function (err, result) {

                savedResults = result;
                return (err ? reply._root(err) : exit(strategy, err, result));
            };

            var reply = Handler.replyInterface(request, transfer, root);
            self._strategies[strategy].authenticate.call(null, request, reply);
        });
    };

    var validate = function (strategy, err, result) {

        result = result || {};

        // Unauthenticated

        if (!err && !result.credentials) {
            return next(Boom.badImplementation('Authentication response missing both error and credentials'));
        }

        if (err) {
            if (result.log) {
                request.log(['hapi', 'auth', 'error', strategy].concat(result.log.tags), result.log.data);
            }
            else {
                request.log(['hapi', 'auth', 'error', 'unauthenticated'], (err.isBoom ? err : err.statusCode));
            }

            if (err.isMissing) {

                // Try next strategy

                authErrors.push(err.output.headers['WWW-Authenticate']);
                return authenticate();
            }

            if (config.mode === 'try') {
                request.auth.isAuthenticated = false;
                request.auth.strategy = strategy;
                request.auth.credentials = result.credentials;
                request.auth.artifacts = result.artifacts;
                request.log(['hapi', 'auth', 'error', 'unauthenticated', 'try'], err);
                return next();
            }

            return next(err);
        }

        // Authenticated

        var credentials = result.credentials;
        request.auth.strategy = strategy;
        request.auth.credentials = credentials;
        request.auth.artifacts = result.artifacts;

        // Check scope

        if (config.scope) {
            if (!credentials.scope ||                                                                                   // Credentials missing scope
                (typeof config.scope === 'string' && credentials.scope.indexOf(config.scope) === -1) ||                 // String scope isn't in credentials
                (Array.isArray(config.scope) && !Utils.intersect(config.scope, credentials.scope).length)) {            // Array scope doesn't intersect credentials

                request.log(['hapi', 'auth', 'scope', 'error'], { got: credentials.scope, need: config.scope });
                return next(Boom.forbidden('Insufficient scope - ' + config.scope + ' expected'));
            }
        }

        // Check TOS

        var tos = (config.hasOwnProperty('tos') ? config.tos : false);
        if (tos &&
            (!credentials.tos || !Semver.satisfies(credentials.tos, tos))) {

            request.log(['hapi', 'auth', 'tos', 'error'], { min: tos, received: credentials.tos });
            return next(Boom.forbidden('Insufficient TOS accepted'));
        }

        // Check entity

        var entity = config.entity || 'any';

        // Entity: 'any'

        if (entity === 'any') {
            request.log(['hapi', 'auth']);
            request.auth.isAuthenticated = true;
            return next();
        }

        // Entity: 'user'

        if (entity === 'user') {
            if (!credentials.user) {
                request.log(['hapi', 'auth', 'error'], 'User credentials required');
                return next(Boom.forbidden('Application credentials cannot be used on a user endpoint'));
            }

            request.log(['hapi', 'auth']);
            request.auth.isAuthenticated = true;
            return next();
        }

        // Entity: 'app'

        if (credentials.user) {
            request.log(['hapi', 'auth', 'error'], 'App credentials required');
            return next(Boom.forbidden('User credentials cannot be used on an application endpoint'));
        }

        request.log(['hapi', 'auth']);
        request.auth.isAuthenticated = true;
        return next();
    };

    authenticate();
};


internals.Auth.payload = function (request, next) {

    var auth = request.server.auth;
    var config = auth._routeConfig(request);
    if (!config ||
        !config.payload ||
        !request.auth.isAuthenticated ||
        request.auth.strategy === 'bypass') {

        return next();
    }

    var finalize = function (err) {

        if (err === false) {
            return next(config.payload === 'optional' ? null : Boom.unauthorized('Missing payload authentication'));
        }

        return next(err);
    };

    var strategy = auth._strategies[request.auth.strategy];

    request._protect.run(finalize, function (exit) {

        strategy.payload.call(null, request, exit);
    });
};


internals.Auth.response = function (request, next) {

    var auth = request.server.auth;
    var config = auth._routeConfig(request);
    if (!config ||
        !request.auth.isAuthenticated ||
        request.auth.strategy === 'bypass') {

        return next();
    }

    var strategy = auth._strategies[request.auth.strategy];
    if (typeof strategy.response !== 'function') {
        return next();
    }

    request._protect.run(next, function (exit) {

        strategy.response.call(null, request, exit);
    });
};
