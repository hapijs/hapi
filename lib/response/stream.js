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

    this._passThrough = {};
    this._setStream(stream);
};

Utils.inherits(internals.Stream, Generic);


internals.Stream.prototype.bytes = function (bytes) {

    this._headers['Content-Length'] = bytes;
    return this;
};


internals.Stream.prototype._setStream = function (stream) {

    if (!stream) {
        this._stream = null;
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
};


internals.Stream.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

    if (this._flags.location) {
        this._headers.Location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request);
    Headers.cors(this, request);
    Headers.state(this, request, function (err) {

        if (err) {
            return callback(err);
        }

        Headers.auth(self, request, function (err) {

            return callback(err || self);
        });
    });
};


internals.Stream.prototype._transmit = function (request, callback) {

    var self = this;

    // Apply passthrough code and headers

    if (this._passThrough.headers &&
        (!request._route.proxy || request._route.proxy.settings.passThrough)) {

        if (this._passThrough.headers) {
            var localCookies = Utils.clone(this._headers['Set-Cookie']);
            var localHeaders = this._headers;
            this._headers = Utils.clone(this._passThrough.headers);
            Utils.merge(this._headers, localHeaders);

            if (localCookies) {
                var headerKeys = Object.keys(this._passThrough.headers);
                for (var i = 0, il = headerKeys.length; i < il; ++i) {

                    if (headerKeys[i].toLowerCase() === 'set-cookie') {
                        delete this._headers[headerKeys[i]];
                        this._headers['Set-Cookie'] = [].concat(this._passThrough.headers[headerKeys[i]]).concat(localCookies);
                        break;
                    }
                }
            }
        }
    }

    if (this._passThrough.code) {
        this._code = this._passThrough.code;
    }

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

            this._headers['Content-Encoding'] = encoding;
            this._headers.Vary = 'Accept-Encoding';
            encoder = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
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
            self._stream.removeAllListeners();

            if (self._stream.destroy) {
                self._stream.destroy();
            }

            callback();
        }
    };

    this._stream.once('error', end);

    request.raw.req.once('aborted', function () {

        request.raw.req.removeListener('close', end);
        end(true);
    });

    request.raw.req.once('close', end);
    request.raw.res.once('close', end);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    this._stream.pipe(this._preview);
    (encoder ? this._stream.pipe(encoder) : this._stream).pipe(request.raw.res);
};
