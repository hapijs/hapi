// Load modules

var Oz = require('oz');
var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


exports.Scheme = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'oz', 'Wrong scheme');
    Utils.assert(options.encryptionPassword, 'Missing encryption password');
    Utils.assert(options.loadAppFunc, 'Missing required loadAppFunc method in configuration');
    Utils.assert(options.loadGrantFunc, 'Missing required loadGrantFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);                                               // Options can be reused
    this.settings.appEndpoint = this.settings.appEndpoint || '/oz/app';
    this.settings.reissueEndpoint = this.settings.reissueEndpoint || '/oz/reissue';
    this.settings.rsvpEndpoint = this.settings.rsvpEndpoint || '/oz/rsvp';
    this.settings.isHttps = !!server.settings.tls;

    // Setup Oz environment

    if (this.settings.ozSettings) {
        Oz.settings.set(this.settings.ozSettings);
    }

    // Add protocol endpoints

    server.addRoutes([
        { method: 'POST', path: this.settings.appEndpoint, config: this._endpoint('app') },
        { method: 'POST', path: this.settings.reissueEndpoint, config: this._endpoint('reissue') },
        { method: 'POST', path: this.settings.rsvpEndpoint, config: this._endpoint('rsvp') }
    ]);

    return this;
};


// Request an applicaiton ticket using Basic authentication

internals.Scheme.prototype._endpoint = function (name) {

    var self = this;

    var endpoint = {
        auth: {
            mode: 'none'
        },
        handler: function (request) {

            Oz.endpoints[name](request.raw.req, request.payload, self.settings, function (err, response) {

                return request.reply(err || response);
            });
        }
    };

    return endpoint;
};


// Token Authentication

internals.Scheme.prototype.authenticate = function (request, next) {

    var self = this;

    var validate = function (err, ticket, attributes) {

        var config = request._route.config.auth;

        // Unauthenticated

        if (err) {
            if (config.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            request.log(['auth', 'unauthenticated', 'error'], err);
            return next(err);
        }

        // Authenticated

        request.session = ticket;

        // Check scope

        if (config.scope &&
            ticket.scope.indexOf(config.scope) === -1) {

            request.log(['auth', 'error', 'scope'], { got: ticket.scope, need: config.scope });
            return next(Err.forbidden('Insufficient scope (\'' + config.scope + '\' expected for application ' + ticket.app + ')'));
        }

        var entity = config.entity || 'user';

        // Entity: any

        if (entity === 'any') {
            request.log(['auth']);
            return next();
        }

        // Entity: user

        if (entity === 'user') {
            if (!ticket.user) {
                request.log(['auth', 'error'], 'User ticket required');
                return next(Err.forbidden('Application ticket cannot be used on a user endpoint'));
            }

            // Check TOS

            var tos = (config.hasOwnProperty('tos') ? config.tos : self.settings.tos);
            if (tos &&
                (!ticket.ext || !ticket.ext.tos || ticket.ext.tos < tos)) {

                request.log(['auth', 'error', 'tos'], { min: tos, user: ticket.ext && ticket.ext.tos });
                return next(Err.forbidden('Insufficient TOS accepted'));
            }

            request.log(['auth']);
            return next();
        }

        // Entity: none

        if (entity === 'app') {
            if (ticket.user) {
                request.log(['auth', 'error'], 'App ticket required');
                return next(Err.forbidden('User ticket cannot be used on an application endpoint'));
            }

            request.log(['auth']);
            return next();
        }

        // Entity: unknown

        request.log(['auth', 'error'], 'Unknown entity mode: ' + entity);
        return next(Err.internal('Unknown endpoint entity mode'));
    };

    if (request.session) {
        return validate(null, request.session, null);
    }

    Oz.request.authenticate(request.raw.req, this.settings.encryptionPassword, { isHttps: this.settings.isHttps }, validate);
};


