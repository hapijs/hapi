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

    var length = 0;
    this._payload.forEach(function (chunk) {
        length += Buffer.byteLength(chunk);
    });

    if (request.jsonp) {
        this.header('Content-Type', 'text/javascript');
        length += request.jsonp.length + 3;

        var payload = [request.jsonp, '('];
        this._payload.forEach(function (chunk) {
            payload.push(chunk.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));
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
        
        var acceptEncoding = request.raw.req.headers['accept-encoding'];
        var isGzip = acceptEncoding && acceptEncoding.indexOf('gzip') !== -1;

        if (!isGzip) {
            return send(self._payload);
        }

        Zlib.gzip(new Buffer(self._payload.join('')), function (err, result) {       // Ignoring err since it can only happen if argument is not a Buffer

            self.header('Content-Encoding', 'gzip');
            self.header('Vary', 'Accept-Encoding');
            self.header('Content-Length', result.length);
            return send([result]);
        });
    };

    var send = function (payload) {

        request.raw.res.writeHead(self._code, self._headers);
        
        if (payload &&
            payload.length) {

            payload.forEach(function (chunk) {

                request.raw.res.write(chunk);
            });
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
