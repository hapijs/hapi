/**
 * Module dependencies.
 */
var StringType = require("./string");
var NumberType = require("./number");
var BooleanType = require("./boolean");
var ArrayType = require("./array");
var ObjectType = require("./object");
var FunctionType = require("./function");

/**
 * Types Constructor
 *
 * @api public
 */
function Types(){

    // Load types

    this.String = StringType;
    this.Number = NumberType;
    this.Boolean = BooleanType;
    this.Array = ArrayType;
    this.Object = ObjectType;
    this.Function = FunctionType;
}

Types.prototype.mutatorMethods = {

    rename: 1
}

module.exports = new Types();