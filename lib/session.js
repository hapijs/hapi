// Load modules

var Crypto = require('crypto');
var Mac = require('mac');
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

    var loadTokenFunc = function (token, callback) {

        exports.loadToken(request.server.settings.authentication.aes256Keys.oauthToken, token, callback);
    };

    var validate = function (isAuthenticated, session, err) {

        if (!isAuthenticated) {

            // Unauthenticated

            if (request._route.config.auth.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                return next();
            }
            else {
                request.raw.res.setHeader('WWW-Authenticate', Mac.getWWWAuthenticateHeader(err));
                return next(Err.unauthorized(err));
            }
        }

        if (!session) {
            return next(Err.internal('Missing user object in authenticated token'));
        }

        request.session = session;

        if (!session.client) {
            return next(Err.internal('Missing client identifier in authenticated token'));
        }

        // Check scope

        if (request._route.config.auth.scope &&
            !session.scope[request._route.config.auth.scope]) {

            return next(Err.forbidden('Insufficient token scope (\'' + request._route.config.auth.scope + '\' expected for client ' + session.client + ')'));
        }

        if (request._route.config.auth.entity === 'any') {

            // User Mode: any

            return next();
        }
        else if (request._route.config.auth.entity === 'user') {

            // User Mode: required

            if (session.user) {

                // Check TOS

                if (request._route.config.auth.tos === 'none' ||
                    (session.tos && session.tos >= request._route.config.auth.tos)) {

                    return next();
                }
                else {
                    return next(Err.forbidden('Insufficient TOS accepted'));
                }
            }
            else {
                return next(Err.forbidden('Client token cannot be used on a user endpoint'));
            }
        }
        else if (request._route.config.auth.entity === 'client') {

            // User Mode: none

            if (session.user) {
                return next(Err.forbidden('User token cannot be used on a client endpoint'));
            }
            else {
                return next();
            }
        }
        else {
            return next(Err.internal('Unknown endpoint user mode'));
        }
    };
    
    if (request.session) {
        validate(true, request.session, null);
    }
    else {
        Mac.authenticate(request.raw.req, loadTokenFunc, { isHTTPS: request.server.settings.tls }, validate);
    }
};


// Get session token

exports.token = {
    schema: {
        grant_type: Types.String().required(),
        client_id: Types.String(),
        client_secret: Types.String().emptyOk(),
        refresh_token: Types.String(),
        x_user_id: Types.String(),
        x_email_token: Types.String()
    },
    auth: {
        mode: 'optional',
        entity: 'any',
        tos: 'none'
    },
    handler: function (request) {

        var serverSettings = request.server.settings.authentication;

        // Ensure client credentials present
        var err = internals.parseClientCredentials(request);

        if (err) {
            return request.reply(err);
        }

        // Load client information

        serverSettings.loadClientFunc(request.payload.client_id, function (err, client) {

            if (client) {

                // Check client secret

                if ((client.secret || '') === (request.payload.client_secret || '')) {

                    // Switch on grant type

                    if (request.payload.grant_type === 'client_credentials') {

                        // Client credentials (no user context)

                        getOrCreate(null, client);
                    }
                    else if (request.payload.grant_type === 'refresh_token') {

                        // Refresh token

                        if (request.payload.refresh_token) {
                            var refresh = exports.decrypt(serverSettings.aes256Keys.oauthRefresh, request.payload.refresh_token);
                            if (refresh &&
                                refresh.user &&
                                refresh.client) {

                                if (refresh.client === client._id) {
                                    serverSettings.loadUserFunc(refresh.user, function (err, user) {

                                        if (user) {
                                            getOrCreate(user, client);
                                        }
                                        else {
                                            request.reply(err);
                                        }
                                    });
                                }
                                else {
                                    request.reply(Err._oauth('invalid_grant', 'Mismatching refresh token client id'));
                                }
                            }
                            else {
                                request.reply(Err._oauth('invalid_grant', 'Invalid refresh token'));
                            }
                        }
                        else {
                            request.reply(Err._oauth('invalid_request', 'Missing refresh_token'));
                        }
                    }
                    else if (serverSettings.extensionFunc) {
                        serverSettings.extensionFunc(request, client, function (err, user, action) {

                            if (user) {
                                getOrCreate(user, client, action);
                            }
                            else {
                                // Unknown local account
                                request.reply(err);
                            }
                        });
                    }
                    else {
                        // Unsupported grant type
                        request.reply(Err._oauth('unsupported_grant_type', 'Unknown or unsupported grant type'));
                    }
                }
                else {
                    // Bad client authentication
                    request.reply(Err._oauth('invalid_client', 'Invalid client identifier or secret'));
                }
            }
            else {
                // Unknown client
                request.reply(Err._oauth('invalid_client', 'Invalid client identifier or secret'));
            }
        });

        function getOrCreate(user, client, customResponseFields) {

            if (!user ||
                (client.scope && client.scope.authorized === true) ||
                (request.session && request.session.scope && request.session.scope.authorized === true)) {

                // Client has static authorization

                issue();
            }
            else {

                // Lookup authorization

                serverSettings.checkAuthorizationFunc(user._id, client._id, function (err) {

                    if (!err) {
                        issue();
                    }
                    else {
                        request.reply(err);
                    }
                });
            }

            function issue() {

                // Issue a new token

                // Todo: Check if client has authorization to request a token
                // Todo: Set max expiration based on authorization, make short lived

                var token = {
                    key: exports.getRandomString(32),
                    algorithm: serverSettings.defaultAlgorithm,
                    client: client._id,
                    scope: client.scope,
                    expiration: Date.now() + (serverSettings.tokenLifetimeSec * 1000)
                };

                if (user) {
                    token.user = user._id;
                    token.tos = internals.getLatestTOS(user);
                }

                var response = {
                    access_token: exports.encrypt(serverSettings.aes256Keys.oauthToken, token),
                    token_type: 'mac',
                    mac_key: token.key,
                    mac_algorithm: token.algorithm,
                    expires_in: serverSettings.tokenLifetimeSec,
                    x_tos: token.tos
                };

                if (customResponseFields) {
                    for (var i in customResponseFields) {
                        if (customResponseFields.hasOwnProperty(i)) {
                            response[i] = customResponseFields[i];
                        }
                    }
                }

                if (user) {
                    response.refresh_token = exports.encrypt(serverSettings.aes256Keys.oauthRefresh, { user: user._id, client: client._id });
                }

                request.reply(response);
            }
        }
    }
};


// Get session token

exports.loadToken = function (key, token, callback) {

    if (token) {
        var session = exports.decrypt(key, token);
        if (session) {
            if (session.expiration &&
                session.expiration > Date.now()) {

                // TODO: check against grant database to make sure underlying grant still valid

                session.id = token;
                callback(session);
            }
            else {
                // Expired
                callback(null);
            }
        }
        else {
            // Invalid
            callback(null);
        }
    }
    else {
        // Empty
        callback(null);
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


internals.parseClientCredentials = function (request) {

    var authorization = request.raw.req.headers.authorization;
    if (authorization) {
        if (request.payload.client_id ||
            request.payload.client_secret) {

            return Err._oauth('invalid_request', 'Request cannot include both Basic and payload client authentication');
        }

        var parts = authorization.split(/\s+/);
        if (parts.length === 2 &&
            parts[0].toLowerCase() === 'basic') {

            var credentials = new Buffer(parts[1], 'base64').toString().split(':');
            request.payload.client_id = credentials[0];
            request.payload.client_secret = credentials[1];
            return null;
        }
        else {
            return Err._oauth('invalid_request', 'Unsupported HTTP authentication scheme');
        }
    }
    else {

        if (request.payload.client_id) {
            request.payload.client_secret = request.payload.client_secret || '';
            return null;
        }
        else {
            return Err._oauth('invalid_request', 'Request missing client authentication');
        }
    }
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

