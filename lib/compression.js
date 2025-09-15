'use strict';

const Zlib = require('zlib');

const Accept = require('@hapi/accept');
const Bounce = require('@hapi/bounce');
const Hoek = require('@hapi/hoek');

const defaultBrotliOptions = {
    params: {
        [Zlib.constants.BROTLI_PARAM_QUALITY]: 4
    }
};

const defaultZstdOptions = {
    params: {
        [Zlib.constants.ZSTD_c_compressionLevel]: 6
    }
};

const internals = {
    common: [
        'gzip, deflate, br, zstd',
        'gzip, deflate, br',
        'zstd',
        'br',
        'gzip, deflate',
        'deflate, gzip',
        'gzip',
        'deflate'
    ],
    provision: new Map([
        ['zstd', [
            (options = {}) => Zlib.createZstdCompress(Hoek.applyToDefaults(defaultZstdOptions, options)),
            (options) => Zlib.createZstdDecompress(options)
        ]],
        ['br', [
            (options = {}) => Zlib.createBrotliCompress(Hoek.applyToDefaults(defaultBrotliOptions, options)),
            (options) => Zlib.createBrotliDecompress(options)
        ]],
        ['deflate', [
            (options) => Zlib.createDeflate(options),
            (options) => Zlib.createInflate(options)
        ]],
        ['gzip', [
            (options) => Zlib.createGzip(options),
            (options) => Zlib.createGunzip(options)
        ]]
    ])
};


exports = module.exports = internals.Compression = class {

    decoders = {};

    encodings = ['identity'];

    encoders = {
        identity: null
    };

    #common = null;
    #options = null;

    constructor(options) {

        this.#options = options;
        if (!this.#options) {
            this._updateCommons();
        }

        for (const [encoding, [encoder, decoder]] of internals.provision.entries()) {
            const conditions = this.#options?.encodings?.[encoding];
            if (conditions) {
                this.addEncoder(encoding, encoder);
                this.addDecoder(encoding, decoder);
            }
        }
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

        if (!this.#options ||
            length !== null && length < this.#options.minBytes) {

            return null;
        }

        const request = response.request;
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

    setPriority(priority) {

        this.encodings = [...new Set([...priority, ...this.encodings])];
        this._updateCommons();
    }
};
