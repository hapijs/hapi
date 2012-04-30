/**
 * Module dependencies.
 */
var Client = require("../client");
var Utils = require("../utils");

/**
 * Monitor constructor
 *
 * @api public
 */
function Monitor(server) {
  this.server = server.listener;
  this.options = Utils.merge({}, server.settings || {});
  
  // Load process level fns
  this.process = require('./process');
  
  // Load OS level fns
  this.os = require("./os");
  
  // Public properties
  this.clients = {};
  this.timer = null;
  
  return this;
}

/**
 * Default options for Monitor
 */
Monitor.prototype._options = {
  // client: new Client(),
  // handlers: {}
};

Monitor.prototype.getClient = function(host){
  if (this.clients.hasOwnProperty(host)){
    return this.clients[host];
  } else {
    this.clients[host] = new Client({host: host});
    return this.clients[host];
  }
}

/**
 * Hapi Middleware
 */
Monitor.prototype.logger = function(){
  var self = this;
  
  if (this.server){
    this.server.removeListener('request', this.handle('request'));
    this.server.on('request', this.handle('request'));
  }
  
  if (this.options.monitor.interval && Object.keys(this.options.monitor.ops).length > 0){
    clearInterval(this.timer);
    this.timer = setInterval((function(s){
      return function(){
        return s.meter();
      }
    })(self), this.options.monitor.interval);
  }
  
  return this.process.instrument;
};

Monitor.prototype.meter = function(){
  var event = "ops";
  // TODO: factor out into shared fn
  var hosts = Object.keys(this.options.monitor[event]);
  for(var i in hosts){
    var host = hosts[i];
    var client = this.getClient(host);
    // console.log(this.os.poll_cpu.toString())
    this.options.monitor[event][host](client, this)();
  }
}

Monitor.prototype.handle = function(event){
  var self = this;
  return function(req, res){
    if (typeof self.options.monitor[event] !== 'undefined' && self.options.monitor[event] !== null){
      var hosts = Object.keys(self.options.monitor[event]);
      for(var i in hosts){
        var host = hosts[i];
        var client = self.getClient(host);
        self.options.monitor[event][host](client, self)(req, res);
      }
    }
  }
}

// Monitor.prototype.handle = function(signal){
//   var fns = [];
//   if (!this.monitor.hasOwnProperty(signal)){
//     throw "No such handler found (" + signal + ")";
//   } else {
//     for(var host in this.monitor[signal]){
//       fns.append([host, this.monitor[signal][host]])
//     }
//   }
// }

// Module exports
module.exports = exports = Monitor;
