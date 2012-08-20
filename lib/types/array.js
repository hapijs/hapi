var util = require("util");
var BaseType = require("./base");

function ArrayType(){
  ArrayType.super_.call(this);
}

util.inherits(ArrayType, BaseType);

ArrayType.prototype.__name = "Array";

ArrayType.prototype._base = function(){
  return function(value){ return (value == null || typeof value == "array"); };
}

ArrayType.prototype.base = function(){
  this.add('base', this._base());
  return this;
}

function CreateType(){
  return new ArrayType();
}

module.exports = CreateType;
module.exports.ArrayType = ArrayType;