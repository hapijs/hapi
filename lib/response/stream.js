// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Negotiator = require('negotiator');
var Generic = require('./generic');
var Headers = require('./headers');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Stream response (Generic -> Stream)

exports = module.exports = internals.Stream = function (stream) {

    Generic.call(this);
    this.variety = 'stream';
    this.varieties.stream = true;

    this._setStream(stream);
};

Utils.inherits(internals.Stream, Generic);


internals.Stream.prototype.bytes = function (bytes) {

    this._headers['content-length'] = bytes;
    return this;
};


internals.Stream.prototype._setStream = function (stream, gzipped) {

    if (!stream) {
        this._stream = null;
        this._gzipped = null;
        return;
    }

    this._stream = stream;
    this._gzipped = gzipped;
};


internals.Stream.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

    if (this._stream.statusCode) {                      // Stream is an HTTP response
        this._code = this._stream.statusCode;
    }

    if (this._flags.location) {
        this._headers.location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request, (self._stream.headers && self._stream.headers['cache-control']));
    Headers.cors(this, request);
    Headers.state(this, request, function (err) {

        if (err) {
            return callback(err);
        }

        Headers.auth(self, request, function (err) {

            if (!err) {

                // Apply pass through headers

                if (self._stream.headers &&
                    (!request._route.proxy || request._route.proxy.passThrough)) {

                    var localCookies = Utils.clone(self._headers['set-cookie']);
                    var localHeaders = self._headers;
                    self._headers = Utils.clone(self._stream.headers);
                    Utils.merge(self._headers, localHeaders);

                    if (localCookies) {
                        var headerKeys = Object.keys(self._stream.headers);
                        for (var i = 0, il = headerKeys.length; i < il; ++i) {

                            if (headerKeys[i].toLowerCase() === 'set-cookie') {
                                delete self._headers[headerKeys[i]];
                                self._headers['set-cookie'] = [].concat(self._stream.headers[headerKeys[i]]).concat(localCookies);
                                break;
                            }
                        }
                    }
                }
            }

            return callback(err || self);
        });
    });
};
