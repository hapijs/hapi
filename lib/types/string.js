var util = require("util");
var BaseType = require("./base");
var Email = require("./email");

function StringType(){
  StringType.super_.call(this);
}

util.inherits(StringType, BaseType);

StringType.prototype.__name = "String";

StringType.prototype._base = function(){
  return function(value){ return (value == null || typeof value == "string"); };
}

StringType.prototype.base = function(){
  this.add("base", this._base());
  return this;
}

StringType.prototype._min = function(n){
  return function(value){ return value.length >= n; };
}

StringType.prototype.min = function(n){
  this.add("min", this._min(n));
  return this;
}

StringType.prototype._max = function(n){
  return function(value){ return value.length <= n; };
}

StringType.prototype.max = function(n){
  this.add("max", this._max(n));
  return this;
}

StringType.prototype._regex = function(n){
  return function(value){ return value.match(n) !== null; };
}

StringType.prototype.regex = function(pattern){
  this.add('regex', this._regex(pattern));
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

StringType.prototype.finalize = function(){
  // TODO: watch for conflicting settings?
}

function CreateStringType(){
  return new StringType();
}

module.exports = CreateStringType;
module.exports.StringType = StringType;