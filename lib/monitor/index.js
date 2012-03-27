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
function Monitor(options) {
  this.options = Utils.merge({}, this._options, options || {});
  
  // Load process level fns
  this.process = require('./process');
  
  // Load OS level fns
  this.os = require("./os");
  
  return this;
}

/**
 * Default options for Monitor
 */
Monitor.prototype._options = {
  client: new Client(),
  handlers: {}
};

/**
 * Hapi Middleware
 */
Monitor.prototype.logger = function(server){
  if (server){
    server.on('request', (this.handlers.request && this.options.client) ? this.handlers.request(this.options.client) : console.log);
  }
  
  return this.process.instrument;
};

// Module exports
module.exports = new Monitor();