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
    Utils.assert(options.scheme, 'Missing scheme');
    Utils.assert(['oz', 'basic', 'hawk'].indexOf(options.scheme) !== -1 || options.scheme.indexOf('ext:') === 0, 'Unknown scheme: ' + options.scheme);
    Utils.assert(options.scheme.indexOf('ext:') !== 0 || options.implementation, 'Extension scheme missing implementation');
    Utils.assert(!options.implementation || (typeof options.implementation === 'object' && typeof options.implementation.authenticate === 'function'), 'Invalid extension scheme implementation');

    // Built-in schemes

    if (options.scheme === 'oz') {
        this.scheme = new Oz(server, options);
    }
    else if (options.scheme === 'hawk') {
        this.scheme = new Hawk(server, options);
    }
    else if (options.scheme === 'basic') {
        this.scheme = new Basic(server, options);
    }
    else {
        this.scheme = options.implementation;
    }

    Log.event(['info', 'config', 'auth'], server.settings.nickname + ': Authentication enabled');
    return this;
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

    this.scheme.authenticate(request, validate);
};

