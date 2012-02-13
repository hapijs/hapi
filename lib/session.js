/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Crypto = require('crypto');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');


// Declare internals

var internals = {};


// Session definitions

exports.type = {};

exports.type.endpoint = {

    grant_type:     { type: 'string', required: true },
    client_id:      { type: 'string', required: true },
    client_secret:  { type: 'string', empty: true },
    refresh_token:  { type: 'string' },

    x_user_id:      { type: 'string' },
    x_email_token:  { type: 'string' }
};

exports.type.client = {

    name:           { type: 'string' },
    secret:         { type: 'string', hide: true },
    scope:          { type: 'object', hide: true }
};


// Get session token

exports.token = function (request, reply) {

    server.settings.authentication.loadClientFunc(request.payload.client_id, function (client, err) {

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

                        var refresh = Utils.decrypt(server.settings.authentication.aes256Keys.oauthRefresh, request.payload.refresh_token);
                        if (refresh &&
                            refresh.user &&
                            refresh.client) {

                            if (refresh.client === client._id) {

                                server.settings.authentication.loadUserFunc(refresh.user, function (user, err) {

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
                else if (server.settings.authentication.extensionFunc) {

                    server.settings.authentication.extensionFunc(request, client, function (user) {

                        if (user) {

                            getOrCreate(user, client);
                        }
                        else {

                            // Unknown local account
                            reply(Err.oauth('invalid_grant', 'Unknown local account'));
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

    function getOrCreate(user, client, action) {

        if (user === null ||
            (client.scope && client.scope.authorized === true) ||
            (request.scope && request.scope.authorized === true)) {

            // Client has static authorization

            issue();
        }
        else {

            // Lookup authorization

            server.settings.authentication.loadGrantFunc(user._id, client._id, function (items, err) {

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

                            server.settings.authentication.removeGrantFunc(expired, function (err) {

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

            // Todo: Check is client has authorization to request a token
            // Todo: Set max expiration based on authorization, make short lived

            var token = {

                key: Utils.getRandomString(32),
                algorithm: server.settings.authentication.defaultAlgorithm,
                client: client._id,
                scope: client.scope,
                expiration: Utils.getTimestamp() + (server.settings.authentication.tokenLifetimeSec * 1000)
            };

            if (user) {

                token.user = user._id;
                token.tos = internals.getLatestTOS(user);
            }

            var response = {

                access_token: Utils.encrypt(server.settings.authentication.aes256Keys.oauthToken, token),
                token_type: 'mac',
                mac_key: token.key,
                mac_algorithm: token.algorithm,
                expires_in: server.settings.authentication.tokenLifetimeSec,
                x_tos: token.tos,
                x_action: action
            };

            if (user) {

                response.refresh_token = Utils.encrypt(server.settings.authentication.aes256Keys.oauthRefresh, { user: user._id, client: client._id });
            }

            reply(response);
        }
    }
};


// Get session token

exports.load = function (token, callback) {

    if (token) {

        var session = Utils.decrypt(server.settings.authentication.aes256Keys.oauthToken, token);
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


// Validate message

exports.validate = function (message, token, mac, callback) {

    exports.load(token, function (session) {

        if (session &&
            session.algorithm &&
            session.key &&
            session.user) {

            // Lookup hash function

            var hashMethod = null;
            switch (session.algorithm) {

                case 'hmac-sha-1': hashMethod = 'sha1'; break;
                case 'hmac-sha-256': hashMethod = 'sha256'; break;
            }

            if (hashMethod) {

                // Sign message

                var hmac = Crypto.createHmac(hashMethod, session.key).update(message);
                var digest = hmac.digest('base64');

                if (digest === mac) {

                    callback(session.user, null);
                }
                else {

                    // Invalid signature
                    callback(null, Err.unauthorized('Invalid mac'));
                }
            }
            else {

                // Invalid algorithm
                callback(null, Err.internal('Unknown algorithm'));
            }
        }
        else {

            // Invalid token
            callback(null, Err.notFound('Invalid token'));
        }
    });
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



