/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Os = require('os');
var NodeUtil = require('util');
var Events = require('events');
var Utils = require('./utils');
var Log = require('./log');
var Defaults = require('./defaults');


// Declare internals

var internals = {};


// Define process object

var Process = function () {

    this.settings = null;
    this.isInitialized = false;
    this.errorCount = 0;

    return this;
};

NodeUtil.inherits(Process, Events.EventEmitter);


// Initialize process

Process.prototype.initialize = function (options) {

    if (this.isInitialized !== true) {

        this.isInitialized = true;

        // Set global configuration

        this.settings = Utils.merge(Utils.clone(Defaults.process), options || {});    // Must happen first to populate configuration required by other modules

        // Listen to uncaught exceptions

        process.on('uncaughtException', function (err) {

            Log.err('Uncaught exception: ' + err.stack);

            if (exports.settings.email && exports.settings.email.admin) {

                Utils.email(exports.settings.email.admin, 'ERROR: Exception on ' + exports.settings.name + ' server', err.stack, '', function (err) {

                    process.exit(1);
                });
            }
            else {

                process.exit(1);
            }
        });
    }
    else {

        Log.err('Process already initialized');
        process.exit(1);
    }
};


// Create and configure server instance

Process.prototype.finalize = function (onCompleted) {

    // Send startup email

    if (exports.settings.email &&
        exports.settings.email.admin) {

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


// Update error counter

Process.prototype.reportError = function (message) {

    this.errorCount += 1;
    this.emit('error', { message: message, count: this.errorCount });
};


module.exports = new Process();
