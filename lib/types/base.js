/**
 * Module dependencies.
 */

/**
 * Constants
 */
var INTERNAL_DATA_KEY = "_validators";
var INTERNAL_KEY_LIST = "_checks";

/**
 * BaseType Constructor
 *
 * @api public
 */
var BaseType = function(){
  this[INTERNAL_DATA_KEY] = [];
  this[INTERNAL_KEY_LIST] = {};
  
  if (typeof this.base !== "undefined" && this.base !== null){
    this.base();
  }
}

BaseType.prototype.valueOf = function(){
  return this[INTERNAL_DATA_KEY];
}
BaseType.prototype.toString = function(){
  return JSON.stringify(this.valueOf());
}

BaseType.prototype.increment = function(key){
  if (key in this[INTERNAL_KEY_LIST]){
    this[INTERNAL_KEY_LIST][key]++;
  } else {
    this[INTERNAL_KEY_LIST][key] = 1;
  }
}

BaseType.prototype.add = function(key, value){
  if (typeof key == "undefined" || key == null){
    throw "(type).add must given a key";
  }
  
  if (typeof value !== "undefined" && value !== null){
    // TODO: add check for invalid keys
    
    this[INTERNAL_DATA_KEY].push(value);
    this.increment(key);
  }
  
  return this[INTERNAL_DATA_KEY];
}

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