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

    delete this._payload;

    this._stream = null;
    this._gzipped = null;

    this._passThrough = {};
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

    // Check if stream is a node HTTP response

    if (stream.statusCode) {
        this._passThrough.code = stream.statusCode;
    }

    if (stream.headers) {
        this._passThrough.headers = stream.headers;
    }

    // Support pre node v0.10 streams API

    if (stream.pipe === Stream.prototype.pipe) {
        var oldStream = stream;
        oldStream.pause();
        stream = new Stream.Readable().wrap(oldStream);
        oldStream.resume();
    }

    this._stream = stream;
    this._gzipped = gzipped;
};


internals.Stream.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

    if (this._passThrough.code) {
        this._code = this._passThrough.code;
    }

    if (this._flags.location) {
        this._headers.location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request, (self._passThrough.headers && self._passThrough.headers['cache-control']));
    Headers.cors(this, request);
    Headers.state(this, request, function (err) {

        if (err) {
            return callback(err);
        }

        Headers.auth(self, request, function (err) {

            if (!err) {

                // Apply passthrough headers

                if (self._passThrough.headers &&
                    (!request._route.proxy || request._route.proxy.passThrough)) {

                    var localCookies = Utils.clone(self._headers['set-cookie']);
                    var localHeaders = self._headers;
                    self._headers = Utils.clone(self._passThrough.headers);
                    Utils.merge(self._headers, localHeaders);

                    if (localCookies) {
                        var headerKeys = Object.keys(self._passThrough.headers);
                        for (var i = 0, il = headerKeys.length; i < il; ++i) {

                            if (headerKeys[i].toLowerCase() === 'set-cookie') {
                                delete self._headers[headerKeys[i]];
                                self._headers['set-cookie'] = [].concat(self._passThrough.headers[headerKeys[i]]).concat(localCookies);
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


internals.Stream.prototype._transmit = function (request, callback) {

    var self = this;

    var source = this._stream;
    var encoder = null;

    if (!this._headers['content-encoding']) {
        var negotiator = new Negotiator(request.raw.req);
        var encoding = negotiator.preferredEncoding(['gzip', 'deflate', 'identity']);
        if (encoding === 'deflate' || encoding === 'gzip') {
            var keys = Object.keys(this._headers);
            for (var i = 0, il = keys.length; i < il; ++i) {
                var key = keys[i];
                if (/content\-length/i.test(key)) {                 // Can be lowercase when coming from proxy
                    delete self._headers[key];
                }
            }

            this.header('content-encoding', encoding);
            this.header('vary', 'accept-encoding', true);

            if (this._gzipped && encoding === 'gzip') {
                source = this._gzipped;
            }
            else {
                encoder = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
            }
        }
    }

    var headers = Object.keys(this._headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, self._headers[header]);
    }

    request.raw.res.writeHead(this._code);

    var hasEnded = false;
    var end = function (aborted) {

        if (!hasEnded) {
            hasEnded = true;

            if (aborted !== true) {                                 // Can be Error
                request.raw.res.end();
            }

            self._preview.end();
            self._preview.removeAllListeners();
            source.removeAllListeners();

            if (source.destroy) {
                source.destroy();
            }

            callback();
        }
    };

    source.once('error', end);

    request.raw.req.once('aborted', function () {

        request.raw.req.removeListener('close', end);
        end(true);
    });

    request.raw.req.once('close', end);
    request.raw.res.once('close', end);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    source.pipe(this._preview);
    (encoder ? source.pipe(encoder) : source).pipe(request.raw.res);
};