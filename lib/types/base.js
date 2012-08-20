/**
 * Module dependencies.
 */
var Utils = require("../utils");

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
var BaseType = function() {
  this[INTERNAL_DATA_KEY] = [];
  this[INTERNAL_KEY_LIST] = [];
  
  if (typeof this.base !== "undefined" && this.base !== null) {
    this.base();
  }
  
  if (typeof this.__name !== "undefined" && this.__name !== null) {
    this["type"] = this.__name;
  }
}

BaseType.prototype.valueOf = function() {
  return this[INTERNAL_DATA_KEY];
}
BaseType.prototype.toString = function() {
  return JSON.stringify(this.valueOf());
}

BaseType.prototype.add = function(key, value) {
  if (typeof key == "undefined" || key == null) {
    throw "(type).add must given a key";
  }
  
  if (typeof value !== "undefined" && value !== null) {
    // TODO: add check for invalid keys
    
    this[INTERNAL_DATA_KEY].push(value);
    this[INTERNAL_KEY_LIST].push(key)
  }
  
  return this[INTERNAL_DATA_KEY];
}

var exists = function(n) {
  return (typeof n !== "undefined" && n !== null);
}

BaseType.prototype._required = function(required) {
  if (required == null) {
    required = true;
  }
  return function(value) {
    // return (required == exists(value))
    return !(required == true && !exists(value))
  }
}

BaseType.prototype.required = function(required) {
  // this.add("required", function(value) { return (required == exists(value)); });
  this.add("required", this._required(required));
  return this;
}

// BaseType.prototype.optional = function() {
//   this.required(false);
//   return this;
// }

BaseType.prototype._valid = function(acceptable) {
  return function(value) {
    return value in acceptable;
  }
}

BaseType.prototype.valid = function() {
  this.add("valid", this._valid(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype._invalid = function(unacceptable) {
  return function(value) {
    return !(value in unacceptable);
  }
}

BaseType.prototype.invalid = function() {
  this.add("invalid", this._invalid(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype._with = function(peers) {
  return function(value, qstr) {
    // TODO: make sure keys exists
    for(var i in peers) {
      if (!qstr.hasOwnProperty(peers[i])) {
        return false;
      }
    }
    return true;
  }
}

BaseType.prototype.with = function() {
  this.add("with", this._with(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype._without = function(peers) {
  return function(value, qstr) {
    return !this._with(peers)(value, qstr);
  }
}

BaseType.prototype.without = function() {
  this.add("without", this._without(Array.prototype.slice.call(arguments)));
  return this;
}

BaseType.prototype._renameDefaultOptions = {
  deleteOrig: false,
  allowMult: false,
  allowOverwrite: false
}

BaseType.prototype._rename = function(to, options) {
  var self = this;
  self.renamed = self.renamed || {}
  
  options = Utils.merge(Utils.clone(this._renameDefaultOptions), options);
  
  return function(value, qstr, key) {
    if (options.allowMult === false && to in self.renamed) {
      return false;
    }
    
    if (options.allowOverwrite === false && qstr.hasOwnProperty(to)) {
      return false;
    }
    
    qstr[to] = value;
    
    if (options.deleteOrig === true) {
      delete qstr[key];
    }
    
    if (options.allowMult === false) {
      self.renamed[to] = self.renamed[to]++ || 1;
    }
    
    key = to;
    
    return true;
  }
}

BaseType.prototype.rename = function(to, options) {
  this.add("rename", this._rename(to, options));
  return this;
}

module.exports = BaseType;