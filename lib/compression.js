'use strict';

// Load modules

const Zlib = require('zlib');
const Accept = require('accept');
const Hoek = require('hoek');


// Declare internals

const internals = {};


exports = module.exports = internals.Compression = function () {

    this.encodings = ['identity', 'gzip', 'deflate'];
    this._encoders = {
        identity: null,
        gzip: Zlib.createGzip,
        deflate: Zlib.createDeflate
    };

    this._decoders = {
        gzip: Zlib.createGunzip,
        deflate: Zlib.createInflate
    };
};


internals.Compression.prototype.addEncoder = function (encoding, encoder) {

    Hoek.assert(this._encoders[encoding] === undefined, `Cannot override existing encoder for ${encoding}`);
    Hoek.assert(typeof encoder === 'function', `Invalid encoder function for ${encoding}`);
    this._encoders[encoding] = encoder;
    this.encodings.push(encoding);
};


internals.Compression.prototype.addDecoder = function (encoding, decoder) {

    Hoek.assert(this._decoders[encoding] === undefined, `Cannot override existing decoder for ${encoding}`);
    Hoek.assert(typeof decoder === 'function', `Invalid decoder function for ${encoding}`);
    this._decoders[encoding] = decoder;
};


internals.Compression.prototype.accept = function (request) {

    return Accept.encoding(request.headers['accept-encoding'], this.encodings);
};


internals.Compression.prototype.encoding = function (response) {

    const request = response.request;
    if (!request.connection.settings.compression) {
        return null;
    }

    const mime = request.server.mime.type(response.headers['content-type'] || 'application/octet-stream');
    const encoding = (mime.compressible && !response.headers['content-encoding'] ? request.info.acceptEncoding : null);
    return (encoding === 'identity' ? null : encoding);
};


internals.Compression.prototype.encoder = function (encoding) {

    const encoder = this._encoders[encoding];
    Hoek.assert(encoder !== undefined, `Unknown encoding ${encoding}`);
    return encoder();
};
