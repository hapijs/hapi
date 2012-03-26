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
  
  // // TODO: Initialize AniviaClient if config has host
  
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

// Module exports
module.exports = new Monitor();