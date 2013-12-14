// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Stream response (Generic -> Stream)

exports = module.exports = internals.Stream = function (stream) {

    Generic.call(this);
    this.variety = 'stream';
    this.varieties.stream = true;

    this.stream = stream;
    this.gzipped = null;
};

Utils.inherits(internals.Stream, Generic);


internals.Stream.prototype.bytes = function (bytes) {

    this._headers['content-length'] = bytes;
    return this;
};


internals.Stream.prototype._prepare = function (request, callback) {

    this._payload = this.stream;
    return Generic.prototype._prepare.call(this, request, callback);
};
