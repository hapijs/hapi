/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/


// Declare internals

var internals = {};


// Process configuration

exports.process = {

    name: 'Hapi Server',

    // Process Configuration

    process: {

        // runAs: 'www-data',
    },

    // Logging

    log: {

        levels: {

            info: true,
            err: true
        }
    },

    // Email Configuration

    email: {

        fromName: 'Hapi Server',
        replyTo: 'no-reply@localhost',
        admin: 'admin@localhost',

        server: {

            // port: 25,
            // user: '',
            // password: '',
            // host: 'localhost',
            // ssl: false
        }
    }
};


// Server configuration

exports.server = {

    // tls: {
    //
    //     key: '',
    //     cert: ''
    // },

    // Terms of Service

    tos: {

        min: '19700101'
    },

    // Payload

    payload: {

        maxBytes: 1024 * 1024
    },

    // CORS

    cors: {

        maxAge: 86400                               // One day
    },

    // Extensions

    ext: {

        onPreRoute: function (req, res, next) { next(); },              // New request, before any middleware
        onPreHandler: function (req, res, next) { next(); },            // Before route handler is called, after validation
        onPostHandler: function (req, res, next) { next(); },           // After route handler returns, before setting response
        onPostRoute: function (req, res, next) { next(); },             // After response sent

        onUnknownRoute: null                                            // Overrides hapi's default handler. Signature: function (req, res) {}
    },

    // Authentication (see exports.authentication for expected content)

    authentication: null
};


// Authentication configuration

exports.authentication = {

    loadClientFunc: null,
    loadUserFunc: null,
    extensionFunc: null,
    checkAuthorizationFunc: null,

    tokenEndpoint: '/oauth/token',
    defaultAlgorithm: 'hmac-sha-1',
    tokenLifetimeSec: 1209600,                  // Two weeks

    aes256Keys: {

        oauthRefresh: null,
        oauthToken: null
    }
};

