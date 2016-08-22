'use strict';

// Load modules

const Zlib = require('zlib');
const Accept = require('accept');
const Hoek = require('hoek');


// Declare internals

const internals = {};


exports = module.exports = internals.Encoder = function () {

    this.types = ['identity', 'gzip', 'deflate'];
    this._compressors = {
        identity: null,
        gzip: Zlib.createGzip,
        deflate: Zlib.createDeflate
    };
};


internals.Encoder.prototype.add = function (encoding, compressor) {

    Hoek.assert(this._compressors[encoding] === undefined, `Cannot override existing encoder for ${encoding}`);
    Hoek.assert(typeof compressor === 'function', `Invalid compressor function for ${encoding}`);
    this._compressors[encoding] = compressor;
    this.types.push(encoding);
};


internals.Encoder.prototype.accept = function (request) {

    return Accept.encoding(request.headers['accept-encoding'], this.types);
};


internals.Encoder.prototype.encoding = function (response) {

    const request = response.request;
    if (!request.connection.settings.compression) {
        return null;
    }

    const mime = request.server.mime.type(response.headers['content-type'] || 'application/octet-stream');
    const encoding = (mime.compressible && !response.headers['content-encoding'] ? request.info.acceptEncoding : null);
    return (encoding === 'identity' ? null : encoding);
};


internals.Encoder.prototype.compressor = function (encoding) {

    const compressor = this._compressors[encoding];
    Hoek.assert(compressor !== undefined, `Unknown encoding ${encoding}`);
    return compressor();
};
