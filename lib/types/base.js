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
  this[INTERNAL_KEY_LIST] = [];
  
  if (typeof this.base !== "undefined" && this.base !== null){
    this.base();
  }
  
  if (typeof this.__name !== "undefined" && this.__name !== null){
    this["type"] = this.__name;
  }
}

BaseType.prototype.valueOf = function(){
  return this[INTERNAL_DATA_KEY];
}
BaseType.prototype.toString = function(){
  return JSON.stringify(this.valueOf());
}

BaseType.prototype.increment = function(key){
  // if (key in this[INTERNAL_KEY_LIST]){
  //   this[INTERNAL_KEY_LIST][key]++;
  // } else {
  //   this[INTERNAL_KEY_LIST][key] = 1;
  // }
  this[INTERNAL_KEY_LIST].push(key)
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

var exists = function(n){
  return (typeof n !== "undefined" && n !== null);
}

BaseType.prototype._required = function(required){
  required = required || true;
  return function(value){
    return (required == exists(value))
  }
}

BaseType.prototype.required = function(required){
  // this.add("required", function(value){ return (required == exists(value)); });
  this.add("required", this._required(required));
  return this;
}

// BaseType.prototype.optional = function(){
//   this.required(false);
//   return this;
// }

BaseType.prototype._valid = function(acceptable){
  return function(value){
    return value in acceptable;
  }
}

BaseType.prototype.valid = function(){
  this.add("valid", this._valid(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype._invalid = function(unacceptable){
  return function(value){
    return !(value in unacceptable);
  }
}

BaseType.prototype.invalid = function(){
  this.add("invalid", this._invalid(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype._with = function(acceptable){
  return function(value, querystring){
    // TODO: make sure keys exists
    
  }
}

BaseType.prototype.with = function(){
  this.add("with", this._width(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype.without = function(){
  this.add("without", Array.prototype.slice.call(arguments));
  return this;
}

module.exports = BaseType;