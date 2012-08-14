/**
 * Module dependencies.
 */

var StringType = require("./string");


/**
 * Types Constructor
 *
 * @api public
 */
function Types(){
  // Load types
  this.String = new StringType();
}

module.exports = new Types();