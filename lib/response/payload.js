var Stream = require('stream');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Payload = function (payload) {

    Stream.Readable.call(this);
    this._data = payload || '';
    this._prefix = null;
    this._suffix = null;
    this._sizeOffset = 0;
    this._played = false;
};

Utils.inherits(internals.Payload, Stream.Readable);


internals.Payload.prototype._read = function (size) {

    if (!this._played) {
        this._played = true;
        
        this._prefix && this.push(this._prefix);
        this.push(this._data);
        this._suffix && this.push(this._suffix);
    }
    
    this.push(null);
};


internals.Payload.prototype.size = function (encoding) {

    return (Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, encoding || 'utf-8')) + this._sizeOffset;
};


internals.Payload.prototype.jsonp = function (variable) {

    this._sizeOffset += variable.length + 3;
    this._prefix = variable + '(';
    this._data = Buffer.isBuffer(this._data) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this._suffix = ');'
};
