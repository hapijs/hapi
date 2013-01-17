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
    Utils.assert(!!options.scheme ^ !!options.strategies, 'Auth options must include one of scheme or strategies but not both');

    this.server = server;
    this.options = Utils.clone(options);
    this.strategies = {};

    if (options.scheme) {
        this.options = {
            'strategies': {
                'default': options
            }
        };
    }

    this.setStrategies(this.options.strategies);

    Log.event(['info', 'config', 'auth'], server.settings.nickname + ': Authentication enabled');
    return this;
};


internals.Auth.prototype.setStrategies = function (strategies) {

    var stratKeys = Object.keys(strategies);
    var self = this;

    Utils.assert(stratKeys.length > 0, 'Number of Authentication Strategies must be greater than zero');

    stratKeys.forEach(function (strategyKey) {

        var strategy = strategies[strategyKey];
        Utils.assert(strategy.scheme, strategyKey + ' is missing a scheme');
        Utils.assert(['oz', 'basic', 'hawk'].indexOf(strategy.scheme) !== -1 || strategy.scheme.indexOf('ext:') === 0, strategyKey + ' has an unknown scheme: ' + strategy.scheme);
        Utils.assert(strategy.scheme.indexOf('ext:') !== 0 || strategy.implementation, strategyKey + ' has extension scheme missing implementation');
        Utils.assert(!strategy.implementation || (typeof strategy.implementation === 'object' && typeof strategy.implementation.authenticate === 'function'), strategyKey + ' has invalid extension scheme implementation');

        self.strategies[strategyKey] = self.loadScheme(strategy);
    });

    return self;
};


internals.Auth.prototype.loadScheme = function (options) {

    if (options.scheme === 'oz') {
        return new Oz(this.server, options);
    }
    else if (options.scheme === 'hawk') {
        return new Hawk(this.server, options);
    }
    else if (options.scheme === 'basic') {
        return new Basic(this.server, options);
    }
    else {
        return options.implementation;
    }
};


internals.Auth.prototype.authenticate = function (request, next) {

    var self = this;
    var config = request._route.config.auth;
    var authResults = [];
    var strategyName = config.strategies[0];
    var strategy = this.strategies[strategyName];

    var nextStrategy = function (err) {

        if (err) {
            authResults.push(err);
        }

        if (config.strategies.length === authResults.length) {
            return next(combineUnauthorizedErrors());
        }

        strategyName = config.strategies[authResults.length];
        strategy = self.strategies[strategyName];

        return strategy ? strategy.authenticate(request, validate) : next(err);
    };

    var combineUnauthorizedErrors = function () {

        var wwwAuthenticate = '';
        var message = '';

        while (authResults.length > 0) {

            var currentError = authResults.shift();
            if (currentError.code !== 401) {
                return currentError;
            }

            var response = currentError.toResponse();
            if (message.length > 0 && response.payload.message) {
                message += ', ';
            }

            if (wwwAuthenticate.length > 0 && response.headers['WWW-Authenticate']) {
                wwwAuthenticate += ', ';
            }
            var response = currentError.toResponse();

            wwwAuthenticate += response.headers['WWW-Authenticate'];
            message += response.payload.message;
        }

        var outError = new Err(401, message);
        var response = outError.toResponse();

        outError.toResponse = function () {

            response.headers = { 'WWW-Authenticate': wwwAuthenticate };
            return response;
        };

        return outError;
    };

    var validate = function (err, session, wasLogged) {

        // Unauthenticated

        if (err || !session) {
            if (config.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            if (!wasLogged) {
                request.log(['auth', 'unauthenticated'], err);
            }

            return nextStrategy(err);
        }

        // Authenticated

        request.session = session;

        // Check scope

        if (config.scope &&
            (!session.scope || session.scope.indexOf(config.scope) === -1)) {

            request.log(['auth', 'error', 'scope'], { got: session.scope, need: config.scope });
            return nextStrategy(Err.forbidden('Insufficient scope (\'' + config.scope + '\' expected)'));
        }

        // Check TOS

        var tos = (config.hasOwnProperty('tos') ? config.tos : null);
        if (tos &&
            (!session.ext || !session.ext.tos || session.ext.tos < tos)) {

            request.log(['auth', 'error', 'tos'], { min: tos, received: session.ext && session.ext.tos });
            return nextStrategy(Err.forbidden('Insufficient TOS accepted'));
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
            return nextStrategy(Err.forbidden('User session cannot be used on an application endpoint'));
        }

        request.log(['auth']);
        return next();
    };

    // Injection

    if (request.session) {
        return validate(null, request.session);
    }

    // Authenticate

    return strategy.authenticate(request, validate);
 };