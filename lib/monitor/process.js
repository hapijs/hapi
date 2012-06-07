/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

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
ProcessMonitor = function () {

    this.builtins = ['uptime', 'memoryUsage'];

    // Expose Node os functions as async fns

    Utils.inheritAsync(ProcessMonitor, process, this.builtins);

    return this;
};


/**
* Return percentage of CPU core used by THIS process
*
* @param {Function} callback function to process result
* @api public
*/
ProcessMonitor.prototype.cpu = function (callback) {

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
ProcessMonitor.prototype.memory = function (callback) {

    var result = process.memoryUsage();
    result.total = Os.totalmem();

    callback(null, result);
};


module.exports = new ProcessMonitor();
module.exports.Monitor = ProcessMonitor;