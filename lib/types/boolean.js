var util = require("util");
var BaseType = require("./base");

function BooleanType(){
  BooleanType.super_.call(this);
}

util.inherits(BooleanType, BaseType);

BooleanType.prototype.__name = "Boolean";

BooleanType.prototype._base = function(){
  return function(value){ return (typeof value == "boolean"); };
}

BooleanType.prototype.base = function(){
  this.add('base', this._base());
  return this;
}

function CreateType(){
  return new BooleanType();
}

module.exports = CreateType;
module.exports.BooleanType = BooleanType;