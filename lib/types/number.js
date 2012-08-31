var util = require("util");
var BaseType = require("./base");

function NumberType() {

    NumberType.super_.call(this);
}

util.inherits(NumberType, BaseType);

NumberType.prototype.__name = "Number";

NumberType.prototype.convert = function(value) {

    return Number(value);
}

NumberType.prototype._empty = function(){

    return function(value){

        return isNaN(value); //(value === null);
    }
}

NumberType.prototype._base = function() {

    return function(value) {

        return true;
        // return (isNaN(value) || !isNaN(value)); 
    };
}

NumberType.prototype.base = function() {

    this.add('base', this._base(), arguments);
    return this;
}

NumberType.prototype._min = function(n) {

    var self = this;
    return function(value) {

        var cond = (isNaN(value) || value >= n);
        return cond;
    };
}

NumberType.prototype.min = function(n) {

    this.add('min', this._min(n), arguments);
    return this;
}

NumberType.prototype._max = function(n) {

    return function(value) {
        return value <= n;
    };
}

NumberType.prototype.max = function(n) {

    this.add('max', this._max(n), arguments);
    return this;
}

NumberType.prototype._integer = function() {

    return function(value) {
        return (!isNaN(value) && ((value|0) == parseFloat(value)));
    };
}

NumberType.prototype.integer = function() {

    this.add('integer', this._integer(), arguments);
    return this;
}

NumberType.prototype._float = function() {

    var isInt = this._integer();
    return function(value) {

        return !isInt(value);
    };
}

NumberType.prototype.float = function() {

    this.add('float', this._float(), arguments);
    return this;
}

function CreateType() {

    return new NumberType();
}

module.exports = CreateType;
module.exports.NumberType = NumberType;