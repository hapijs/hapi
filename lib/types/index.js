/**
 * Module dependencies.
 */
var StringType = require("./string");
var NumberType = require("./number");

/**
 * Types Constructor
 *
 * @api public
 */
function Types(){
  // Load types
  this.String = StringType;
  this.Number = NumberType;
}

module.exports = new Types();