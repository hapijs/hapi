/*
* Copyright (c) 2011 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Os = require('os');
var Sugar = require('sugar');
var Utils = require('./utils');
var Log = require('./log');


// Declare internals

var internals = {};


// Default configuration

internals.defaultConfig = {

    name: 'Hapi Server',

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
    }
};


// Instance configuration

exports.settings = null;


// Initialize process

exports.initialize = function (options) {

    // Set global configuration

    exports.settings = Object.merge(internals.defaultConfig, options || {});    // Must happen first to populate configuration required by other modules

    // Listen to uncaught exceptions

    process.on('uncaughtException', function (err) {

        console.log(JSON.stringify(err));
        Log.err('Uncaught exception: ' + err.stack);

        if (exports.settings.email.admin) {

            Utils.email(exports.settings.email.admin, 'ERROR: Exception on ' + exports.settings.name + ' server', err.stack, '', function (err) {

                process.exit(1);
            });
        }
    });
};


// Create and configure server instance

exports.finalize = function (onCompleted) {

    // Send startup email

    if (exports.settings.email.admin) {

        Utils.email(exports.settings.email.admin, 'NOTICE: ' + exports.settings.name + ' server started', 'Started on ' + Os.hostname());
    }

    // Change OS User

    if (exports.settings.process.runAs) {

        Log.info(exports.settings.name + ' Server switching users from ' + process.getuid() + ' to ' + exports.settings.process.runAs);
        try {

            process.setuid(exports.settings.process.runAs);
            Log.info(exports.settings.name + ' Server active user: ' + process.getuid());
        }
        catch (err) {

            Log.err('Failed setting uid: ' + err);
            process.exit(1);
        }
    }

    // onCompleted callback

    if (onCompleted) {

        onCompleted();
    }
};


