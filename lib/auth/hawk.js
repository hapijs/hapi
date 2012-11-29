// Load modules

var Hawk = require('hawk');
var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


exports.Scheme = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'hawk', 'Wrong scheme');
    Utils.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);
    this.settings.hostHeaderKey = this.settings.hostHeaderKey || 'host';

    return this;
};


// Hawk Authentication

internals.Scheme.prototype.authenticate = function (request, next) {

    var self = this;

    var validate = function (err, isAuthenticated, credentials) {

        var config = request._route.config.auth;

        // Unauthenticated

        if (err || !isAuthenticated || !credentials) {
            if (config.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            if (err) {
                request.log(['auth', 'unauthenticated']);
                return next(Err.unauthorized(err.message));
            }
            else {
                request.log(['auth', 'unauthenticated'], err);
                return next(Err.forbidden('Request authentication failed', 'Hawk'));
            }
        }

        request.session = credentials;

        // Check scope

        if (config.scope &&
            (!credentials.scope || credentials.scope.indexOf(config.scope) === -1)) {

            request.log(['auth', 'error', 'scope'], { got: credentials.scope, need: config.scope });
            return next(Err.forbidden('Insufficient scope (\'' + config.scope + '\' expected)'));
        }

        // Check TOS

        var tos = (config.hasOwnProperty('tos') ? config.tos : self.settings.tos);
        if (tos &&
            (!credentials.ext || !credentials.ext.tos || credentials.ext.tos < tos)) {

            request.log(['auth', 'error', 'tos'], { min: tos, user: credentials.ext && credentials.ext.tos });
            return next(Err.forbidden('Insufficient TOS accepted'));
        }

        request.log(['auth']);
        return next();
    };

    if (request.session) {
        return validate(null, request.session);
    }

    Hawk.authenticate(request.raw.req, self.settings.getCredentialsFunc, { hostHeader: self.settings.hostHeaderKey }, validate);
};