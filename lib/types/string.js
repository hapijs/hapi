var util = require("util");
var BaseType = require("./base");

function StringType(){
  
}

util.inherits(StringType, BaseType);

StringType.prototype.min = function(n){
  if (typeof n == "undefined" || n == null){
    // throw BaseType.UnspecifiedInputError;
    throw "#min requires an input parameter n";
  }
  
  this.set("minlen", n);
  
  return this;
}

module.exports = StringType;