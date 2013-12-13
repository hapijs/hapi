// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Buffer response  (Generic -> Buffer)

exports = module.exports = internals.Buffer = function (buffer) {

    Generic.call(this);
    this.variety = 'buffer';
    this.varieties.buffer = true;
    this.source = buffer;
};

Utils.inherits(internals.Buffer, Generic);


internals.Buffer.prototype._prepare = function (request, callback) {

    this._payload.push(this.source);
    return Generic.prototype._prepare.call(this, request, callback);
};
