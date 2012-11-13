// Load modules

var Oz = require('oz');
var Utils = require('../utils');
var Err = require('../error');
var Types = require('joi').Types;


// Declare internals

var internals = {};


exports.Scheme = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'oz', 'Wrong scheme');
    Utils.assert(options.encryptionPassword, 'Missing encryption password');
    Utils.assert(options.loadAppFunc && options.loadGrantFunc, 'Missing required methods in configuration');

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
        { method: 'POST', path: this.settings.appEndpoint, config: this.appEndpoint() },
        { method: 'POST', path: this.settings.reissueEndpoint, config: this.reissueEndpoint() },
        { method: 'POST', path: this.settings.rsvpEndpoint, config: this.rsvpEndpoint() }
    ]);

    return this;
};


// Request an applicaiton ticket using Basic authentication

internals.Scheme.prototype.appEndpoint = function () {

    var self = this;

    var endpoint = {
        auth: {
            mode: 'none'
        },
        handler: function (request) {

            // Parse Basic authentication

            var creds = self._basicAuth(request);
            if (creds instanceof Error) {
                return request.reply(new Oz.Error('invalid_request', 'Bad application authentication'));
            }

            // Load application

            self.settings.loadAppFunc(creds.username, function (app) {

                if (!app) {
                    return request.reply(new Oz.Error('invalid_client', 'Invalid application identifier or secret'));
                }

                // Validate application secret

                if ((app.secret || '') !== (creds.password || '')) {
                    return request.reply(new Oz.Error('invalid_client', 'Invalid application identifier or secret'));
                }

                // Issue application ticket

                Oz.ticket.issue(app, null, self.settings.encryptionPassword, {}, function (err, envelope) {

                    if (err) {
                        return request.reply(new Oz.Error('invalid_client', 'Failed to issue ticket: ' + err));
                    }

                    return request.reply(envelope);
                });
            });
        }
    };

    return endpoint;
};


// Request a ticket reissue using the authenticating ticket

internals.Scheme.prototype.reissueEndpoint = function () {

    var self = this;

    var endpoint = {
        schema: {
            issueTo: Types.String(),
            scope: Types.Array().includes(Types.String()).emptyOk()
        },
        auth: {
            mode: 'required',
            entity: 'any'
        },
        handler: function (request) {

            var ticket = request.session;

            var load = function () {

                // Load ticket

                self.settings.loadAppFunc(ticket.app, function (app) {

                    if (!app) {
                        return request.reply(new Oz.Error('invalid_client', 'Invalid application identifier or secret'));
                    }

                    if (!ticket.grant) {
                        return reissue(app);
                    }

                    self.settings.loadGrantFunc(ticket.grant, function (grant, ext) {

                        if (!grant ||
                            grant.app !== ticket.app ||
                            grant.user !== ticket.user ||
                            !grant.exp ||
                            grant.exp <= Date.now()) {

                            return request.reply(new Oz.Error('invalid_client', 'Invalid grant'));
                        }

                        return reissue(app, grant, ext);
                    });
                });
            };

            var reissue = function (app, grant, ext) {

                var options = {};

                if (grant) {
                    options.grantExp = grant.exp;
                }

                if (request.payload.issueTo) {
                    // Need to check if the app has permission to delegate ///////////////////////////////////////////////////
                    options.issueTo = request.payload.issueTo;
                }

                if (request.payload.scope) {
                    // Check that scope is a subset of grant ///////////////////////////////////////
                    options.scope = request.payload.scope;
                }

                if (ext) {
                    options.ext = ext;
                }

                Oz.ticket.reissue(ticket, self.settings.encryptionPassword, options, function (err, envelope) {

                    if (err) {
                        return callback(err);
                    }

                    return request.reply(envelope);
                });
            };

            load();
        }
    };

    return endpoint;
};


internals.Scheme.prototype.rsvpEndpoint = function () {

    var self = this;

    var endpoint = {
        schema: {
            rsvp: Types.String().required()
        },
        auth: {
            mode: 'required',
            entity: 'app'
        },
        handler: function (request) {

            var ticket = request.session;
            var now = Date.now();

            Oz.rsvp.parse(request.payload.rsvp, self.settings.encryptionPassword, function (err, envelope) {

                if (err) {
                    return request.reply(new Oz.Error('invalid_client', 'Invalid rsvp: ' + err));
                }

                if (envelope.app !== ticket.app) {
                    return request.reply(new Oz.Error('invalid_client', 'Mismatching ticket and rsvp apps'));
                }

                if (envelope.exp <= now) {
                    return request.reply(new Oz.Error('invalid_client', 'Expired rsvp'));
                }

                self.settings.loadGrantFunc(envelope.grant, function (grant, ext) {

                    if (!grant ||
                        grant.app !== ticket.app ||
                        !grant.exp ||
                        grant.exp <= now) {

                        return request.reply(new Oz.Error('invalid_client', 'Invalid grant'));
                    }

                    self.settings.loadAppFunc(grant.app, function (app) {

                        if (!app) {
                            return request.reply(new Oz.Error('invalid_client', 'Invalid application identifier or secret'));
                        }

                        var options = {};
                        if (ext) {
                            options.ext = ext;
                        }

                        Oz.ticket.issue(app, grant, self.settings.encryptionPassword, options, function (err, envelope) {

                            if (err) {
                                return request.reply(new Oz.Error('invalid_client', 'Failed to issue ticket: ' + err));
                            }

                            return request.reply(envelope);
                        });
                    });
                });
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

            request.log(['auth', 'unauthenticated', 'error'], err.wwwAuthenticateHeader);
            request.raw.res.setHeader('WWW-Authenticate', err.wwwAuthenticateHeader);
            return next(Err.unauthorized(err.message));
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

        // User Mode: any

        if (entity === 'any') {
            request.log(['auth']);
            return next();
        }

        // User Mode: required

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

        // User Mode: none

        if (entity === 'app') {
            if (ticket.user) {
                request.log(['auth', 'error'], 'App ticket required');
                return next(Err.forbidden('User ticket cannot be used on an application endpoint'));
            }

            request.log(['auth']);
            return next();
        }

        // User Mode: unknown

        request.log(['auth', 'error'], 'Unknown entity mode: ' + entity);
        return next(Err.internal('Unknown endpoint entity mode'));
    };

    if (request.session) {
        return validate(null, request.session, null);
    }

    Oz.request.authenticate(request.raw.req, this.settings.encryptionPassword, { isHttps: this.settings.isHttps }, validate);
};


internals.Scheme.prototype._basicAuth = function (request) {

    var authorization = request.raw.req.headers.authorization;
    if (!authorization) {
        return new Error('Request missing client authentication');
    }

    var parts = authorization.split(/\s+/);
    if (parts.length !== 2) {
        return new Error('Bad HTTP authentication header format: ' + authorization);
    }

    if (parts[0].toLowerCase() !== 'basic') {
        return new Error('Incorrect HTTP authentication scheme: ' + parts[0]);
    }

    var credentials = new Buffer(parts[1], 'base64').toString().split(':');
    return { username: credentials[0], password: credentials[1] };
};


