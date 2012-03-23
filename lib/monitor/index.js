/**
 * Module dependencies.
 */
var child_process = require("child_process");
var exec = child_process.exec
var fs = require("fs");
var os = require("os");
var request = require("request");
var Utils = require("./utils");

/**
 * Monitor constructor
 *
 * @api public
 */
function Monitor(options) {
  // TODO: enable cross platform support via separate os-specific files
  this.options = Utils.merge({}, this._options, options || {});
  
  // Check OS
  if (process.platform !== "linux") {
    throw process.platform + " is currently not supported by Monitor";
  }
  
  this.MaxRAM = this.getMaxRAM();
  
  this.public_methods = ["uptime", "memory", "cpu", "pcpu", "response_time"];
  // if (this.get_geocity() !== null){
  //   this.public_methods.append("geolocate");
  // }
  
  // TODO: Initialize AniviaClient if config has host
  
  return this;
}

/**
 * Default options for Monitor
 */
Monitor.prototype._options = {
  outbound: {
    transport: "http",
    host: null,
    interval: 30000
  },
  inbound: {
    route: "/_monitor/",
  },
  geodat: null
}

/**
 *
 */
Monitor.prototype.report = function(stats) {
  var data = {}
  for(var i in stats){
    var key = stats[i];
    if (this.hasOwnProperty(key)) {
      data[key] = this[key]
    }
  }
}

/**
 * Register process with monitoring collector for inbound polling
 */
Monitor.prototype.register = function() {
  // TODO:
  
  process.on("exit", this.deregister);
}

/**
 * Unregister process with monitoring collector for inbound polling
 */
Monitor.prototype.deregister = function(){ 
  // TODO:
}

/**
 * Getter for geo dat file
 */
Monitor.prototype.get_geocity = function(){
  if (typeof this.options.geodat !== "undefined" && this.options.geodata !== null) {
    if (path.existsSync(this.options.geodat)){
      
      // TODO: move this into a loader
      try {
        var geoip = require("geoip"); // requires 
        var City = geoip.City;
        var city = new City(this.options.geodat);
      } catch (err) {
        return null;
      }
      
      return this.options.geodat;
    }
  }
  
  return null;
}

/**
 * Middleware (early in stack) required for other Monitor middleware to work
 */
Monitor.prototype.onPreRoute = function(req, res, next) {
  req._startTime = new Date; // Used to determine request response time 
  // TODO: warm up cpu poll function?
  
  next();
}

/**
 * Middleware to make req[:fn] available to request handlers
 */
Monitor.prototype.onPreHandler = function() {  
  var wrapped = function(req, res, next) {
    if (!req._startTime) throw "Monitor.onPreHandler middleware requires Monitor.onPreRoute"
    
    // TODO: evaluate this approach vs just exposing Monitor directly
    for(var i in this.public_methods) {
      req[this.public_methods[i]] = this[this.public_methods[i]];
    }
    
    next();
  }
  
  return wrapped;
}

/**
 * Middleware to include /_monitor/:fn routes
 */
Monitor.prototype.onPostHandler = function() {  
  var wrapped = function(req, res, next) {
    if (!req._startTime) throw "Monitor.onPostHandler middleware requires Monitor.onPreRoute"
    
    try {
      var url = decodeURIComponent(req.url);
    } catch (e) {
      throw e; // TODO: properly respond to error
    }
    
    // TODO: if route matches this.options.inbound.route + ":fn", return response
    // var pattern = new RegExp(this.options.inbound.route + "(\S+)");
    // var match = pattern.exec(url);
    // if (match !== null) {
    //   if (match[1] in this.public_methods) {
    //     this[this.public_methods[match[1]]](function(err, response){
    //       // TODO: handle err
          
    //       // TODO: handle response
    //     })
    //   }
    // }
    
    next();
  }
  
  // this.register();
  
  return wrapped;
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


/**
 * Returns disk usage percentage for a specified filesystem
 *
 * @param {String} filesystem filesystem to check disk usage for (default '/')
 * @param {Function} callback function to process results
 * @api public
 */
Monitor.prototype.disk = function(filesystem, callback) {
  filesystem = filesystem || '/';
  
  exec('df -h ' + filesystem + " | tail -1 | awk '{print $5}'", function(err, stdout, stderr){
    if (err || stderr !== ''){
      return callback(err || stderr);
    }
    
    return callback(null, stdout)
  })
}

/**
 * Returns process uptime in seconds
 *
 * @param {Number} digits number of decimal places to keep, default 2
 * @return {String}
 * @api public
 */ 
Monitor.prototype.uptime = function(digits) {
  digits = digits || 2
  uptime = {
    process: process.uptime().toFixed(digits)
    system: os.uptime().toFixed(digits)
  }
  
  return uptime;
}

/**
 * Returns an object with total & memory used by process
 */
Monitor.prototype.memory = function() {
  var snapshot = process.memoryUsage();
  var usage = {
    total: this.getMaxRAM(),
    rss: snapshot.rss,
    heap: snapshot.heapTotal
  }
  
  // console.log((usage.used / usage.total) * 100);
  return usage;
}

/**
 * Return request response time
 *
 * @api public
 * @param {Object} req Express request object
 */
Monitor.prototype.responseTime =
Monitor.prototype.response_time = function(req) {
  if (!req._startTime) return null;
  
  return new Date - req._startTime;
}

/**
 * Return percentage of CPU core used by THIS process
 *
 * @param {Function} callback function to process result
 * @api public
 */
Monitor.prototype.pcpu = function(callback) {
  exec('ps -eo pcpu,pid | grep ' + process.pid, function (error, stdout, stderr) {
    if (error) return callback(error);
    var cpuUsage = Number(stdout.split(" ").shift()).toFixed(2);
    callback(null, cpuUsage)
  })
}

/**
 * Grab CPU idle, total usage information for cores from /proc/stat
 *
 * @param {Function} callback function to process the asynchronous result
 * @api private 
 */
Monitor.prototype.poll_cpu = function(target, callback) {
  var statfile = '/proc/stat';
  try {
    fs.readFile(statfile, function(err, contents) {
      if (err) throw err;
      
      // TODO: FUTURE: optimization for later, if target known, customize regexp for that
      var pattern = /cpu[\d]?[\s]+(.*)/g;
      var file_contents = contents.toString();
      
      var result;
      var cpulines = {};
      while ((result = pattern.exec(file_contents)) != null) {
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
      }
      
      return callback(null, cpustats);
    })
  } catch (err) {
    return callback(err);
  }
}

/**
 * Return total cpu usage percentage from across all cores
 * 
 * @param {Function} callback function to handle response
 * @api public
 */
Monitor.prototype.cpu = function(target, callback) {
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
      })
    }), 1000)
  })
}

// TODO: move this out to an optional, separate module
/**
 * Geolocate an incoming request
 *
 * @param {Object} req Express request object
 * @param {Function} callback function to process the result
 * @api public
 */
// Monitor.prototype.geolocate = function(req, callback) {
//   var ip_address = req.socket && (req.socket.remoteAddress || (req.socket.socket && req.socket.socket.remoteAddress));
//   var geodat = this.get_geocity();
//   if (!geodat) {
//     return callback("Must configure a geodat file to use Monitor.geolocate()");
//   }
  
//   try {
//     var geoip = require("geoip"); // requires libgeoip c module
//     var City = geoip.City;
//     var city = new City(geodat);
//   } catch (err) {
//     return callback(err);
//   }
  
//   city.lookup(ip_address, function(err, data) {
//     if (err) return callback(err);
    
//     callback(null, data);
//   });
// }

// Module exports
module.exports = new Monitor();