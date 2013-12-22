// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Boom = require('boom');
var Shot = require('shot');
var Negotiator = require('negotiator');
var Headers = require('./headers');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports.Plain = internals.Plain = function (source, variety) {

    this.statusCode = 200;
    this.headers = {};                          // Incomplete as some headers are stored in flags
    this.variety = variety || 'plain';
    this.app = {};
    this.plugins = {};

    this.settings = {
        encoding: 'utf-8',
        charset: 'utf-8',
        location: null,
        ttl: null,
        stringify: null,
        passThrough: true
    };

    this._states = {};
    this._payload = null;                       // Readable stream
    this._preview = new internals.Peek();

    // Default content-type and type-specific method

    if (source === null ||
        source === undefined ||
        source === '') {

        source = null;
    }
    else if (typeof source === 'string') {
        this.type('text/html');
    }
    else if (Buffer.isBuffer(source)) {
        this.type('application/octet-stream');
        this.variety = 'buffer';
    }
    else if (source instanceof Stream) {
        this.variety = 'stream';
        this.passThrough = this._passThrough;
    }
    else {
        this.settings.stringify = {};                     // JSON.stringify options

        this.replacer = this._replacer;
        this.spaces = this._spaces;

        this.type('application/json');
    }

    this.source = source;
};


internals.Plain.prototype.code = function (statusCode) {

    this.statusCode = statusCode;
    return this;
};


internals.Plain.prototype.header = function (key, value, isAppend, sep) {

    key = key.toLowerCase();
    if (key === 'vary') {
        return this.vary(value);
    }

    return this._header(key, value, isAppend, sep);
};


internals.Plain.prototype._header = function (key, value, isAppend, sep) {

    isAppend = isAppend || false;
    sep = sep || ',';

    if (isAppend &&
        this.headers[key]) {

        this.headers[key] = this.headers[key] + sep + value;
    }
    else {
        this.headers[key] = value;
    }

    return this;
};


internals.Plain.prototype.vary = function (value) {

    return this._header('vary', value, true);
};


internals.Plain.prototype.type = function (type) {

    this._header('content-type', type);
    return this;
};


internals.Plain.prototype.bytes = function (bytes) {

    this._header('content-length', bytes);
    return this;
};


internals.Plain.prototype.location = function (uri) {

    this.settings.location = uri;
    return this;
};


internals.Plain.prototype.created = function (location) {

    this.statusCode = 201;
    this.location(location);
    return this;
};


internals.Plain.prototype._replacer = function (method) {

    this.settings.stringify.replacer = method;
    return this;
};


internals.Plain.prototype._spaces = function (count) {

    this.settings.stringify.space = count;
    return this;
};


internals.Plain.prototype._passThrough = function (enabled) {

    this.settings.passThrough = (enabled !== false);    // Defaults to true
    return this;
};


internals.Plain.prototype.redirect = function (location) {

    this.statusCode = 302;
    this.location(location);
    this.temporary = this._temporary;
    this.permanent = this._permanent;
    this.rewritable = this._rewritable;
    return this;
};


internals.Plain.prototype._temporary = function (isTemporary) {

    this._setTemporary(isTemporary !== false);           // Defaults to true
    return this;
};


internals.Plain.prototype._permanent = function (isPermanent) {

    this._setTemporary(isPermanent === false);           // Defaults to true
    return this;
};


internals.Plain.prototype._rewritable = function (isRewritable) {

    this._setRewritable(isRewritable !== false);         // Defaults to true
    return this;
};


internals.Plain.prototype._isTemporary = function () {

    return this.statusCode === 302 || this.statusCode === 307;
};


internals.Plain.prototype._isRewritable = function () {

    return this.statusCode === 301 || this.statusCode === 302;
};


internals.Plain.prototype._setTemporary = function (isTemporary) {

    if (isTemporary) {
        if (this._isRewritable()) {
            this.statusCode = 302;
        }
        else {
            this.statusCode = 307;
        }
    }
    else {
        if (this._isRewritable()) {
            this.statusCode = 301;
        }
        else {
            this.statusCode = 308;
        }
    }
};


internals.Plain.prototype._setRewritable = function (isRewritable) {

    if (isRewritable) {
        if (this._isTemporary()) {
            this.statusCode = 302;
        }
        else {
            this.statusCode = 301;
        }
    }
    else {
        if (this._isTemporary()) {
            this.statusCode = 307;
        }
        else {
            this.statusCode = 308;
        }
    }
};


internals.Plain.prototype.encoding = function (encoding) {

    if (encoding) {
        this.settings.encoding = encoding;
    }
    return this;
};


internals.Plain.prototype.charset = function (charset) {

    if (charset) {
        this.settings.charset = charset;
    }
    return this;
};


internals.Plain.prototype.ttl = function (ttl) {

    this.settings.ttl = ttl;
    return this;
};


internals.Plain.prototype.state = function (name, value, options) {          // options: see Defaults.state

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


internals.Plain.prototype.unstate = function (name) {

    var state = {
        name: name,
        options: {
            ttl: 0
        }
    };

    this._states[name] = state;
    return this;
};


internals.Plain.prototype._marshall = function (request, callback) {

    this._payload = (this.source instanceof Stream ? this.source : new internals.Payload(this.source, request, this.settings));
    return callback();
};


internals.prepare = function (response, request, next) {

    var headers = function () {

        if (request.jsonp &&
            response._payload.jsonp) {

            response.type('text/javascript');
            response._payload.jsonp(request.jsonp);
        }

        if (response._payload.statusCode) {                      // Stream is an HTTP response
            response.statusCode = response._payload.statusCode;
        }

        Headers.apply(response, request, function (err) {

            if (err) {
                return next(err);
            }

            // Apply pass through headers

            if (response._payload.headers &&
                response.settings.passThrough) {

                var localCookies = Utils.clone(response.headers['set-cookie']);
                var localHeaders = response.headers;
                response.headers = Utils.clone(response._payload.headers);
                Utils.merge(response.headers, localHeaders);

                if (localCookies) {
                    var headerKeys = Object.keys(response._payload.headers);
                    for (var i = 0, il = headerKeys.length; i < il; ++i) {

                        if (headerKeys[i].toLowerCase() === 'set-cookie') {
                            delete response.headers[headerKeys[i]];
                            response._header('set-cookie', [].concat(response._payload.headers[headerKeys[i]]).concat(localCookies));
                            break;
                        }
                    }
                }
            }

            return next();
        });
    };

    if (response._payload) {
        return headers();
    }

    response._marshall(request, function (err) {

        if (err) {
            return next(err);
        }

        return headers();
    });
};


exports.send = function (item, request, callback) {

    var prepare = function (response, after) {

        if (response.isBoom) {
            return fail(response);
        }

        internals.prepare(response, request, function (err) {

            if (err) {
                return fail(err);
            }

            return after(response);
        });
    };

    var fail = function (boom) {

        var error = boom.response;
        var response = new internals.Plain(error.payload);
        response._err = boom;
        response.code(error.code);

        Utils.merge(response.headers, error.headers);
        if (error.type) {
            response.type(error.type);
        }

        internals.prepare(response, request, function (err) {

            return send(response);          // Return the original error (which is partially prepared) instead of having to prepare the result error
        });
    };

    var etag = function (response) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return send(response);
        }

        // Process ETag

        var etag = (response.headers && response.headers.etag);
        if (etag &&
            request.headers['if-none-match'] === etag) {

            return unchanged();
        }

        // Process If-Modified-Since headers

        var ifModifiedSinceHeader = request.headers['if-modified-since'];
        var lastModifiedHeader = response.headers && response.headers['last-modified'];

        if (ifModifiedSinceHeader &&
            lastModifiedHeader) {

            var ifModifiedSince = Date.parse(ifModifiedSinceHeader);
            var lastModified = Date.parse(lastModifiedHeader);

            if (ifModifiedSince &&
                lastModified &&
                ifModifiedSince >= lastModified) {

                return unchanged();
            }
        }

        return send(response);
    };

    var unchanged = function () {

        var empty = new internals.Plain();
        empty.code(304);
        return prepare(empty, send);
    };

    var send = function (response) {

        // Injection

        if (response.variety === 'plain' &&
            Shot.isInjection(request.raw.req)) {

            request.raw.res._hapi = { result: response.source };
        }

        internals.transmit(response, request, function () {

            request._response = response;                            // Error occurs late and should update request.response object
            request.log(['hapi', 'response']);
            return callback();
        });
    };

    prepare(item, etag);
};


internals.transmit = function (response, request, callback) {

    var source = response._payload;

    // Content encoding

    var encoder = null;
    if (!response.headers['content-encoding']) {
        var negotiator = new Negotiator(request.raw.req);
        var encoding = negotiator.preferredEncoding(['gzip', 'deflate', 'identity']);
        if (encoding === 'deflate' || encoding === 'gzip') {
            var keys = Object.keys(response.headers);
            for (var i = 0, il = keys.length; i < il; ++i) {
                var key = keys[i];
                if (/content\-length/i.test(key)) {                 // Can be lowercase when coming from proxy
                    delete response.headers[key];
                }
            }

            response._header('content-encoding', encoding);
            response.vary('accept-encoding');

            if (source._hapi &&
                source._hapi.gzipped &&
                encoding === 'gzip') {

                source = source._hapi.gzipped;
            }
            else {
                encoder = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
            }
        }
    }

    var cleanup = (source === response._payload ? (source._hapi && source._hapi.gzipped) : response._payload);
    if (cleanup &&
        cleanup.destroy) {
            
        cleanup.destroy();          // Close file descriptor
    }

    // Write headers

    var headers = Object.keys(response.headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, response.headers[header]);
    }

    request.raw.res.writeHead(response.statusCode);

    // Write payload

    if (request.method === 'head') {
        response._preview.once('finish', function () {

            request.raw.res.end();
            callback();
        });

        response._preview.end();
        return;
    }

    var onAborted = null;
    var previewFinished = false;
    var hasEnded = false;
    var end = function (err, aborted) {

        if (!hasEnded) {
            hasEnded = true;

            if (!aborted) {
                request.raw.res.end();
            }

            var finalize = function () {

                source.removeListener('error', end);

                request.raw.req.removeListener('aborted', onAborted);
                request.raw.req.removeListener('close', end);

                request.raw.res.removeListener('close', end);
                request.raw.res.removeListener('error', end);
                request.raw.res.removeListener('finish', end);

                response._preview.removeAllListeners();

                callback();
            };

            if (previewFinished) {
                return finalize();
            }

            response._preview.once('finish', finalize);
            response._preview.end();
        }
    };

    source.once('error', end);

    onAborted = function () {

        end(null, true);
    };

    request.raw.req.once('aborted', onAborted);
    request.raw.req.once('close', end);

    request.raw.res.once('close', end);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    response._preview.once('finish', function () {

        previewFinished = true;
    });

    var preview = source.pipe(response._preview);
    var encoded = (encoder ? preview.pipe(encoder) : preview);
    encoded.pipe(request.raw.res);
};


// Payload replayer

exports.Payload = internals.Payload = function (payload, request, options) {

    Stream.Readable.call(this);
    this._data = payload || null;
    this._prefix = null;
    this._suffix = null;
    this._sizeOffset = 0;

    if (options && options.stringify) {
        var space = options.stringify.space || request.server.settings.json.space;
        var replacer = options.stringify.replacer || request.server.settings.json.replacer;
        this._data = JSON.stringify(payload, replacer, space);
    }
};

Utils.inherits(internals.Payload, Stream.Readable);


internals.Payload.prototype._read = function (size) {

    this._prefix && this.push(this._prefix);
    this._data && this.push(this._data);
    this._suffix && this.push(this._suffix);
    this.push(null);
};


internals.Payload.prototype.size = function (encoding) {

    if (this._data === null) {
        return this._sizeOffset;
    }

    return (Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, encoding)) + this._sizeOffset;
};


internals.Payload.prototype.jsonp = function (variable) {

    this._sizeOffset += variable.length + 3;
    this._prefix = variable + '(';
    this._data = Buffer.isBuffer(this._data) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this._suffix = ');'
};


// Payload Pipe

internals.Peek = function () {

    Stream.Transform.call(this);
};

Utils.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this.emit('peek', chunk);
    this.push(chunk);
    callback();
};

