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

    required = (required == null) ? true : required;
    return function(value) {

        return !(required == true && !exists(value))
    }
}

BaseType.prototype.required = function(required) {

    this.add("required", this._required(required));
    return this;
}

BaseType.prototype._empty = function(){

    return function(value){

        return (value === null);
    }
}

BaseType.prototype.empty = function(){

    this.add("empty", this._empty());
    return this;
}

// BaseType.prototype.optional = function() {
//   this.required(false);
//   return this;
// }

BaseType.prototype._valid = function(acceptable) {

    return function(value) {

        var isValid = false;
        for(var i in acceptable){

            if (value === acceptable[i]) {

                isValid = true;
            }
        }
        return isValid;
    }
}

BaseType.prototype.valid = function() {

    this.add("valid", this._valid(Array.prototype.slice.call(arguments)));
    return this;
}

BaseType.prototype._invalid = function(unacceptable) {

    var self = this;
    return function(value) {

        return !self._valid(unacceptable)(value);
    }
}

BaseType.prototype.invalid = function() {

    this.add("invalid", this._invalid(Array.prototype.slice.call(arguments)));
    return this;
}

BaseType.prototype._with = function(peers) {

    return function(value, qstr, key) {

    // return function(value, qstr) {

        // TODO: make sure keys exists
        for(var i in peers) {

            if (!qstr.hasOwnProperty(peers[i]) || peers[i] === null) {

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

    var self = this;
    return function(value, qstr) {

        return !self._with(peers)(value, qstr);
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
    
    options = Utils.merge(Utils.clone(this._renameDefaultOptions), options);
    
    return function(value, qstr, key, req) {

        req = req || {};
        var renamed = req._renamed || {};

        if (options.allowMult === false && to in renamed) {

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

            renamed[to] = renamed[to]++ || 1;
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