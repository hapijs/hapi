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
};

/**
 * Return percentage of CPU core used by THIS process
 *
 * @param {Function} callback function to process result
 * @api public
 */
ProcessMonitor.prototype.cpu = function(callback) {
  exec('ps -eo pcpu,pid | grep ' + process.pid + " | awk '{print $1}'", function (error, stdout, stderr) {
    if (error) return callback(error);
    // var cpuUsage = Number(stdout.split(" ").shift()).toFixed(2);
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
ProcessMonitor.prototype.memory = function(callback){
  var result = process.memoryUsage();
  result.total = os.totalmem();
  
  callback(null, result);
};

/**
 * Return request response time TODO: move into sep request.js file?
 *
 * @api public
 * @param {Object} req Express request object
 */
ProcessMonitor.prototype.responseTime = function(req) {
  if (!req._startTime) return null;
  
  return new Date() - req._startTime;
};

/**
 * Instrumentation for Hapi goes here
 */
ProcessMonitor.prototype.instrument = function(req, res, next){
  if (req._instrumented){
    return next();
  }
  
  req._startTime = new Date();
  req._instrumented = true;
  
  next();
};

module.exports = exports = new ProcessMonitor();
