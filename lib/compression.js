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
        gzip: (options) => Zlib.createGzip(options),
        deflate: (options) => Zlib.createDeflate(options)
    };

    this._decoders = {
        gzip: (options) => Zlib.createGunzip(options),
        deflate: (options) => Zlib.createInflate(options)
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

    const header = request.headers['accept-encoding'];
    const accept = Accept.encoding(header, this.encodings);
    if (accept instanceof Error) {
        request.log(['accept-encoding', 'error'], { header, error: accept });
        return 'identity';
    }

    return accept;
};


internals.Compression.prototype.encoding = function (response) {

    const request = response.request;
    if (!request.connection.settings.compression) {
        return null;
    }

    const mime = request.server.mime.type(response.headers['content-type'] || 'application/octet-stream');
    if (!mime.compressible) {
        return null;
    }

    response.vary('accept-encoding');

    if (response.headers['content-encoding']) {
        return null;
    }

    return (request.info.acceptEncoding === 'identity' ? null : request.info.acceptEncoding);
};


internals.Compression.prototype.encoder = function (request, encoding) {

    const encoder = this._encoders[encoding];
    Hoek.assert(encoder !== undefined, `Unknown encoding ${encoding}`);
    return encoder(request.route.settings.compression[encoding]);
};
