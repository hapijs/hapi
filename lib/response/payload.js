// Load modules

var Stream = require('stream');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Payload = function (payload, request, options) {

    Stream.Readable.call(this);
    this._data = (payload === undefined ? null : payload);
    this._prefix = null;
    this._suffix = null;
    this._sizeOffset = 0;
    this._encoding = options.encoding;

    if (options && options.stringify) {
        var space = options.stringify.space || request.server.settings.json.space;
        var replacer = options.stringify.replacer || request.server.settings.json.replacer;
        this._data = JSON.stringify(payload, replacer, space);
    }
};

Utils.inherits(internals.Payload, Stream.Readable);


internals.Payload.prototype._read = function (size) {

    this._prefix && this.push(this._prefix, this._encoding);
    this._data && this.push(this._data, this._encoding);
    this._suffix && this.push(this._suffix, this._encoding);
    this.push(null);
};


internals.Payload.prototype.size = function () {

    if (this._data === null) {
        return this._sizeOffset;
    }

    return (Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, this._encoding)) + this._sizeOffset;
};


internals.Payload.prototype.jsonp = function (variable) {

    this._sizeOffset += variable.length + 3;
    this._prefix = variable + '(';
    this._data = Buffer.isBuffer(this._data) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this._suffix = ');'
};
