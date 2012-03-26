/**
 * Module dependencies.
 */
var fs = require("fs");
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
  headers: {}, // TODO: deprecate?
  host: null,
  version: "*", // TODO: deprecate?
  safe: false,
  deferredPath: "./log/"
}

Client.prototype.defer = function(opts, err){
  // TODO: check type of error
}

Client.prototype.formatURL = function(host, path) {
  // absolute path given
  if (path.indexOf("http") == 0){ 
    return path; 
  }
  
  // absolute host, relative path
  if (host.indexOf('http') == 0){
    return [host, path].filter(function(d){ return d != null; }).join('/');
  }
  
  // TODO: what are the other cases?
};

Client.prototype.request = function(method, path, options, callback){
  var self = this;
  var opts = {
    method: method,
    uri: this.formatURL(this.options.host, path)
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

Client.prototype.post = function(path, data, options, callback){
  if (typeof options == "function"){
    callback = options;
    options = {}
  }
  options.json = data;
  
  this.request('post', path, options, callback);
}

Client.prototype.head = function(path, options, callback){
  if (typeof options == "function"){
    callback = options;
    options = {}
  }
  
  this.request('head', path, options, callback);
}

module.exports = Client;