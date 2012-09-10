// Load modules

var Utils = require('./utils');
var Log = require('./log');
var Defaults = require('./defaults');


// Declare internals

var internals = {};


// Define process object

internals.Process = function () {

    this.settings = null;
    return this;
};


// Initialize process

internals.Process.prototype.initialize = function (options) {

    // Set global configuration

    Utils.assert(!this.settings, 'Process already initialized');
    this.settings = Utils.applyToDefaults(Defaults.process, options);    // Must happen first to populate configuration required by other modules

    // Listen to uncaught exceptions

    process.on('uncaughtException', function (err) {
        Utils.abort('Uncaught exception: ' + err.stack);
    });
};


// Create and configure server instance

internals.Process.prototype.finalize = function (onCompleted) {

    // Change OS User

    if (this.settings.process.runAs) {

        Log.event('info','Server switching users from ' + process.getuid() + ' to ' + this.settings.process.runAs);
        try {

            process.setuid(this.settings.process.runAs);
            Log.event('info', 'Server active user: ' + process.getuid());
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


module.exports = new internals.Process();


