/**
 * Module dependencies.
 */
var request = require("request");
var querystring = require("querystring");
var url = require("url");


/**
 *
 */
function AniviaClient(options) {
  this.options = Utils.merge({}, this._options, options || {});
  
  return this;
}

AniviaClient.prototype._options = {
  outbound: {
    transport: "http",
    host: null,
    path: "/trackevents",
    interval: 30000
  }
}

AniviaClient.prototype._request = {
  uri: url.format({
    procotol: this.options.outbound.transport,
    host: this.options.host,
    pathname: this.options.path
  })
}

AniviaClient.prototype.send = function(req, callback){
  var options = Utils.merge({}, this._request, req);
  
  // This is an ugly, ugly hack TODO: map out information flow and fix
  if (typeof options.params !== "undefined" and options.params !== null) {
    options.uri += options.params;
    delete options.params;
  }
  
  request(options, (err, res, body){
    return callback(err, res, body); // TODO: wrap error handling?
  })
}

AniviaClient.prototype.post = function(data, callback){
  this.send({
    method: "POST",
    json: {
      message: data
    }
  }, callback);
}

AniviaClient.prototype.get = function(data, callback){
  this.send({
    method: "GET",
    params: querystring.stringify(data)
  }, callback);
}

