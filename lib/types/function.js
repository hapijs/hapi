var util = require("util");
var BaseType = require("./base");

function FunctionType() {

    console.log("WARNING: Using the FunctionType is extremely dangerous.  I hope you know what you are doing.");
    FunctionType.super_.call(this);
}

util.inherits(FunctionType, BaseType);

FunctionType.prototype.__name = "Function";

FunctionType.prototype.convert = function(value) {

    eval("value = " + value);
    return value;
}

FunctionType.prototype._base = function() {

    return function(value) {

        return (value === null || typeof value === "function");
    };
}

FunctionType.prototype.base = function() {

    this.add('base', this._base());
    return this;
}

function CreateType() {

    return new FunctionType();
}

module.exports = CreateType;
module.exports.FunctionType = FunctionType;