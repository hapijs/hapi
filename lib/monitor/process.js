// Load modules

var ChildProcess = require('child_process');
var Os = require('os');
var Utils = require('../utils');


// Declare internals

var internals = {};


/**
* Process Monitor Constructor, most functions inherited from process module
*
* @api public
*/
module.exports.Monitor = internals.ProcessMonitor = function () {

    Utils.assert(this.constructor === internals.ProcessMonitor, 'ProcessMonitor must be instantiated using new');

    this.builtins = ['uptime', 'memoryUsage'];

    // Expose Node os functions as async fns
    Utils.inheritAsync(internals.ProcessMonitor, process, this.builtins);

    return this;
};


/**
* Return percentage of CPU core used by THIS process
*
* @param {Function} callback function to process result
* @api public
*/
internals.ProcessMonitor.prototype.cpu = function (callback) {

    ChildProcess.exec('ps -eo pcpu,pid | grep ' + process.pid + ' | awk \'{print $1}\'', function (error, stdout, stderr) {

        if (error) {
            return callback(error);
        }

        // var cpuUsage = Number(stdout.split(' ').shift()).toFixed(2);
        var cpuUsage = Number(stdout);
        callback(null, cpuUsage);
    });
};


/**
* Return process memoryUsage with total system memory
*
* @param {Function} callback function to process result
* @api public
*/
internals.ProcessMonitor.prototype.memory = function (callback) {

    var result = process.memoryUsage();
    result.total = Os.totalmem();

    callback(null, result);
};