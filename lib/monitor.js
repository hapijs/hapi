/**
 * Module dependencies.
 */
var fs = require("fs");

/**
 * Monitor constructor
 *
 * @api public
 */
function Monitor() {
  return this;
}

Monitor.prototype.uptime = function() {
  return process.uptime();
}

Monitor.prototype.memory = function() {
  /*
    looks like this: 
    {
      rss: 100,
      heapTotal: 100,
      heapUsed: 100
    }
  */
  return process.memoryUsage();
}

Monitor.prototype.poll_cpu = function(callback) {
  var statfile = '/proc/stat';
  try {
    fs.readFile(statfile, function(err, contents) {
      if (err) throw err;
      
      // TODO: treat contents.toString().split("\n") as array, filter out non cpu* entries
      
      var cpu_index = 0;
      var cpuline = contents.toString().split("\n")[cpu_index].split(/\s+/).map(function(d){ return +d; });
      cpuline.shift(); // remove 'cpu'
      cpuline = cpuline.slice(0,4)
      console.log(cpuline)
      
      // var cpuidle = cpuline[4];
      // var cputotal = cpuline.reduce(function(a,b){ return a + b; }); //cpuline.slice(0).split(" ").slice(2).map(function(d){ return +d});
      // var cpuusage = (cputotal - cpuidle) / cputotal
      
      var cpustats = {
        idle: cpuline[3],
        total: cpuline.reduce(function(a,b){ return a + b; })
      }
      console.log(cpustats);
      
      
      return callback(null, cpustats);
    })
  } catch (err) {
    throw err;
  }
}

Monitor.prototype.cpu = function(callback) {
  var self = this;
  self.poll_cpu(function(err, stats_start) {
    setTimeout((function(){
      self.poll_cpu(function(err, stats_end) {
        var idle_delta = parseFloat(stats_end.idle - stats_start.idle);
        var total_delta = parseFloat(stats_end.total - stats_start.total);
        
        var cpuUsage = ((total_delta - idle_delta) / (total_delta)) * 100;
        
        console.log(idle_delta, total_delta, cpuUsage)
        
        callback(null, cpuUsage);
      })
    }), 1000)
  })
}

// Module exports
module.exports = new Monitor();
// module.exports = Monitor;