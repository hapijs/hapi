/**
 * Module dependencies.
 */
var request = require("request");
var querystring = require("querystring");
var url = require("url");
var Utils = require("./utils");

function Client(options){
  this.options = Utils.merge({}, this._options, options || {});
  
}

Client.prototype._options = {
  
}

Client.prototype.get = function(path, callback){
  
}

Client.prototype.post = function(path, data, callback){
  
}