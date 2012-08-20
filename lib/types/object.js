var util = require("util");
var BaseType = require("./base");

function ObjectType() {

  ObjectType.super_.call(this);
}

util.inherits(ObjectType, BaseType);

ObjectType.prototype.__name = "Object";

ObjectType.prototype.convert = function(value) {

  return JSON.parse(value);
}

ObjectType.prototype._base = function() {

  return function(value) {

    return (value == null || typeof value == "object");
  };
}

ObjectType.prototype.base = function() {

  this.add('base', this._base());
  return this;
}

ObjectType.prototype._date = function(){

  return function(value){

    var converted = new Date(value);
    return !isNaN(converted.getTime());
}

ObjectType.prototype.date = function(){

  this.add('date', this._date.apply(arguments));
  return this;
}

function CreateType() {

  return new ObjectType();
}

module.exports = CreateType;
module.exports.ObjectType = ObjectType;