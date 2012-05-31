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

        fromName: '',       // Postmaster
        replyTo: '',        // no-reply@localhost
        admin: '',          // admin@localhost

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

        min: 'none'         // Format: YYYYMMDD (e.g. '19700101')
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

        // All extension functions use the following signature:
        // function (req, res, next) { next(); }

        onRequest: null,               // New request, before handing over to the router (allows changes to req.method and req.url)
        onPreHandler: null,            // After validation and body parsing, before route handler
        onPostHandler: null,           // After route handler returns, before setting response
        onPostRoute: null,             // After response sent

        onUnknownRoute: null           // Overrides hapi's default handler for unknown route
    },

    // Authentication (see exports.authentication for expected content)

    authentication: null,

    // Caching (see exports.cache for expected content)

    cache: null
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


// Cache configuration

exports.cache = {

    implementation: null,
    engine: 'joi',
    options: {

        port: 6379,
        address: '127.0.0.1',
        engineType: 'redis'
    }
};

