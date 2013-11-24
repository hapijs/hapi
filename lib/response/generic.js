// Load modules

var Stream = require('stream');
var Async = require('async');
var Negotiator = require('negotiator');
var Zlib = require('zlib');
var Headers = require('./headers');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


// Generic response  (Generic)

exports = module.exports = internals.Generic = function () {

    Utils.assert(this.constructor !== internals.Generic, 'Generic must not be instantiated directly');

    this.isHapiResponse = true;

    this.variety = 'generic';
    this.varieties = {};
    this.varieties.generic = true;

    this._flags = {};           // Cached
    this._states = {};          // Not cached
    this._wasPrepared = false;

    this._code = 200;
    this._headers = {};

    this._payload = [];
    this._stream = null;
    this._gzipped = null;

    this._preview = new internals.Peek();
};


internals.Generic.prototype.type = function (type) {

    this._headers['content-type'] = type;
    return this;
};


internals.Generic.prototype.created = function (uri) {

    this._code = 201;
    this._flags.location = uri;
    return this;
};


internals.Generic.prototype.encoding = function (encoding) {

    if (encoding) {
        this._flags.encoding = encoding;
    }
    return this;
};


internals.Generic.prototype.charset = function (charset) {

    if (charset) {
        this._flags.charset = charset;
    }
    return this;
};


internals.Generic.prototype.ttl = function (ttl) {

    this._flags.ttl = ttl;
    return this;
};


internals.Generic.prototype.getTtl = function () {

    return this._code === 200 ? this._flags.ttl : 0;
};


internals.Generic.prototype.state = function (name, value, options) {          // options: see Defaults.state

    var state = {
        name: name,
        value: value
    };

    if (options) {
        Utils.assert(!options.autoValue, 'Cannot set autoValue directly in a response');
        state.options = Utils.clone(options);
    }

    this._states[name] = state;
    return this;
};


internals.Generic.prototype.unstate = function (name) {

    var state = {
        name: name,
        options: {
            ttl: 0
        }
    };

    this._states[name] = state;
    return this;
};


internals.Generic.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;

    var length = 0;
    for (var i = 0, il = this._payload.length; i < il; ++i) {
        var chunk = this._payload[i];

        if (Buffer.isBuffer(chunk)) {
            length += chunk.length;
        }
        else {
            length += Buffer.byteLength(chunk, this._flags.encoding || 'utf-8');
        }
    }

    if (request.jsonp) {
        this.header('content-type', 'text/javascript');
        length += request.jsonp.length + 3;

        var payload = [request.jsonp, '('];
        for (i = 0, il = this._payload.length; i < il; ++i) {
            var chunk = this._payload[i];
            payload.push(Buffer.isBuffer(chunk) ? chunk : chunk.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));
        }

        payload.push(');');
        this._payload = payload;
    }

    this.header('content-length', length);

    if (this._flags.location) {
        this._headers.location = Headers.location(this._flags.location, request);
    }

    Headers.cache(this, request);
    Headers.cors(this, request);
    Headers.content(this, request);
    Headers.state(this, request, function (err) {

        if (err) {
            return callback(err);
        }

        Headers.auth(self, request, function (err) {

            return callback(err || self);
        });
    });
};


internals.Generic.prototype._transmit = function (request, callback) {

    var self = this;

    var source = this._stream || new internals.BufferStream(this._payload);

    // Content encoding

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

    // Headers

    var headers = Object.keys(this._headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, self._headers[header]);
    }

    request.raw.res.writeHead(this._code);

    // Payload

    if (request.method === 'head') {
        self._preview.once('finish', function () {

            request.raw.res.end();
            callback();
        });

        self._preview.end();
        return;
    }

    var previewFinished = false;
    var hasEnded = false;
    var end = function (err, aborted) {

        if (!hasEnded) {
            hasEnded = true;

            if (!aborted) {
                request.raw.res.end();
            }

            var finalize = function () {

                request.raw.req.removeListener('close', end);
                request.raw.req.removeListener('aborted', end);
                self._preview.removeAllListeners();
                source.removeAllListeners();

                callback();
            };

            if (previewFinished) {
                return finalize();
            }

            self._preview.once('finish', finalize);
            self._preview.end();
        }
    };

    source.once('error', end);

    request.raw.req.once('close', end);
    request.raw.req.once('aborted', function () {

        end(null, true);
    });

    request.raw.res.once('close', end);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    self._preview.once('finish', function () {

        previewFinished = true;
    });

    var preview = source.pipe(this._preview);
    var encoded = (encoder ? preview.pipe(encoder) : preview);
    encoded.pipe(request.raw.res);
};


internals.Generic.prototype.code = function (statusCode) {

    this._code = statusCode;
    return this;
};


internals.Generic.prototype.header = function (key, value, isAppend, sep) {

    key = key.toLowerCase();
    isAppend = isAppend || false;
    sep = sep || ',';

    if (isAppend &&
        this._headers[key]) {

        this._headers[key] = this._headers[key] + sep + value;
    }
    else {
        this._headers[key] = value;
    }

    return this;
};


internals.Peek = function () {

    Stream.Transform.call(this);
};

Utils.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this.emit('peek', chunk);
    this.push(chunk);
    callback();
};


internals.BufferStream = function (payload) {

    Stream.Readable.call(this);
    this._payload = payload;
};

Utils.inherits(internals.BufferStream, Stream.Readable);


internals.BufferStream.prototype._read = function (size) {

    for (var i = 0, il = this._payload.length; i < il; ++i) {
        this.push(this._payload[i]);
    }

    this.push(null);
};
