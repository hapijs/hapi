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

    return this;
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

    // Check if stream is a node HTTP response (stream.*) or a (mikeal's) Request object (stream.response.*)

    if (stream.statusCode ||
        (stream.response && stream.response.statusCode)) {

        this._passThrough.code = stream.statusCode || stream.response.statusCode;
    }

    if (stream.headers ||
        (stream.response && stream.response.headers)) {

        this._passThrough.headers = stream.headers || stream.response.headers;
    }

    // Support pre node v0.10 streams API

    if (stream.pipe === Stream.prototype.pipe) {

        var oldStream = stream;
        oldStream.pause();
        stream = new Stream.Readable().wrap(stream);
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
                };
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
            Object.keys(this._headers).forEach(function (key) {

                if (/content\-length/i.test(key)) {                 // Can be lowercase when coming from proxy
                    delete self._headers[key];
                }
            });

            if (encoding === 'gzip') {
                this._headers['Content-Encoding'] = 'gzip';
                this._headers.Vary = 'Accept-Encoding';
                encoder = Zlib.createGzip();
            }

            if (encoding === 'deflate') {
                this._headers['Content-Encoding'] = 'deflate';
                this._headers.Vary = 'Accept-Encoding';
                encoder = Zlib.createDeflate();
            }
        }
    }

    Object.keys(this._headers).forEach(function (header) {

        request.raw.res.setHeader(header, self._headers[header]);
    });

    request.raw.res.writeHead(this._code);

    var end = function () {

        self._preview.end();
        self._preview.removeAllListeners();

        request.raw.res.end();

        self._stream.removeAllListeners();
        self._stream.destroy && self._stream.destroy();
        callback();
    };

    request.raw.req.once('close', end);
    this._stream.once('error', end);
    (encoder || this._stream).once('end', end);

    this._stream.pipe(this._preview);
    (encoder ? this._stream.pipe(encoder) : this._stream).pipe(request.raw.res, { end: false });
};
