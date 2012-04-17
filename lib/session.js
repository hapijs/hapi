/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

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


// Get session token

exports.token = function (request, reply) {

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

                                        reply(err);
                                    }
                                });
                            }
                            else {

                                reply(Err.oauth('invalid_grant', 'Mismatching refresh token client id'));
                            }
                        }
                        else {

                            reply(Err.oauth('invalid_grant', 'Invalid refresh token'));
                        }
                    }
                    else {

                        reply(Err.oauth('invalid_request', 'Missing refresh_token'));
                    }
                }
                else if (serverSettings.extensionFunc) {

                    serverSettings.extensionFunc(request, client, function (user, err, action) {

                        if (user) {

                            getOrCreate(user, client, action);
                        }
                        else {

                            // Unknown local account
                            reply(err);
                        }
                    });
                }
                else {

                    // Unsupported grant type
                    reply(Err.oauth('unsupported_grant_type', 'Unknown or unsupported grant type'));
                }
            }
            else {

                // Bad client authentication
                reply(Err.oauth('invalid_client', 'Invalid client identifier or secret'));
            }
        }
        else {

            // Unknown client
            reply(Err.oauth('invalid_client', 'Invalid client identifier or secret'));
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

            serverSettings.loadGrantFunc(user._id, client._id, function (items, err) {

                if (err === null) {

                    if (items &&
                        items.length > 0) {

                        items.sort(function (a, b) {

                            if (a.expiration < b.expiration) {

                                return -1;
                            }

                            if (a.expiration > b.expiration) {

                                return 1;
                            }

                            return 0;
                        });

                        var isAuthorized = false;
                        var now = Utils.getTimestamp();

                        var expired = [];
                        for (var i = 0, il = items.length; i < il; ++i) {

                            if ((items[i].expiration || 0) <= now) {

                                expired.push(items[i]._id);
                            }
                            else {

                                isAuthorized = true;
                            }
                        }

                        if (expired.length > 0) {

                            serverSettings.removeGrantFunc(expired, function (err) {

                                // Ignore callback

                                if (err) {

                                    Log.err(err);
                                }
                            });
                        }

                        if (isAuthorized) {

                            issue();
                        }
                        else {

                            reply(Err.oauth('invalid_grant', 'Client authorization expired'));
                        }
                    }
                    else {

                        reply(Err.oauth('invalid_grant', 'Client is not authorized'));
                    }
                }
                else {

                    reply(Err.oauth('server_error', 'Failed retrieving authorization'));
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

            reply(response);
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

    var authorization = request.headers.authorization;
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

