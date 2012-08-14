var util = require("util");
var BaseType = require("./base");
var Email = require("./email");

function StringType(){
  StringType.super_.call(this);
}

util.inherits(StringType, BaseType);

StringType.prototype.min = function(n){
  this.set("min", function(value){ return value.length >= n; });
  return this;
}

StringType.prototype.max = function(n){
  this.set("max", function(value){ return value.length <= n; });
  return this;
}

StringType.prototype.regex = function(pattern){
  this.set('regex', function(value){ return value.match(pattern) !== null; });
  return this;
}

StringType.prototype.alphanum = function(){
  var pattern = /^[a-zA-Z0-9]+$/; // TODO: option for spaces?
  this.regex(pattern);
  return this;
}

StringType.prototype.email = function(){
  this.regex(Email._regex);
  return this;
}

module.exports = StringType;