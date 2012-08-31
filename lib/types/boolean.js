var util = require("util");
var BaseType = require("./base");

function BooleanType() {

    BooleanType.super_.call(this);
}

util.inherits(BooleanType, BaseType);

BooleanType.prototype.__name = "Boolean";

BooleanType.prototype.convert = function(value) {

    if (typeof value !== "undefined" && value !== null) {

        switch (value.toLowerCase()) {

            case "true":
                return true;
                break;

            case "false":
            default:
                return false;
                break;
        }
    }
    else {

        return false;
    }
}

BooleanType.prototype._base = function() {

    return function(value) {

        return (value == null || typeof value == "boolean");
    };
}

BooleanType.prototype.base = function() {

    this.add('base', this._base(), arguments);
    return this;
}

function CreateType() {

    return new BooleanType();
}

module.exports = CreateType;
module.exports.BooleanType = BooleanType;