/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var MAC = require('mac');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');


// Declare internals

var internals = {};


// Session definitions

exports.type = {};

exports.type.endpoint = {

    grant_type:     { type: 'string', required: true },
    client_id:      { type: 'string' },
    client_secret:  { type: 'string', empty: true },
    refresh_token:  { type: 'string' },

    x_user_id:      { type: 'string' },
    x_email_token:  { type: 'string' }
};


// Token Authentication

exports.authenticate = function (request, config, next) {

    var serverConfig = request.server.settings;
    var scope = config.scope || null;
    var minTos = config.tos || serverConfig.tos.min;
    var userMode = config.user || 'required';
    var isOptional = (config.authentication === 'optional');

    if (config.authentication === 'none') {

        return next();
    }

    var loadTokenFunc = function (token, callback) {

        exports.loadToken(serverConfig.authentication.aes256Keys.oauthToken, token, callback);
    };

    MAC.authenticate(request.raw.req, loadTokenFunc, { isHTTPS: serverConfig.tls }, function (isAuthenticated, session, err) {

        if (!isAuthenticated) {

            // Unauthenticated

            if (isOptional &&
                !request.raw.req.headers.authorization) {

                return next();
            }
            else {

                request.raw.res.setHeader('WWW-Authenticate', MAC.getWWWAuthenticateHeader(err));
                return next(Err.generic(401, 'Invalid authentication', err));
            }
        }

        if (!session) {

            return next(Err.internal('Missing user object in authenticated token'));
        }

        request.session = session;

        if (!session.client) {

            return next(Err.internal('Missing client identifier in authenticated token'));
        }

        request.clientId = session.client;

        // Check scope

        if (scope &&
            !session.scope[scope]) {

            return next(Err.forbidden('Insufficient token scope (\'' + scope + '\' expected for client ' + session.client + ')'));
        }

        request.scope = session.scope;

        if (userMode === 'any') {

            // User Mode: any

            return next();
        }
        else if (userMode === 'required') {

                // User Mode: required

            if (session.user) {

                // Check TOS

                if (minTos === 'none' ||
                    (session.tos && session.tos >= minTos)) {

                    request.userId = session.user;
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
        else if (userMode === 'none') {

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
    });
};


// Get session token

exports.token = function (request) {

    var serverSettings = request.server.settings.authentication;

    // Ensure client credentials present

    internals.parseClientCredentials(request);

    // Load client information

    serverSettings.loadClientFunc(request.payload.client_id, function (client, err) {

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

                        var refresh = Utils.decrypt(serverSettings.aes256Keys.oauthRefresh, request.payload.refresh_token);
                        if (refresh &&
                            refresh.user &&
                            refresh.client) {

                            if (refresh.client === client._id) {

                                serverSettings.loadUserFunc(refresh.user, function (user, err) {

                                    if (user) {

                                        getOrCreate(user, client);
                                    }
                                    else {

                                        request.reply(err);
                                    }
                                });
                            }
                            else {

                                request.reply(Err.oauth('invalid_grant', 'Mismatching refresh token client id'));
                            }
                        }
                        else {

                            request.reply(Err.oauth('invalid_grant', 'Invalid refresh token'));
                        }
                    }
                    else {

                        request.reply(Err.oauth('invalid_request', 'Missing refresh_token'));
                    }
                }
                else if (serverSettings.extensionFunc) {

                    serverSettings.extensionFunc(request, client, function (user, err, action) {

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
                    request.reply(Err.oauth('unsupported_grant_type', 'Unknown or unsupported grant type'));
                }
            }
            else {

                // Bad client authentication
                request.reply(Err.oauth('invalid_client', 'Invalid client identifier or secret'));
            }
        }
        else {

            // Unknown client
            request.reply(Err.oauth('invalid_client', 'Invalid client identifier or secret'));
        }
    });

    function getOrCreate(user, client, customResponseFields) {

        if (user === null ||
            (client.scope && client.scope.authorized === true) ||
            (request.scope && request.scope.authorized === true)) {

            // Client has static authorization

            issue();
        }
        else {

            // Lookup authorization

            serverSettings.checkAuthorizationFunc(user._id, client._id, function (err) {

                if (err === null) {

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

                key: Utils.getRandomString(32),
                algorithm: serverSettings.defaultAlgorithm,
                client: client._id,
                scope: client.scope,
                expiration: Utils.getTimestamp() + (serverSettings.tokenLifetimeSec * 1000)
            };

            if (user) {

                token.user = user._id;
                token.tos = internals.getLatestTOS(user);
            }

            var response = {

                access_token: Utils.encrypt(serverSettings.aes256Keys.oauthToken, token),
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

                response.refresh_token = Utils.encrypt(serverSettings.aes256Keys.oauthRefresh, { user: user._id, client: client._id });
            }

            request.reply(response);
        }
    }
};


// Get session token

exports.loadToken = function (key, token, callback) {

    if (token) {

        var session = Utils.decrypt(key, token);
        if (session) {

            if (session.expiration &&
                session.expiration > Utils.getTimestamp()) {

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

            return Err.oauth('invalid_request', 'Request cannot include both Basic and payload client authentication');
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

            return Err.oauth('invalid_request', 'Unsupported HTTP authentication scheme');
        }
    }
    else {

        if (request.payload.client_id) {

            request.payload.client_secret = request.payload.client_secret || '';
            return null;
        }
        else {

            return Err.oauth('invalid_request', 'Request missing client authentication');
        }
    }
};

