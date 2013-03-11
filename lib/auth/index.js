// Load modules

var Boom = require('boom');
var Oz = require('./oz');
var Hawk = require('./hawk');
var Bewit = require('./bewit');
var Basic = require('./basic');
var Cookie = require('./cookie');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Auth = function (server, options) {

    Utils.assert(this.constructor === internals.Auth, 'Auth must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(!!options.scheme ^ !!options[Object.keys(options)[0]].scheme, 'Auth options must include either a top level strategy or object of strategies but not both');
    Utils.assert(options.scheme || Object.keys(options).length, 'Number of authentication strategies must be greater than zero');

    this.server = server;

    // Move single strategy into default

    var settings = options.scheme ? { 'default': options } : options;

    // Load strategies

    this.strategies = {};
    this.extensions = [];
    for (var name in settings) {
        if (settings.hasOwnProperty(name)) {
            var strategy = settings[name];

            Utils.assert(strategy.scheme, name + ' is missing a scheme');
            Utils.assert(['oz', 'basic', 'hawk', 'cookie', 'bewit'].indexOf(strategy.scheme) !== -1 || strategy.scheme.indexOf('ext:') === 0, name + ' has an unknown scheme: ' + strategy.scheme);
            Utils.assert(strategy.scheme.indexOf('ext:') !== 0 || strategy.implementation, name + ' has extension scheme missing implementation');
            Utils.assert(!strategy.implementation || (typeof strategy.implementation === 'object' && typeof strategy.implementation.authenticate === 'function'), name + ' has invalid extension scheme implementation');

            switch (strategy.scheme) {
                case 'oz': this.strategies[name] = new Oz(this.server, strategy); break;
                case 'hawk': this.strategies[name] = new Hawk(this.server, strategy); break;
                case 'basic': this.strategies[name] = new Basic(this.server, strategy); break;
                case 'cookie': this.strategies[name] = new Cookie(this.server, strategy); break;
                case 'bewit': this.strategies[name] = new Bewit(this.server, strategy); break;
                default: this.strategies[name] = strategy.implementation; break;
            }

            if (this.strategies[name].extend &&
                typeof this.strategies[name].extend === 'function') {

                this.extensions.push(this.strategies[name]);
            }
        }
    }

    return this;
};


internals.Auth.authenticate = function (request, next) {

    // Extend requests with loaded strategies

    if (request.server.auth) {
        for (var i = 0, il = request.server.auth.extensions.length; i < il; ++i) {
            request.server.auth.extensions[i].extend(request);
        }
    }

    // Modes: required, optional, try, none

    var config = request.route.auth;
    if (config.mode === 'none') {
        return next();
    }

    return request.server.auth.authenticate(request, next);
};


internals.Auth.prototype.authenticate = function (request, next) {

    var self = this;

    var config = request.route.auth;

    var authErrors = [];
    var strategyPos = 0;

    request.isAuthenticated = false;

    var authenticate = function () {

        // Injection

        if (request.session) {
            return validate(null, request.session);
        }

        // Authenticate

        if (strategyPos >= config.strategies.length) {

            if (config.mode === 'optional' ||
                config.mode === 'try') {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            return next(Boom.unauthorized('Missing authentication', authErrors));
        }

        var strategy = self.strategies[config.strategies[strategyPos++]];           // Increments counter after fetching current strategy
        return strategy.authenticate(request, validate);
    };

    var validate = function (err, session, wasLogged) {

        // Unauthenticated

        if (!err && !session) {
            return next(Boom.internal('Authentication response missing both error and session'));
        }

        if (err) {
            if (!wasLogged) {
                request.log(['auth', 'unauthenticated'], err);
            }

            if (err instanceof Error === false ||                                   // Not an actual error (e.g. redirect, custom response)
                !err.isMissing ||                                                   // Missing authentication (did not fail)
                err.response.code !== 401) {                                        // An actual error (not just missing authentication)

                if (config.mode === 'try') {
                    request.session = session;
                    request.log(['auth', 'unauthenticated', 'try'], err);
                    return next();
                }

                return next(err);
            }

            // Try next strategy

            if (err.response.headers['WWW-Authenticate']) {
                authErrors.push(err.response.headers['WWW-Authenticate']);
            }

            return authenticate();
        }

        // Authenticated

        request.session = session;
        request.session._strategy = self.strategies[config.strategies[strategyPos - 1]];

        // Check scope

        if (config.scope &&
            (!session.scope || session.scope.indexOf(config.scope) === -1)) {

            request.log(['auth', 'error', 'scope'], { got: session.scope, need: config.scope });
            return next(Boom.forbidden('Insufficient scope (\'' + config.scope + '\' expected)'));
        }

        // Check TOS

        var tos = (config.hasOwnProperty('tos') ? config.tos : null);
        if (tos &&
            (!session.ext || !session.ext.tos || session.ext.tos < tos)) {

            request.log(['auth', 'error', 'tos'], { min: tos, received: session.ext && session.ext.tos });
            return next(Boom.forbidden('Insufficient TOS accepted'));
        }

        // Check entity

        var entity = config.entity || 'any';

        // Entity: 'any'

        if (entity === 'any') {
            request.log(['auth']);
            request.isAuthenticated = true;
            return next();
        }

        // Entity: 'user'

        if (entity === 'user') {
            if (!session.user) {
                request.log(['auth', 'error'], 'User session required');
                return next(Boom.forbidden('Application session cannot be used on a user endpoint'));
            }

            request.log(['auth']);
            request.isAuthenticated = true;
            return next();
        }

        // Entity: 'app'

        if (session.user) {
            request.log(['auth', 'error'], 'App session required');
            return next(Boom.forbidden('User session cannot be used on an application endpoint'));
        }

        request.log(['auth']);
        request.isAuthenticated = true;
        return next();
    };

    authenticate();
};


internals.Auth.authenticatePayload = function (request, next) {

    var config = request.route.auth;

    if (config.payload === 'none' ||
        !request.isAuthenticated) {

        return next();
    }

    if (config.payload === 'optional' &&
        (!request.session.artifacts.hash ||
        typeof request.session._strategy.authenticatePayload !== 'function')) {

        return next();
    }

    request.session._strategy.authenticatePayload(request.rawBody, request.session, request.raw.req.headers['content-type'], function (err) {

        return next(err);
    });
};


internals.Auth.responseHeader = function (request, next) {

    if (!request.session ||
        !request.session._strategy ||
        typeof request.session._strategy.responseHeader !== 'function') {

        return next();
    }

    if (!request.response ||
        request.response.isBoom ||
        request.response.varieties.error) {

        return next();
    }

    request.session._strategy.responseHeader(request, function (err) {

        return next(err);
    });
};