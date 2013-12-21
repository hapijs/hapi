// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Stream response (Generic -> Stream)

exports = module.exports = internals.Stream = function (stream) {

    Generic.call(this);
    this.variety = 'stream';

    this.source = stream;
};

Utils.inherits(internals.Stream, Generic);


internals.Stream.prototype._prepare = function (request, callback) {

    this._payload = this.source;
    return Generic.prototype._prepare.call(this, request, callback);
};
