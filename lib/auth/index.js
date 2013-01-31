// Load modules

var Oz = require('./oz');
var Hawk = require('./hawk');
var Basic = require('./basic');
var Utils = require('../utils');
var Err = require('../error');
var Log = require('hapi-log');


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
    for (var name in settings) {
        if (settings.hasOwnProperty(name)) {
            var strategy = settings[name];

            Utils.assert(strategy.scheme, name + ' is missing a scheme');
            Utils.assert(['oz', 'basic', 'hawk'].indexOf(strategy.scheme) !== -1 || strategy.scheme.indexOf('ext:') === 0, name + ' has an unknown scheme: ' + strategy.scheme);
            Utils.assert(strategy.scheme.indexOf('ext:') !== 0 || strategy.implementation, name + ' has extension scheme missing implementation');
            Utils.assert(!strategy.implementation || (typeof strategy.implementation === 'object' && typeof strategy.implementation.authenticate === 'function'), name + ' has invalid extension scheme implementation');

            switch (strategy.scheme) {
                case 'oz': this.strategies[name] = new Oz(this.server, strategy); break;
                case 'hawk': this.strategies[name] = new Hawk(this.server, strategy); break;
                case 'basic': this.strategies[name] = new Basic(this.server, strategy); break;
                default: this.strategies[name] = strategy.implementation; break;
            }
        }
    }

    Log.event(['info', 'config', 'auth'], server.settings.nickname + ': Authentication enabled');

    return this;
};


internals.Auth.prototype.authenticate = function (request, next) {

    var self = this;

    var config = request._route.config.auth;

    var authErrors = [];
    var strategyPos = 0;

    var authenticate = function () {

        // Injection

        if (request.session) {
            return validate(null, request.session);
        }

        // Authenticate

        if (strategyPos >= config.strategies.length) {
            return next(Err.unauthorized('Missing authentication', authErrors));
        }

        var strategy = self.strategies[config.strategies[strategyPos++]];           // Increments counter after fetching current strategy
        return strategy.authenticate(request, validate);
    };

    var validate = function (err, session, wasLogged) {

        // Unauthenticated

        if (!err && !session) {
            return next(Err.internal('Authentication response missing both error and session'));
        }

        if (err) {
            if (config.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            if (!wasLogged) {
                request.log(['auth', 'unauthenticated'], err);
            }

            if (!err.isMissing ||
                err.code !== 401) {                                                 // An actual error (not just missing authentication)

                return next(err);
            }

            // Try next strategy

            var response = err.toResponse();
            if (response.headers['WWW-Authenticate']) {
                authErrors.push(response.headers['WWW-Authenticate']);
            }

            return authenticate();
        }

        // Authenticated

        request.session = session;

        // Check scope

        if (config.scope &&
            (!session.scope || session.scope.indexOf(config.scope) === -1)) {

            request.log(['auth', 'error', 'scope'], { got: session.scope, need: config.scope });
            return next(Err.forbidden('Insufficient scope (\'' + config.scope + '\' expected)'));
        }

        // Check TOS

        var tos = (config.hasOwnProperty('tos') ? config.tos : null);
        if (tos &&
            (!session.ext || !session.ext.tos || session.ext.tos < tos)) {

            request.log(['auth', 'error', 'tos'], { min: tos, received: session.ext && session.ext.tos });
            return next(Err.forbidden('Insufficient TOS accepted'));
        }

        // Check entity

        var entity = config.entity || 'any';

        // Entity: any

        if (entity === 'any') {
            request.log(['auth']);
            return next();
        }

        // Entity: user

        if (entity === 'user') {
            if (!session.user) {
                request.log(['auth', 'error'], 'User session required');
                return next(Err.forbidden('Application session cannot be used on a user endpoint'));
            }

            request.log(['auth']);
            return next();
        }

        // Entity: app

        if (session.user) {
            request.log(['auth', 'error'], 'App session required');
            return next(Err.forbidden('User session cannot be used on an application endpoint'));
        }

        request.log(['auth']);
        return next();
    };

    authenticate();
};


internals.Auth.prototype.validatePayload = function (request, next) {

    var self = this;

    var config = request._route.config.auth;
    var strategyPos = 0;

    var validate = function () {

        if (strategyPos >= config.strategies.length) {
            return next(Err.unauthorized('Payload is invalid'));
        }

        var strategy = self.strategies[config.strategies[strategyPos++]];           // Increments counter after fetching current strategy
        if (typeof strategy.validatePayload === 'function' && strategy.validatePayload(request.rawBody, request.session)) {
            return next();
        }

        validate();
    };

    validate();
};