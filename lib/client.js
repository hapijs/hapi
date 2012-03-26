/**
 * Module dependencies.
 */
var fs = require("fs");
var path = require("path");
var request = require("request");
var querystring = require("querystring");
var url = require("url");
var Utils = require("./utils");

function Client(options){
  this.options = Utils.merge({}, this._options, options || {});
  
  // Check for unfinished requests (TODO)
  if (this.options.safe === true){
    this.deferred = this.loadDeferred(this.options.deferredPath);
  }
  
  return this;
}

Client.prototype._options = {
  headers: {
    
  },
  host: null,
  version: "*",
  safe: false,
  deferredPath: "./log/"
}

Client.prototype.defer = function(opts, err){
  // TODO: check type of error
}

Client.prototype.request = function(method, path, options, callback){
  var self = this;
  var opts = {
    method: method,
    uri: path.join(this.options.host, path)
  }
  
  // Allow user to set additional options
  Utils.merge(opts, options || {});
    
  // TODO: handle cookies, attachments, etc...
  
  // TODO: handle error (like this.options.host = null)
  
  // Try to make request
  request(opts, function(err, res, body){
    if (self.options.safe === true && err) {
      self.defer(opts, err);
    }
    
    if (callback) {
      return callback(err, res, body);
    }
  })
}

Client.prototype.get = function(path, options, callback){
  if (typeof options == "function"){
    callback = options;
    options = {}
  }
  
  this.request('get', path, options, callback);
}

Client.prototype.post = function(path, options, callback){
  if (typeof options == "function"){
    callback = options;
    options = {}
  }
  
  this.request('post', path, options, callback);
}

module.exports = Client;