/**
 * Module dependencies.
 */
var child_process = require("child_process");
var exec = child_process.exec;
var Base = require("./base");

var ProcessMonitor = function(){
  Base.expose(ProcessMonitor, process, ['uptime', 'memoryUsage']);
  
  return this;
}

/**
 * Return percentage of CPU core used by THIS process
 *
 * @param {Function} callback function to process result
 * @api public
 */
ProcessMonitor.prototype.cpu = function(callback) {
  exec('ps -eo pcpu,pid | grep ' + process.pid, function (error, stdout, stderr) {
    if (error) return callback(error);
    var cpuUsage = Number(stdout.split(" ").shift()).toFixed(2);
    callback(null, cpuUsage)
  })
}

module.exports = exports = new ProcessMonitor();
