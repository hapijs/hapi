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

    this.variety = 'generic';
    this.varieties = {};
    this.varieties.generic = true;

    this._flags = {};           // Cached
    this._states = {};          // Not cached
    this._wasPrepared = false;

    this._code = 200;
    this._payload = [];
    this._headers = {};

    this._preview = new internals.Peek();

    return this;
};


internals.Generic.prototype._prepare = function (request, callback) {

    var self = this;

    this._wasPrepared = true;
    this._flags.encoding = this._flags.encoding || 'utf-8';

    var length = 0;
    this._payload.forEach(function (chunk) {

        if (Buffer.isBuffer(chunk)) {
            length += chunk.length;
        }
        else {
            length += Buffer.byteLength(chunk, self._flags.encoding);
        }
    });

    if (request.jsonp) {
        this.header('Content-Type', 'text/javascript');
        length += request.jsonp.length + 3;

        var payload = [request.jsonp, '('];
        this._payload.forEach(function (chunk) {

            payload.push(Buffer.isBuffer(chunk) ? chunk : chunk.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));
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

    var prepare = function () {

        if (!self._payload.length ||
            request.method === 'head') {

            return send();
        }

        if (!self._headers['content-encoding']) {
            var negotiator = new Negotiator(request.raw.req);
            var encoding = negotiator.preferredEncoding(['gzip', 'deflate', 'identity']);
            if (['gzip', 'deflate'].indexOf(encoding) !== -1) {
                return compress(encoding);
            }
        }

        return send(self._payload);
    };

    var compress = function (encoding) {

        var compressed = [];
        var compressedLength = 0;

        var encoderStream = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
        encoderStream.on('readable', function () {

            var chunk = encoderStream.read();
            if (chunk) {
                compressed.push(chunk);
                compressedLength += chunk.length;
            }
        });

        encoderStream.once('end', function () {

            encoderStream.removeAllListeners();

            self.header('Content-Encoding', encoding);
            self.header('Vary', 'Accept-Encoding');
            self.header('Content-Length', compressedLength);

            return send(compressed);
        });

        self._payload.forEach(function (chunk) {

            encoderStream.write(chunk, self._flags.encoding);
        });

        encoderStream.end();
    };

    var send = function (payload) {

        request.raw.res.once('error', function (err) {

            callback(err);
        });

        Object.keys(self._headers).forEach(function (header) {

            request.raw.res.setHeader(header, self._headers[header]);
        });

        request.raw.res.writeHead(self._code);

        if (payload &&
            payload.length) {

            payload.forEach(function (chunk) {

                self._preview.write(chunk, self._flags.encoding);
                request.raw.res.write(chunk, self._flags.encoding);
            });
        }

        self._preview.end();
        self._preview.removeAllListeners();

        setImmediate(function () {

            request.raw.res.end();
            callback();
        });
    };

    prepare();
};


internals.Generic.prototype.code = function (statusCode) {

    this._code = statusCode;
    return this;
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


internals.Generic.prototype.encoding = function (encoding) {

    this._flags.encoding = encoding;
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


internals.Peek = function () {

    Stream.Writable.call(this);
    return this;
};

Utils.inherits(internals.Peek, Stream.Writable);


internals.Peek.prototype._write = function (chunk, encoding, callback) {

    this.emit('peek', chunk, encoding);
    callback();
};
