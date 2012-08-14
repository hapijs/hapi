/**
 * Module dependencies.
 */

/**
 * Constants
 */
var INTERNAL_DATA_KEY = "_config";

/**
 * BaseType Constructor
 *
 * @api public
 */
var BaseType = function(){
  this[INTERNAL_DATA_KEY] = {};
}

BaseType.prototype.valueOf = function(){
  return this[INTERNAL_DATA_KEY];
}
BaseType.prototype.toString = function(){
  return JSON.stringify(this.valueOf());
}

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
  return this;
}

BaseType.prototype.optional = function(){
  this.required(false);
  return this;
}

BaseType.prototype.valid = function(){
  this.set("valid", Array.prototype.slice.call(arguments));
  return this;
}

BaseType.prototype.invalid = function(){
  this.set("invalid", Array.prototype.slice.call(arguments));
  return this;
}

BaseType.prototype.with = function(){
  this.set("with", Array.prototype.slice.call(arguments));
  return this;
}

BaseType.prototype.without = function(){
  this.set("without", Array.prototype.slice.call(arguments));
  return this;
}

module.exports = BaseType;