/**
 * Module dependencies.
 */
var child_process = require("child_process");
var exec = child_process.exec;
var os = require("os");
var Base = require("./base");

var ProcessMonitor = function(){
  this.builtins = ['uptime', 'memoryUsage'];
  Base.expose(ProcessMonitor, process, this.builtins);
  
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

/**
 * Return process memoryUsage with total system memory
 *
 * @param {Function} callback function to process result
 * @api public
 */
ProcessMonitor.prototype.memory = function(callback){
  var result = process.memoryUsage();
  result.total = os.totalmem();
  
  callback(null, result);
}

/**
 * Return request response time
 *
 * @api public
 * @param {Object} req Express request object
 */
ProcessMonitor.prototype.responseTime = function(req) {
  if (!req._startTime) return null;
  
  return new Date - req._startTime;
}


module.exports = exports = new ProcessMonitor();
