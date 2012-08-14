var util = require("util");
var BaseType = require("./base");
var Email = require("./email");

function StringType(){
  StringType.super_.call(this);
}

util.inherits(StringType, BaseType);

StringType.prototype.min = function(n){
  this.set("minlen", n);
  return this;
}

StringType.prototype.max = function(n){
  this.set("max", n);
  return this;
}

String.prototype.regex = function(pattern){
  this.set('regex', pattern);
  return this;
}

String.prototype.alphanum = function(){
  var alphanum = /[a-zA-Z0-9]+/; // TODO: option for spaces?
  this.set('regex', alphanum);
  return this;
}

String.prototype.email = function(){
  this.set('regex', Email._regex);
  return this;
}

module.exports = StringType;