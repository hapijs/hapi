// Load modules

var Async = require('async');
var Negotiator = require('negotiator');
var Zlib = require('zlib');
var Base = require('./base');
var Headers = require('./headers');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


// Generic response  (Base -> Generic)

exports = module.exports = internals.Generic = function () {

    Utils.assert(this.constructor !== internals.Generic, 'Generic must not be instantiated directly');

    Base.call(this);
    this.variety = 'generic';
    this.varieties.generic = true;

    this._code = 200;
    this._payload = [];
    this._headers = {};

    return this;
};

Utils.inherits(internals.Generic, Base);


internals.Generic.prototype.getTtl = function () {

    return this._code === 200 ? this._flags.ttl : 0;
};


internals.Generic.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;
    this._flags.encoding = this._flags.encoding || 'utf-8';

    var length = 0;
    this._payload.forEach(function (chunk) {

        if (Buffer.isBuffer(chunk)) {
            length += chunk.length;
        }
        else {
            length += Buffer.byteLength(chunk, self._flags.encoding);
        }
    });

    if (request.jsonp) {
        this.header('Content-Type', 'text/javascript');
        length += request.jsonp.length + 3;

        var payload = [request.jsonp, '('];
        this._payload.forEach(function (chunk) {

            payload.push(Buffer.isBuffer(chunk) ? chunk : chunk.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));
        });
        payload.push(');');
        this._payload = payload;
    }

    this.header('Content-Length', length);

    if (this._flags.location) {
        this._headers.Location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request);
    Headers.cors(this, request);
    Headers.content(this, request);
    Headers.state(this, request, function (err) {

        if (err) {
            return callback(err);
        }

        return callback(self);
    });
};


internals.Generic.prototype._transmit = function (request, callback) {

    var self = this;

    var prepare = function () {

        if (!self._payload.length ||
            request.method === 'head') {

            return send();
        }

        var availableEncodings = ['gzip', 'deflate', 'identity'];
        var negotiator = new Negotiator(request.raw.req);
        var encoding = negotiator.preferredEncoding(availableEncodings);

        if (['gzip', 'deflate'].indexOf(encoding) !== -1) {
            return compress(encoding);
        }

        return send(self._payload);
    };

    var compress = function (encoding) {

        var encoder = (encoding === 'gzip' ? Zlib.gzip : Zlib.deflate);
        Async.map(self._payload, encoder, function (err, results) {

            var length = 0;
            results.forEach(function (result) {

                length += result.length;
            });

            self.header('Content-Encoding', encoding);
            self.header('Vary', 'Accept-Encoding');
            self.header('Content-Length', length);

            return send(results);
        });
    };

    var send = function (payload) {

        request.raw.res.once('error', function (err) {

            callback(err);
        });

        Object.keys(self._headers).forEach(function (header) {

            request.raw.res.setHeader(header, self._headers[header]);
        });

        request.raw.res.writeHead(self._code);

        if (payload &&
            payload.length) {

            payload.forEach(function (chunk) {

                if (Buffer.isBuffer(chunk)) {
                    request.raw.res.write(chunk);
                }
                else {
                    request.raw.res.write(chunk, self._flags.encoding);
                }
            });
        }

        request.raw.res.end();

        callback();
    };

    prepare();
};


internals.Generic.prototype.header = function (key, value) {

    this._headers[key] = value;
    return this;
};


internals.Generic.prototype.type = function (type) {

    this._headers['Content-Type'] = type;
    return this;
};


internals.Generic.prototype.created = function (uri) {

    this._code = 201;
    this._flags.location = uri;
    return this;
};


internals.Generic.prototype.encoding = function (encoding) {

    this._flags.encoding = encoding;
    return this;
};
