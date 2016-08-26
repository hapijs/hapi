'use strict';

// Load modules

const Zlib = require('zlib');
const Accept = require('accept');
const Hoek = require('hoek');
const Joi = require('joi');


// Declare internals

const internals = {};


internals.schema = Joi.object({
    identity: Joi.object().unknown(false).optional()
}).unknown();


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

    this._schema = internals.schema;
};


internals.Compression.prototype.addEncoder = function (encoding, encoder, schema) {

    Hoek.assert(this._encoders[encoding] === undefined, `Cannot override existing encoder for ${encoding}`);
    Hoek.assert(typeof encoder === 'function', `Invalid encoder function for ${encoding}`);
    Hoek.assert(schema === undefined || typeof schema === 'object', `Invalid encoder options schema for ${encoding}`);
    this._encoders[encoding] = encoder;
    this.encodings.push(encoding);

    if (schema) {
        this._schema = this._schema.keys({
            [encoding]: schema
        });
    }
};


internals.Compression.prototype.addDecoder = function (encoding, decoder) {

    Hoek.assert(this._decoders[encoding] === undefined, `Cannot override existing decoder for ${encoding}`);
    Hoek.assert(typeof decoder === 'function', `Invalid decoder function for ${encoding}`);
    this._decoders[encoding] = decoder;
};


internals.Compression.prototype.validate = function (routeSettings, message) {

    const result = Joi.validate(routeSettings.compression, this._schema);
    Hoek.assert(!result.error, `Invalid compression options (${message})`, result.error && result.error.annotate());
    routeSettings.compression = result.value;
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
