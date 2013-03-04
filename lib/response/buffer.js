// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Buffer response  (Base -> Generic -> Buffer)

exports = module.exports = internals.Buffer = function (buffer) {

    Generic.call(this);
    this.variety = 'buffer';
    this.varieties.buffer = true;

    this._payload.push(buffer);

    return this;
};

Utils.inherits(internals.Buffer, Generic);
