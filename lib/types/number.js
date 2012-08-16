var util = require("util");
var BaseType = require("./base");

function NumberType(){
  NumberType.super_.call(this);
}

util.inherits(NumberType, BaseType);

NumberType.prototype.__name = "Number";

NumberType.prototype.convert = function(value){
  return Number(value);
}

NumberType.prototype._base = function(){
  return function(value){
    return !isNaN(value); 
  };
}

NumberType.prototype.base = function(){
  this.add('base', this._base());
  return this;
}

NumberType.prototype._min = function(n){
  return function(value){ return value >= n; };
}

NumberType.prototype.min = function(n){
  this.add('min', this._min(n));
  return this;
}

NumberType.prototype._max = function(n){
  return function(value){ return value <= n; };
}

NumberType.prototype.max = function(n){
  this.add('max', this._max(n));
  return this;
}

NumberType.prototype._integer = function(){
  return function(value){ return (!isNaN(value) && ((value|0) == parseFloat(value))); };
}

NumberType.prototype.integer = function(){
  this.add('integer', this._integer());
  return this;
}

NumberType.prototype._float = function(){
  var isInt = this._integer();
  return function(value){ return !isInt(value); };
}

NumberType.prototype.float = function(){
  this.add('float', this._float());
  return this;
}

function CreateType(){
  return new NumberType();
}

module.exports = CreateType;
module.exports.NumberType = NumberType;