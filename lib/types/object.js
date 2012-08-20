var util = require("util");
var BaseType = require("./base");

function ObjectType(){
  ObjectType.super_.call(this);
}

util.inherits(ObjectType, BaseType);

ObjectType.prototype.__name = "Object";

ObjectType.prototype._base = function(){
  return function(value){ return (value == null || typeof value == "object"); };
}

ObjectType.prototype.base = function(){
  this.add('base', this._base());
  return this;
}

function CreateType(){
  return new ObjectType();
}

module.exports = CreateType;
module.exports.ObjectType = ObjectType;