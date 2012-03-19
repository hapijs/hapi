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
  // TODO: enable cross platform support via separate os-specific files
  console.log(process.platform);
  if (process.platform !== "linux") {
    throw "Unsupported OS detected for Monitor"
  }
  
  this.MaxRAM = this.getMaxRAM();
  
  return this;
}

Monitor.prototype.calcMaxRAM = function() {
  var meminfo = '/proc/meminfo';
  var pattern = /MemTotal:[\s]+(\d+)\s+kB/;
  var meminfoContents = fs.readFileSync(meminfo);
  var match = pattern.exec(meminfoContents.toString());
  
  if (match !== null) {
    var totalRAM = parseInt(match[1]) * 1000; // KB to Bytes
    if (!isNaN(totalRAM)) {
      return totalRAM;
    }
  }
  
  throw "Unable to determined Maximum Available RAM";
}

Monitor.prototype.getMaxRAM = function() {
  if (typeof this.MaxRAM === "undefined" || this.MaxRAM === null) {
    this.MaxRAM = this.calcMaxRAM();
  }
  return this.MaxRAM;
}

Monitor.prototype.uptime = function() {
  return process.uptime();
}

Monitor.prototype.memory = function() {
  var snapshot = process.memoryUsage();
  var usage = {
    total: this.getMaxRAM(),
    used: snapshot.rss + snapshot.heapTotal
  }
  
  // console.log((usage.used / usage.total) * 100);
  return usage;
}

Monitor.prototype.poll_cpu = function(callback) {
  var statfile = '/proc/stat';
  try {
    fs.readFile(statfile, function(err, contents) {
      if (err) throw err;
      
      // TODO: treat contents.toString().split("\n") as array, filter out non cpu* entries
      var pattern = /cpu[\d]?[\s]+(.*)/g;
      var file_contents = contents.toString();
      
      var result;
      var cpulines = {};
      while ((result = pattern.exec(file_contents)) != null) {
        var source = result[0].split(/\s+/);
        var cpu = source.shift(); // remove 'cpu(\d?)' from string
        var line = source.map(function(d){ return +d; });
        line = line.slice(0,4); // strip non relevant numbers
        console.log(cpu, line)
        // cpulines.push(line);
        cpulines[cpu] = line;
      }
      
      var cpuline = cpulines['cpu']; // TODO: replace
      
      var cpustats = {
        idle: cpuline[3],
        total: cpuline.reduce(function(a, b){ return a + b; })
      }
      console.log(cpustats);
      
      
      return callback(null, cpustats);
    })
  } catch (err) {
    throw err;
  }
}

Monitor.prototype.cpu = function(callback) {
  // TODO: OS-support: only tested on RHEL, doesn't work on OSX
  
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