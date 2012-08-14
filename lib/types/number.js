var util = require("util");
var BaseType = require("./base");

function NumberType(){
  NumberType.super_.call(this);
}

util.inherits(NumberType, BaseType);

NumberType.prototype.integer = function(){
  
}