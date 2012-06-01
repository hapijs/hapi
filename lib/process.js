/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Os = require('os');
var NodeUtil = require('util');
var Events = require('events');
var Utils = require('./utils');
var Email = require('./email');
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

    var that = this;

    if (this.isInitialized !== true) {

        this.isInitialized = true;

        // Set global configuration

        this.settings = Utils.merge(Utils.clone(Defaults.process), options);    // Must happen first to populate configuration required by other modules

        // Listen to uncaught exceptions

        process.on('uncaughtException', function (err) {

            if (that.settings.email &&
                that.settings.email.admin) {

                Email.send(that.settings.email.admin, 'ERROR: Exception on ' + that.settings.name + ' server', err.stack, '', that.settings.email, function (mailErr) {

                    if (mailErr) {

                        console.log('Failed sending exception email: ' + mailErr);      // Do no use Log
                    }

                    Utils.abort('Uncaught exception: ' + err.stack);
                });
            }
            else {

                Utils.abort('Uncaught exception: ' + err.stack);
            }
        });
    }
    else {

        Utils.abort('Process already initialized');
    }
};


// Create and configure server instance

Process.prototype.finalize = function (onCompleted) {

    // Send startup email

    if (this.settings.email &&
        this.settings.email.admin) {

        Utils.email(this.settings.email.admin, 'NOTICE: ' + this.settings.name + ' server started', 'Started on ' + Os.hostname());
    }

    // Change OS User

    if (this.settings.process.runAs) {

        Log.info(this.settings.name + ' Server switching users from ' + process.getuid() + ' to ' + this.settings.process.runAs);
        try {

            process.setuid(this.settings.process.runAs);
            Log.info(this.settings.name + ' Server active user: ' + process.getuid());
        }
        catch (err) {

            Utils.abort('Failed setting uid: ' + err);
        }
    }

    // onCompleted callback

    if (onCompleted) {

        onCompleted();
    }
};


// Update error counter

Process.prototype.reportError = function (message) {

    if (this.isInitialized) {

        this.errorCount += 1;
        this.emit('error', { message: message, count: this.errorCount });
    }
};


module.exports = new Process();
module.exports.Process = Process;
