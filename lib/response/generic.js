// Load modules

var NodeUtil = require('util');
var Zlib = require('zlib');
var Base = require('./base');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Generic response  (Base -> Generic)

exports = module.exports = internals.Generic = function () {

    Utils.assert(this.constructor !== internals.Generic, 'Generic must not be instantiated directly');

    Base.call(this);
    this._tag = 'generic';

    this._code = 200;
    this._payload = null;
    this.headers = {};

    return this;
};

NodeUtil.inherits(internals.Generic, Base);


internals.Generic.prototype._transmit = function (request, callback) {

    var self = this;
    var isHeadMethod = request.method === 'head';
    var rawReq = (request && request.raw && request.raw.req) ? request.raw.req : null;
    var acceptEncoding = rawReq && rawReq.headers ? rawReq.headers['accept-encoding'] : null;
    var isGzip = acceptEncoding && acceptEncoding.indexOf('gzip') !== -1;

    var processGzip = function(send) {

        if(!isGzip || isHeadMethod && !self._payload) {
            return send();
        }

        Zlib.gzip(new Buffer(self._payload), function(err, result) {

            if (result) {
                self._payload = result;
                self.header('Content-Encoding', 'gzip');
                self.header('Vary', 'Accept-Encoding');
                self.header('Content-Length', result.length);
            }

            return send();
        });
    };

    processGzip(function() {

        request.raw.res.writeHead(self._code, self.headers);
        request.raw.res.end(!isHeadMethod ? self._payload : '');

        return callback();
    });
};


internals.Generic.prototype.header = function (key, value) {

    this.headers[key] = value;
    return this;
};


internals.Generic.prototype.type = function (type) {

    this.headers['Content-Type'] = type;
    return this;
};


internals.Generic.prototype.bytes = function (bytes) {

    this.headers['Content-Length'] = bytes;
    return this;
};


internals.Generic.prototype.created = function (uri) {

    this._code = 201;
    this.headers['Location'] = uri;
    return this;
};


internals.Generic.prototype.ttl = function (ttl) {

    this.options.ttl = ttl;
    return this;
};