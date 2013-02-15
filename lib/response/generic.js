// Load modules

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
    var rawPayload = '';

    this._payload.forEach(function (chunk) {
        rawPayload += chunk;
    });

    var length = 0;

    if (request.jsonp) {
        this.header('Content-Type', 'text/javascript');
        length += request.jsonp.length + 3;

        rawPayload = request.jsonp + '(' + rawPayload.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ');';
        this._payload = [rawPayload];
    }

    this._payloadBuffer = new Buffer(rawPayload);
    length += this._payloadBuffer.length;
    this.header('Content-Length', length);

    if (this._flags.location) {
        this._headers.Location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request);
    Headers.cors(this, request);
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
        
        if (!self._payloadBuffer ||
            request.method === 'head') {

            return send();
        }
        
        var acceptEncoding = request.raw.req.headers['accept-encoding'];
        var isGzip = acceptEncoding && acceptEncoding.indexOf('gzip') !== -1;

        if (!isGzip) {
            return send(self._payloadBuffer);
        }

        Zlib.gzip(self._payloadBuffer, function (err, result) {       // Ignoring err since it can only happen if argument is not a Buffer

            self.header('Content-Encoding', 'gzip');
            self.header('Vary', 'Accept-Encoding');
            self.header('Content-Length', result.length);
            return send(result);
        });
    };

    var send = function (payload) {

        request.raw.res.writeHead(self._code, self._headers);
        
        if (payload) {

            request.raw.res.write(payload);
        }

        request.raw.res.end();

        return callback();
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
