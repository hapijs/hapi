/*
* Copyright (c) 2011 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var URL = require('url');
var Sugar = require('sugar');


// Declare internals

var internals = {

    // Defaults

    defaults: {

        name: 'Hapi Server',

        // Server Configuration

        uri: 'http://localhost:80',

        host: {                                 // Automatically set from 'uri'

            domain: 'localhost',
            scheme: 'http',
            port: '80',
            authority: 'localhost:80'
        },

        // Process Configuration

        process: {

            // runAs: 'www-data',

            // tls: {
            //
            //     key: 'cert/postmile.net.key',
            //     cert: 'cert/postmile.net.crt'
            // }
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
        },

        // Terms of Service

        tos: {

            min: '19700101'
        },

        // Authentication

        authentication: {

            loadSession: null
        }
    }
};


// Instance configuration

exports.settings = null;


// Apply defaults to user configuration when missing

exports.configure = function (options) {

    exports.settings = Object.merge(internals.defaults, options || {});

    // Parse URI and set components

    var uri = URL.parse(exports.settings.uri);

    exports.settings.host.domain = uri.hostname;
    exports.settings.host.port = uri.port;
    exports.settings.host.scheme = uri.protocol;
    exports.settings.host.authority = uri.host;
};

