var util = require("util");
var BaseType = require("./base");

function FunctionType(){
  FunctionType.super_.call(this);
}

util.inherits(FunctionType, BaseType);

FunctionType.prototype._base = function(){
  return function(value){ return (typeof value == "function"); };
}

FunctionType.prototype.base = function(){
  this.add('base', this._base());
  return this;
}

function CreateType(){
  return new FunctionType();
}

module.exports = CreateType;
module.exports.FunctionType = FunctionType;