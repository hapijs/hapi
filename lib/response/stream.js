// Load modules

var NodeUtil = require('util');
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

NodeUtil.inherits(internals.Stream, Generic);


internals.Stream.prototype._prepare = function (request, callback) {

    return Generic.prototype._prepare.call(this, request, callback);
};


internals.Stream.prototype._transmit = function (request, callback) {

    var self = this;

    // Set headers

    if (this._flags.location) {
        this._headers.Location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request);
    Headers.cors(this, request);

    // Check if stream is a node HTTP response (stream.*) or a (mikeal's) Request object (stream.response.*)

    if (!request._route.proxy ||
        request._route.proxy.settings.passThrough) {     // Pass headers only if not proxy or proxy with pass-through set

        var responseHeaders = this.stream.response ? this.stream.response.headers : this.stream.headers;
        if (responseHeaders) {
            Utils.merge(this._headers, responseHeaders);
        }
    }

    this._code = this.stream.statusCode || ((this.stream.response && this.stream.response.code) ? this.stream.response.code : this._code);

    var rawReq = (request && request.raw && request.raw.req) ? request.raw.req : null;
    var acceptEncoding = rawReq && rawReq.headers ? rawReq.headers['accept-encoding'] : null;
    var isGzip = acceptEncoding && acceptEncoding.indexOf('gzip') !== -1;
    var gzip = null;

    if (isGzip) {
        delete this._headers['Content-Length'];
        this._headers['Content-Encoding'] = 'gzip';
        this._headers.Vary = 'Accept-Encoding';
        gzip = Zlib.createGzip();
    }

    request.raw.res.writeHead(this._code, this._headers);

    var isEnded = false;
    var end = function () {

        if (isEnded) {
            return;
        }

        isEnded = true;
        request.raw.res.end();
        callback();
    };

    request.raw.req.on('close', function () {

        if (self.stream.destroy) {
            self.stream.destroy.bind(self.stream);
        }

        if (gzip) {
            gzip.destroy.bind(gzip);
        }

        end();
    });

    this.stream.on('error', function () {

        request.raw.req.destroy();
        end();
    });

    if (isGzip) {
        gzip.on('end', function () {

            end();
        });

        this.stream.resume();
        this.stream.pipe(gzip).pipe(request.raw.res);
    }
    else {
        this.stream.on('end', function () {

            end();
        });

        this.stream.resume();
        this.stream.pipe(request.raw.res);
    }
};