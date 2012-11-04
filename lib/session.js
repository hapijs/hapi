// Load modules

var Crypto = require('crypto');
var Oz = require('oz');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Types = require('joi').Types;


// Declare internals

var internals = {};


// Token Authentication

exports.authenticate = function (request, next) {

    if (request._route.config.auth.mode === 'none') {
        return next();
    }

//        exports.loadToken(request.server.settings.authentication.aes256Keys.oauthToken, token, callback);

    var validate = function (err, ticket, attributes) {

        // Unauthenticated

        if (err) {
            if (request._route.config.auth.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            request.log(['auth', 'unauthenticated', 'error']);
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

    Oz.Request.authenticate(request.raw.req, { isHttps: request.server.settings.tls }, validate);
};


// Get session token

exports.token = {
    schema: {
        grant_type: Types.String().required(),
        client_id: Types.String().required(),
        client_secret: Types.String().emptyOk(),
        refresh_token: Types.String(),
        x_user_id: Types.String(),
        x_email_token: Types.String()
    },
    auth: {
        mode: 'optional',
        entity: 'any'
    },
    handler: function (request) {

        var serverSettings = request.server.settings.authentication;

        // Load app information

        serverSettings.loadClientFunc(request.payload.client_id, function (err, app) {

            if (err || !app) {
                return request.reply(exports.error('invalid_client', 'Invalid application identifier or secret'));
            }

            // Check app secret

            if ((app.secret || '') !== (request.payload.client_secret || '')) {
                // Bad app authentication
                return request.reply(exports.error('invalid_client', 'Invalid application identifier or secret'));
            }

            // Switch on grant type

            if (request.payload.grant_type === 'client_credentials') {

                // Client credentials (no user context)
                return getOrCreate(null, app);
            }
            else if (request.payload.grant_type === 'refresh_token') {

                // Refresh token

                if (!request.payload.refresh_token) {
                    return request.reply(exports.error('invalid_request', 'Missing refresh_token'));
                }

                var refresh = exports.decrypt(serverSettings.aes256Keys.oauthRefresh, request.payload.refresh_token);
                if (!refresh ||
                    !refresh.user ||
                    !refresh.app) {

                    return request.reply(exports.error('invalid_grant', 'Invalid refresh token'));
                }

                if (refresh.app !== app.id) {
                    return request.reply(exports.error('invalid_grant', 'Mismatching refresh token application id'));
                }

                serverSettings.loadUserFunc(refresh.user, function (err, user) {

                    if (err || !user) {
                        return request.reply(err);
                    }

                    return getOrCreate(user, app);
                });
            }
            else if (serverSettings.extensionFunc) {
                serverSettings.extensionFunc(request, app, function (err, user, action) {

                    if (err || !user) {
                        // Unknown local account
                        return request.reply(err);
                    }

                    return getOrCreate(user, app, action);
                });
            }
            else {
                // Unsupported grant type
                return request.reply(exports.error('unsupported_grant_type', 'Unknown or unsupported grant type'));
            }
        });

        function getOrCreate(user, app, customResponseFields) {

            if (!user ||
                (app.scope && app.scope.indexOf('authorized') !== -1) ||  //////////////////////////////////////////////////////////////
                (request.session && request.session.scope && request.session.scope.indexOf('authorized') !== -1)) {

                // Client has static authorization

                return issue();
            }
            else {

                // Lookup authorization

                serverSettings.checkAuthorizationFunc(user.id, app.id, function (err) {

                    if (err) {
                        return request.reply(err);
                    }

                    return issue();
                });
            }

            function issue() {

                // Issue a new token

                // Todo: Check if app has authorization to request a token
                // Todo: Set max expiration based on authorization, make short lived

                var ticketAttr = {
                    app: {
                        id: app.id,
                        scope: app.scope
                    },
                    options: {
                        ttl: serverSettings.tokenLifetimeSec * 1000,
                        ext: {
                            tos: internals.getLatestTOS(user)
                        }
                    }
                };

                if (user) {
                    ticketAttr.user = { id: user.id };
                }

                Oz.Ticket.issue(ticketAttr.app, ticketAttr.user, ticketAttr.options, function (err, ticket) {

                    if (err) {
                        return request.reply(err);
                    }

                    ticket.x_tos = ticketAttr.options.ext.tos
                    if (customResponseFields) {
                        for (var i in customResponseFields) {
                            if (customResponseFields.hasOwnProperty(i)) {
                                ticket[i] = customResponseFields[i];
                            }
                        }
                    }

                    if (user) {
                        ticket.refresh_token = exports.encrypt(serverSettings.aes256Keys.oauthRefresh, { user: user.id, app: app.id });
                    }

                    return request.reply(ticket);
                });
            }
        }
    }
};


// Find latest accepted TOS

internals.getLatestTOS = function (user) {

    if (user &&
        user.tos &&
        typeof user.tos === 'object') {

        var versions = Object.keys(user.tos);
        if (versions.length > 0) {
            versions.sort();
            return versions[versions.length - 1];
        }
    }

    return 0;
};


// Compare scopes

internals.compareScope = function (a, b) {

    a = a || null;
    b = b || null;

    if (a === null && b === null) {
        return true;
    }

    if ((a === null && b !== null) ||
        (a !== null && b === null)) {

        return false;
    }

    if (Object.keys(a).length !== Object.keys(b).length) {
        return false;
    }

    for (var i in a) {
        if (a.hasOwnProperty(i)) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
    }

    return true;
};


// AES256 Symmetric encryption

exports.encrypt = function (key, value) {

    var envelope = JSON.stringify({ v: value, a: exports.getRandomString(2) });

    var cipher = Crypto.createCipher('aes256', key);
    var enc = cipher.update(envelope, 'utf8', 'binary');
    enc += cipher.final('binary');

    var result = (new Buffer(enc, 'binary')).toString('base64').replace(/\+/g, '-').replace(/\//g, ':').replace(/\=/g, '');
    return result;
};


exports.decrypt = function (key, value) {

    var input = (new Buffer(value.replace(/-/g, '+').replace(/:/g, '/'), 'base64')).toString('binary');

    var decipher = Crypto.createDecipher('aes256', key);
    var dec = decipher.update(input, 'binary', 'utf8');
    dec += decipher.final('utf8');

    var envelope = null;

    try {
        envelope = JSON.parse(dec);
    }
    catch (e) {
        Log.event('err', 'Invalid encrypted envelope: ' + dec + ' / Exception: ' + JSON.stringify(e));
    }

    return envelope ? envelope.v : null;
};


// Random string

exports.getRandomString = function (size) {

    var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var len = randomSource.length;
    size = size || 10;

    if (typeof size === 'number' &&
        !isNaN(size) && size >= 0 &&
        (parseFloat(size) === parseInt(size))) {

        var result = [];

        for (var i = 0; i < size; ++i) {
            result[i] = randomSource[Math.floor(Math.random() * len)];
        }

        return result.join('');
    }
    else {
        return null;
    }
};


exports.error = function (code, description) {

    var err = new Err(400, 'OAuth', {
        toResponse: function () {

            return { code: 400, payload: { error: code, error_description: description } };
        }
    });

    return err;
};


