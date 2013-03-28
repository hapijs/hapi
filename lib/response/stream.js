// Load modules

var Negotiator = require('negotiator');
var Stream = require('stream');
var Zlib = require('zlib');
var Generic = require('./generic');
var Headers = require('./headers');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Stream response (Base -> Generic -> Stream)

exports = module.exports = internals.Stream = function (stream) {

    Generic.call(this);
    this.variety = 'stream';
    this.varieties.stream = true;

    delete this._payload;

    this.stream = stream;

    return this;
};

Utils.inherits(internals.Stream, Generic);


internals.Stream.prototype.bytes = function (bytes) {

    this._headers['Content-Length'] = bytes;
    return this;
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

        return callback(self);
    });
};


internals.Stream.prototype._transmit = function (request, callback) {

    var self = this;

    // Check if stream is a node HTTP response (stream.*) or a (mikeal's) Request object (stream.response.*)

    if (!request._route.proxy ||
        request._route.proxy.settings.passThrough) {     // Pass headers only if not proxy or proxy with pass-through set

        var responseHeaders = this.stream.response ? this.stream.response.headers : this.stream.headers;
        if (responseHeaders) {
            var localCookies = Utils.clone(this._headers['Set-Cookie']);
            var localHeaders = this._headers;
            this._headers = Utils.clone(responseHeaders);
            Utils.merge(this._headers, localHeaders);
            
            if (localCookies) {
                var headerKeys = Object.keys(responseHeaders);
                for (var i = 0, il = headerKeys.length; i < il; ++i) {
                   
                   if (headerKeys[i].toLowerCase() === 'set-cookie') {
                       delete this._headers[headerKeys[i]];
                       this._headers['Set-Cookie'] = [].concat(responseHeaders[headerKeys[i]]).concat(localCookies);
                       break;
                   }
                };
            }
        }
    }

    this._code = this.stream.statusCode || ((this.stream.response && this.stream.response.code) ? this.stream.response.code : this._code);

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

    var isEnded = false;
    var end = function () {

        if (isEnded) {
            return;
        }

        isEnded = true;
        request.raw.res.end();
        callback();
    };

    request.raw.req.once('close', function () {

        if (self.stream.destroy) {
            self.stream.destroy.bind(self.stream);
        }

        end();
    });

    this.stream.on('error', function () {

        request.raw.req.destroy();
        end();
    });

    if (encoder) {
        encoder.once('end', function () {

            end();
        });

        this.stream.resume();
        this.stream.pipe(encoder).pipe(request.raw.res);
    }
    else {
        this.stream.once('end', function () {

            end();
        });

        this.stream.resume();
        this.stream.pipe(request.raw.res);
    }
};