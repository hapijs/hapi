var util = require("util");
var BaseType = require("./base");
var Email = require("./email");

function StringType() {

    StringType.super_.call(this);
}

util.inherits(StringType, BaseType);

StringType.prototype.__name = "String";

StringType.prototype._base = function() {

    return function(value) {

        return (value == null || typeof value == "string"); 
    };
}

StringType.prototype.base = function() {

    this.add("base", this._base(), arguments);
    return this;
}

StringType.prototype._min = function(n) {

    return function(value) {

        return value.length >= n;
    };
}

StringType.prototype.min = function(n) {

    this.add("min", this._min(n), arguments);
    return this;
}

StringType.prototype._max = function(n) {

    return function(value) {

        return value.length <= n;
    };
}

StringType.prototype.max = function(n) {

    this.add("max", this._max(n), arguments);
    return this;
}

StringType.prototype._regex = function(n) {

    return function(value) {

        return (value.match(n) !== null);
    };
}

StringType.prototype.regex = function(pattern) {

    this.add('regex', this._regex(pattern), arguments);
    return this;
}


StringType.prototype._date = function(){

  return function(value){

    value = (isNaN(Number(value)) === false)?+value:value;
    var converted = new Date(value);
    return (!isNaN(converted.getTime()));
  }
}

StringType.prototype.date = function(){

  this.add('date', this._date.apply(arguments), arguments);
  return this;
}

StringType.prototype.alphanum = function(spacesEnabled) {

    spacesEnabled = (spacesEnabled === null) ? true : spacesEnabled;
    if (spacesEnabled === true) {

        var pattern = /^[\w\s]+$/;
    }
    else {

        var pattern = /^[a-zA-Z0-9]+$/;
    }
    
    this.regex(pattern);
    return this;
}

StringType.prototype.email = function() {

    this.regex(Email._regex);
    return this;
}

function CreateStringType() {

    return new StringType();
}

module.exports = CreateStringType;
module.exports.StringType = StringType;