/**
 * Module dependencies.
 */
var child_process = require("child_process");
var exec = child_process.exec;
var fs = require("fs");
var os = require("os");
var Base = require("./base");

var OSMonitor = function(){
  this.builtins = ['loadavg', 'uptime', 'freemem', 'totalmem', 'cpus'];
  
  // Expose Node os functions as async fns
  Base.expose(OSMonitor, os, this.public_methods);
  
  return this;
};

/**
 * Grab slice of CPU usage information for all cores from /proc/stat
 *
 * @param {Function} callback function to process the asynchronous result
 * @api private 
 */
OSMonitor.prototype.poll_cpu = function(target, callback) {
  var statfile = '/proc/stat';
  try {
    fs.readFile(statfile, function(err, contents) {
      if (err) throw err;
      
      // TODO: FUTURE: optimization for later, if target known, customize regexp for that
      var pattern = /cpu[\d]?[\s]+(.*)/g;
      var file_contents = contents.toString();
      
      var result;
      var cpulines = {};
      while ((result = pattern.exec(file_contents)) !== null) {
        var source = result[0].split(/\s+/);
        var cpu = source.shift(); // remove 'cpu(\d?)' from string
        var line = source.map(function(d){ return +d; }); // convert all to Number
        line = line.slice(0,4); // strip non-relevant numbers
        cpulines[cpu] = line;
        
        if (target === cpu){
          break; // short circuit if found
        }
      }
      
      if (!cpulines.hasOwnProperty(target)){
        return callback("No such target found for Monitor.poll_cpu (" + target + " does not exist)");
      }
      
      var cpuline = cpulines[target];
      var cpustats = {
        idle: cpuline[3],
        total: cpuline.reduce(function(a, b){ return a + b; })
      };
      
      return callback(null, cpustats);
    });
  } catch (err) {
    return callback(err);
  }
};

/**
 * Return 1-second slice of total cpu usage percentage from across all cores
 * 
 * @param {Function} callback function to handle response
 * @api public
 */
OSMonitor.prototype.cpu = function(target, callback) {
  // TODO: OS-support: only tested on RHEL, doesn't work on OSX
  if (typeof target === "function"){
    callback = target;
    target = 'cpu';
  }
  
  var self = this;
  self.poll_cpu(target, function(err, stats_start) {
    setTimeout((function(){
      self.poll_cpu(target, function(err, stats_end) {
        var idle_delta = parseFloat(stats_end.idle - stats_start.idle);
        var total_delta = parseFloat(stats_end.total - stats_start.total);
        var cpuUsage = ((total_delta - idle_delta) / (total_delta)) * 100;
        
        callback(null, cpuUsage.toFixed(2));
      });
    }), 1000);
  });
};

/**
 * Returns disk usage percentage for a specified filesystem
 *
 * @param {String} filesystem filesystem to check disk usage for (default '/')
 * @param {Function} callback function to process results
 * @api public
 */
OSMonitor.prototype.disk = function(filesystem, callback) {
  if (typeof filesystem == "function"){
    callback = filesystem;
    filesystem = null;
  }
  filesystem = filesystem || '/';
  
  exec('df -h ' + filesystem + " | tail -1 | awk '{print $5}'", function(err, stdout, stderr){
    if (err || stderr !== ''){
      return callback(err || stderr);
    }
    
    return callback(null, stdout);
  });
};

module.exports = exports = new OSMonitor();