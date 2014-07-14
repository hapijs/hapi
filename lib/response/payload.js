// Load modules

var Stream = require('stream');
var Hoek = require('hoek');


// Declare internals

var internals = {};


exports = module.exports = internals.Payload = function (payload, options) {

    Stream.Readable.call(this);
    this._data = (payload === undefined ? null : payload);
    this._prefix = null;
    this._suffix = null;
    this._sizeOffset = 0;
    this._encoding = options.encoding;
};

Hoek.inherits(internals.Payload, Stream.Readable);


internals.Payload.prototype._read = function (/* size */) {

    if (this._prefix) {
        this.push(this._prefix, this._encoding);
    }

    if (this._data) {
        this.push(this._data, this._encoding);
    }

    if (this._suffix) {
        this.push(this._suffix, this._encoding);
    }

    this.push(null);
};


internals.Payload.prototype.size = function () {

    if (this._data === null) {
        return this._sizeOffset;
    }

    return (Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, this._encoding)) + this._sizeOffset;
};


internals.Payload.prototype.jsonp = function (variable) {

    this._sizeOffset += variable.length + 7;
    this._prefix = '/**/' + variable + '(';                 // '/**/' prefix prevents CVE-2014-4671 security exploit
    this._data = Buffer.isBuffer(this._data) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this._suffix = ');';
};
