/**
 * Module dependencies.
 */

/**
 * Constants
 */
var INTERNAL_DATA_KEY = "_config"

/**
 * BaseType Constructor
 *
 * @api public
 */
var BaseType = function(){
  this[INTERNAL_DATA_KEY] = {};
}

BaseType.prototype.valueOf = function(){
  console.log(this[INTERNAL_DATA_KEY])
  console.log(JSON.stringify(this[INTERNAL_DATA_KEY]))
  return JSON.stringify(this[INTERNAL_DATA_KEY]);
}
// BaseType.prototype.toJSON = 

BaseType.prototype.set = function(key, value){
  if (typeof key == "undefined" || key == null){
    throw "(type).set must given a key";
  }
  
  if (typeof value !== "undefined" && value !== null){
    // TODO: add check for invalid keys
    
    this[INTERNAL_DATA_KEY][key] = value;
  }
  
  return this[INTERNAL_DATA_KEY][key];
}
BaseType.prototype.get = BaseType.prototype.set;

BaseType.prototype.required = function(required){
  this.set("required", required || true);
}

BaseType.prototype.optional = function(){
  this.required(false);
}

module.exports = BaseType;