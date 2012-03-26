/**
 * Module dependencies.
 */
var request = require("request");
var querystring = require("querystring");
var url = require("url");
var Utils = require("./utils");

function Client(options){
  this.options = Utils.merge({}, this._options, options || {});
  
  return this.load(this.options);
}

Client.prototype._options = {
  type: "http"
}

Client.prototype.load = function(options){
  return new Object.hasOwnProperty.call(this.switch, options.type) && this.switch[options.type] || this.switch[this._options.type](options);
}

Client.prototype.switch = {
  http: require("./clients/http"),
  json: require("./clients/json")
}

module.exports = exports = Client;