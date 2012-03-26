/**
 * Module dependencies.
 */
var child_process = require("child_process");
var exec = child_process.exec
var fs = require("fs");
var os = require("os");
var request = require("request");
var Utils = require("../utils");

/**
 * Monitor constructor
 *
 * @api public
 */
function Monitor(options) {
  // TODO: enable cross platform support via separate os-specific files
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
  client: null,
  // outbound: {
  //   transport: "http",
  //   host: null,
  //   interval: 30000
  // },
  // Deprecated
  // inbound: {
  //   route: "/_monitor/",
  // },
  // geodat: null
}

/**
 * Instrumentation for Hapi goes here
 */
Monitor.prototype.instrument = function(req, res, next){
  req._startTime = new Date();
  
  next();
}

/**
 * Hapi Middleware
 */
Monitor.prototype.logger = function(server){
  var client = this.options.client;
  
  if (server){
    if (typeof client == "undefined" || client === null){
      server.on('request', this.log(console, requestSchema))
    } else {
      server.on('request', this.log(client, requestSchema))
    }
  }
  
  return this.instrument;
}

// Module exports
module.exports = new Monitor();