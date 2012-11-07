// Load modules

var Oz = require('oz');
var Utils = require('./utils');
var Err = require('./error');
var Types = require('joi').Types;


// Declare internals

var internals = {};


// Defaults

exports.defaults = {
    tokenEndpoint: '/oauth/token',
    encryptionPassword: null,
    ozSettings: null,

    verifyTicketFunc: null,
    getAppFunc: null,
    checkAuthorizationFunc: null,
    extensionFunc: null,

    tos: {
        min: 'none'                                 // Format: YYYYMMDD (e.g. '19700101')
    }
};


// Setup endpoints

exports.setup = function (server) {

    if (server.settings.auth) {
        Utils.assert(server.settings.auth.tokenEndpoint &&
                     server.settings.auth.verifyTicketFunc &&
                     server.settings.auth.getAppFunc &&
                     server.settings.auth.checkAuthorizationFunc &&
                     server.settings.auth.encryptionPassword, 'Invalid authentication configuration');

        if (server.settings.auth.ozSettings) {
            Oz.settings.set(server.settings.auth.ozSettings);
        }

        server.addRoute({
            method: 'POST',
            path: server.settings.auth.tokenEndpoint,
            config: exports.token
        });

        Log.event(['info', 'config'], server.settings.nickname + ': Authentication enabled');
    }
};


// Token Authentication

exports.authenticate = function (request, next) {

    /*

    if (this.config.auth.mode !== 'none') {
        this.config.auth.scope = this.config.auth.scope || null;
        this.config.auth.tos = this.config.auth.tos || this.server.settings.auth.tos.min;
        this.config.auth.entity = this.config.auth.entity || 'user';

        Utils.assert(['user', 'app', 'any'].indexOf(this.config.auth.entity) !== -1, 'Unknown authentication entity: ' + this.config.auth.entity);
    }
    
    */


    if (request._route.config.auth.mode === 'none') {
        return next();
    }

    var validate = function (err, ticket, attributes) {

        // Unauthenticated

        if (err) {
            if (request._route.config.auth.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            request.log(['auth', 'unauthenticated', 'error'], err.wwwAuthenticateHeader);
            request.raw.res.setHeader('WWW-Authenticate', err.wwwAuthenticateHeader);
            return next(Err.unauthorized(err.message));
        }

        // Authenticated

        request.session = ticket;

        // Check scope

        if (request._route.config.auth.scope &&
            request.session.scope.indexOf(request._route.config.auth.scope) === -1) {

            request.log(['auth', 'error', 'scope'], { got: request.session.scope, need: request._route.config.auth.scope });
            return next(Err.forbidden('Insufficient scope (\'' + request._route.config.auth.scope + '\' expected for application ' + request.session.app + ')'));
        }

        // User Mode: any

        if (request._route.config.auth.entity === 'any') {
            request.log(['auth']);
            return next();
        }

        // User Mode: required

        if (request._route.config.auth.entity === 'user') {
            if (!request.session.user) {
                request.log(['auth', 'error'], 'User ticket required');
                return next(Err.forbidden('Application ticket cannot be used on a user endpoint'));
            }

            // Check TOS

            if (request._route.config.auth.tos !== 'none' &&
                (!request.session.ext || !request.session.ext.tos || request.session.ext.tos < request._route.config.auth.tos)) {

                request.log(['auth', 'error'], 'Insufficient TOS');
                return next(Err.forbidden('Insufficient TOS accepted'));
            }

            request.log(['auth']);
            return next();
        }

        // User Mode: none

        if (request._route.config.auth.entity === 'app') {
            if (request.session.user) {
                request.log(['auth', 'error'], 'App ticket required');
                return next(Err.forbidden('User ticket cannot be used on an application endpoint'));
            }

            request.log(['auth']);
            return next();
        }

        // User Mode: unknown

        request.log(['auth', 'error'], 'Unknown entity mode: ' + request._route.config.auth.entity);
        return next(Err.internal('Unknown endpoint entity mode'));
    };
    
    if (request.session) {
        return validate(null, request.session, null);
    }

    Oz.Request.authenticate(request.raw.req, request.server.settings.auth.encryptionPassword, { isHttps: request.server.settings.tls }, validate);
};


// Get session token

exports.token = {
    schema: {
        grant_type: Types.String(),
        client_id: Types.String().required(),
        client_secret: Types.String().emptyOk(),
        grant: Types.String()
    },
    auth: {
        mode: 'optional',
        entity: 'any'
    },
    handler: function (request) {

        var serverSettings = request.server.settings.auth;

        // Load app information

        if (!request.payload.grant_type) {
            return issue(null, app);
        }
        else if (request.payload.grant_type === 'rsvp') {

            if (!request.payload.grant) {
                return request.reply(new Oz.Error('invalid_request', 'Missing grant'));
            }

            serverSettings.verifyTicketFunc(request.payload.grant, function (app, user) {

                if (!app || !user) {
                    return request.reply(new Oz.Error('invalid_grant'));
                }

                return issue(user, app);
            });
        }
        else if (serverSettings.extensionFunc) {
            serverSettings.extensionFunc(ticket, function (app, user, action) {

                if (!app || !user) {
                    return request.reply(new Oz.Error('invalid_grant'));
                }

                return issue(user, app, action);
            });
        }
        else {
            // Unsupported grant type
            return request.reply(new Oz.Error('unsupported_grant_type', 'Unknown or unsupported grant type'));
        }


        serverSettings.getAppFunc(request.payload.client_id, function (app) {

            if (!app) {
                return request.reply(new Oz.Error('invalid_client', 'Invalid application identifier or secret'));
            }

            // Check app secret

            if ((app.secret || '') !== (request.payload.client_secret || '')) {
                // Bad app authentication
                return request.reply(new Oz.Error('invalid_client', 'Invalid application identifier or secret'));
            }

        });

        function issue(user, app, customResponseFields) {

            var generate = function (grant) {

                // Issue a new token

                var ticketAttr = {
                    app: {
                        id: app.id,
                        scope: app.scope
                    },
                    options: {}
                };

                if (user) {
                    ticketAttr.user = {
                        id: user.id,
                        rsvp: user.rsvp
                    };
                    ticketAttr.options.ext = {
                        tos: user.tos
                    };
                }

                Oz.Ticket.generate(ticketAttr.app, ticketAttr.user, request.server.settings.auth.encryptionPassword, ticketAttr.options, function (err, ticket) {

                    if (err) {
                        return request.reply(err);
                    }

                    if (user) {
                        ticket.x_tos = ticketAttr.options.ext.tos
                    }

                    if (grant) {
                        ticket.rsvp = grant;
                    }

                    Utils.merge(ticket, customResponseFields);
                    return request.reply(ticket);
                });
            };

            // Application ticket

            if (!user) {
                return generate();
            }

            // User ticket

            serverSettings.checkAuthorizationFunc(request.session, app, user, function (err, rsvp) {

                if (err) {
                    return request.reply(err);
                }

                return generate(rsvp);
            });
        }
    }
};


