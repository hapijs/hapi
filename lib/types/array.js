var util = require("util");
var BaseType = require("./base");

function ArrayType() {

    ArrayType.super_.call(this);
}

util.inherits(ArrayType, BaseType);

ArrayType.prototype.__name = "Array";

ArrayType.prototype.convert = function(value) {

    if (typeof value === "string") {

        var converted = JSON.parse(value);
        if (converted instanceof Array) {

            return converted;
        }
        else {

            throw "Types.ArrayType#convert could not convert (" + value + ") to Array";
        }
    }
    else {

        return value;
    }
}

ArrayType.prototype._base = function() {

    return function(value) {

        return (value == null || value instanceof Array);
    };
}

ArrayType.prototype.base = function() {

    this.add('base', this._base());
    return this;
}

function CreateType() {

    return new ArrayType();
}

module.exports = CreateType;
module.exports.ArrayType = ArrayType;