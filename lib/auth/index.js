// Load modules

var Oz = require('./oz');
var Hawk = require('./hawk');
var Basic = require('./basic');
var Utils = require('../utils');
var Err = require('../error');
var Log = require('../log');


// Declare internals

var internals = {};


exports = module.exports = internals.Auth = function (server, options) {

    Utils.assert(this.constructor === internals.Auth, 'Auth must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(!options.scheme ^ !options.strategies, 'Auth options must include one of scheme or strategies but not both')
    
    this.server = server;
    this.options = Utils.clone(options);
    
    if (this.options.scheme) {
        this.options.strategies = {
            'default': this.options.scheme
        };
        delete this.options.scheme;
    }
    
    this.setStrategies(this.options.strategies);
    
    if (this.strategies['default']) {
        var strat = this.strategies['default'];
        Utils.assert(strat.scheme, 'Missing scheme');
        Utils.assert(['oz', 'basic', 'hawk'].indexOf(strat.scheme) !== -1 || strat.scheme.indexOf('ext:') === 0, 'Unknown scheme: ' + strat.scheme);
        Utils.assert(strat.scheme.indexOf('ext:') !== 0 || strat.implementation, 'Extension scheme missing implementation');
        Utils.assert(!strat.implementation || (typeof strat.implementation === 'object' && typeof strat.implementation.authenticate === 'function'), 'Invalid extension scheme implementation');

        // Built-in schemes

        this.scheme = this.loadScheme(strat);
    }

    Log.event(['info', 'config', 'auth'], server.settings.nickname + ': Authentication enabled');
    return this;
};


internals.Auth.prototype.setStrategies = function (strategies) {

    Utils.assert(Object.keys(strategies).length > 0, 'Number of Authentication Strategies must be greater than zero');
    
    this.strategies = strategies;
    return this;
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

    var validate = function (err, session, wasLogged) {

        var config = request._route.config.auth;

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

            return next(err);
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

    // Injection

    if (request.session) {
        return validate(null, request.session);
    }

    // Authenticate

    var config = request._route.config.auth;
    if (config.strategy) {
        if (!this.strategies.hasOwnProperty(config.strategy)) {
            var msg = 'Invalid auth strategy defined in request: ' + config.strategy;
            request.log(['auth', 'error'], msg);
            return validate(Err.forbidden(msg));
        }
        else {
            var scheme = this.loadScheme(this.strategies[config.strategy]);
            scheme.authenticate(request, validate);
        }
    }
    else {
        this.scheme.authenticate(request, validate);
    }
};