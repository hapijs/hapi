'use strict';

const Zlib = require('zlib');

const Accept = require('@hapi/accept');
const Bounce = require('@hapi/bounce');
const Hoek = require('@hapi/hoek');


const internals = {
    common: ['gzip, deflate', 'deflate, gzip', 'gzip', 'deflate', 'gzip, deflate, br']
};


exports = module.exports = internals.Compression = class {

    decoders = {
        gzip: (options) => Zlib.createGunzip(options),
        deflate: (options) => Zlib.createInflate(options)
    };

    encodings = ['identity', 'gzip', 'deflate'];

    encoders = {
        identity: null,
        gzip: (options) => Zlib.createGzip(options),
        deflate: (options) => Zlib.createDeflate(options)
    };

    #common = null;

    constructor() {

        this._updateCommons();
    }

    _updateCommons() {

        this.#common = new Map();

        for (const header of internals.common) {
            this.#common.set(header, Accept.encoding(header, this.encodings));
        }
    }

    addEncoder(encoding, encoder) {

        Hoek.assert(this.encoders[encoding] === undefined, `Cannot override existing encoder for ${encoding}`);
        Hoek.assert(typeof encoder === 'function', `Invalid encoder function for ${encoding}`);
        this.encoders[encoding] = encoder;
        this.encodings.unshift(encoding);
        this._updateCommons();
    }

    addDecoder(encoding, decoder) {

        Hoek.assert(this.decoders[encoding] === undefined, `Cannot override existing decoder for ${encoding}`);
        Hoek.assert(typeof decoder === 'function', `Invalid decoder function for ${encoding}`);
        this.decoders[encoding] = decoder;
    }

    accept(request) {

        const header = request.headers['accept-encoding'];
        if (!header) {
            return 'identity';
        }

        const common = this.#common.get(header);
        if (common) {
            return common;
        }

        try {
            return Accept.encoding(header, this.encodings);
        }
        catch (err) {
            Bounce.rethrow(err, 'system');
            err.header = header;
            request._log(['accept-encoding', 'error'], err);
            return 'identity';
        }
    }

    encoding(response, length) {

        if (response.settings.compressed) {
            response.headers['content-encoding'] = response.settings.compressed;
            return null;
        }

        const request = response.request;
        if (!request._core.settings.compression ||
            length !== null && length < request._core.settings.compression.minBytes) {

            return null;
        }

        const mime = request._core.mime.type(response.headers['content-type'] || 'application/octet-stream');
        if (!mime.compressible) {
            return null;
        }

        response.vary('accept-encoding');

        if (response.headers['content-encoding']) {
            return null;
        }

        return request.info.acceptEncoding === 'identity' ? null : request.info.acceptEncoding;
    }

    encoder(request, encoding) {

        const encoder = this.encoders[encoding];
        Hoek.assert(encoder !== undefined, `Unknown encoding ${encoding}`);
        return encoder(request.route.settings.compression[encoding]);
    }
};
