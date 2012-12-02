// Load modules

var NodeUtil = require('util');
var Zlib = require('zlib');
var Base = require('./base');
var Headers = require('./headers');
var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


// Generic response  (Base -> Generic)

exports = module.exports = internals.Generic = function () {

    Utils.assert(this.constructor !== internals.Generic, 'Generic must not be instantiated directly');

    Base.call(this);
    this._tag = 'generic';

    this._code = 200;
    this._payload = null;
    this._headers = {};

    return this;
};

NodeUtil.inherits(internals.Generic, Base);


internals.Generic.prototype._transmit = function (request, callback) {

    var self = this;
    var isHeadMethod = request.method === 'head';

    var processGzip = function () {

        if (!self._payload || isHeadMethod) {
            return send();
        }

        var rawReq = (request && request.raw && request.raw.req) ? request.raw.req : null;
        var acceptEncoding = rawReq && rawReq.headers ? rawReq.headers['accept-encoding'] : null;
        var isGzip = acceptEncoding && acceptEncoding.indexOf('gzip') !== -1;

        if (!isGzip) {
            return send();
        }

        Zlib.gzip(new Buffer(self._payload), function (err, result) {       // Ignoring err since it can only happen if argument is not a Buffer

            self._payload = result;
            self.header('Content-Encoding', 'gzip');
            self.header('Vary', 'Accept-Encoding');
            self.header('Content-Length', result.length);
            return send();
        });
    };

    var send = function () {

        if (self._flags.location) {
            self._headers.Location = Headers.location(self._flags.location, request);
        }

        Headers.cache(self, request);
        Headers.cors(self, request);

        request.raw.res.writeHead(self._code, self._headers);
        request.raw.res.end(!isHeadMethod ? self._payload : '');

        return callback();
    };

    processGzip();
};


internals.Generic.prototype.header = function (key, value) {

    this._headers[key] = value;
    return this;
};


internals.Generic.prototype.type = function (type) {

    this._headers['Content-Type'] = type;
    return this;
};


internals.Generic.prototype.bytes = function (bytes) {

    this._headers['Content-Length'] = bytes;
    return this;
};


internals.Generic.prototype.created = function (uri) {

    this._code = 201;
    this._flags.location = uri;
    return this;
};
