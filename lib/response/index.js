// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Boom = require('boom');
var Shot = require('shot');
var Negotiator = require('negotiator');
var Headers = require('./headers');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {
    maxNestedPreparations: 5
};


exports.Generic = internals.Generic = function (source) {

    this._flags = {};
    this._states = {};

    this._code = 200;
    this._headers = {};
    this._payload = null;                       // Readable stream
    this._preview = new internals.Peek();

    this.isPlain = true;
    this.app = {};
    this.plugins = {};
    
    // Default content-type and type-specific method

    if (source === null ||
        source === undefined ||
        source === '') {

        source = null;
    }
    else if (typeof source === 'string') {
        this._header('content-type', 'text/html');
    }
    else if (Buffer.isBuffer(source)) {
        this._header('content-type', 'application/octet-stream');
        this.isPlain = false;
    }
    else if (source instanceof Stream) {
        this.isPlain = false;
    }
    else {
        this._flags.stringify = {};                     // JSON.stringify options

        this.replacer = this._replacer;
        this.spaces = this._spaces;

        this._header('content-type', 'application/json');
    }

    this.source = source;
};


internals.Generic.prototype.code = function (statusCode) {

    this._code = statusCode;
    return this;
};


internals.Generic.prototype.header = function (key, value, isAppend, sep) {

    key = key.toLowerCase();
    if (key === 'vary') {
        return this.vary(value);
    }

    return this._header(key, value, isAppend, sep);
};


internals.Generic.prototype._header = function (key, value, isAppend, sep) {

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


internals.Generic.prototype.vary = function (value) {

    return this._header('vary', value, true);
};


internals.Generic.prototype.type = function (type) {

    this._header('content-type', type);
    return this;
};


internals.Generic.prototype.bytes = function (bytes) {

    this._header('content-length', bytes);
    return this;
};


internals.Generic.prototype.location = function (uri) {

    this._flags.location = uri;
    return this;
};


internals.Generic.prototype.created = function (location) {

    this._code = 201;
    this.location(location);
    return this;
};


internals.Generic.prototype._replacer = function (method) {

    this._flags.stringify.replacer = method;
    return this;
};


internals.Generic.prototype._spaces = function (count) {

    this._flags.stringify.space = count;
    return this;
};


internals.Generic.prototype.redirect = function (location) {

    this._code = 302;
    this.location(location);
    this.temporary = this._temporary;
    this.permanent = this._permanent;
    this.rewritable = this._rewritable;
    return this;
};


internals.Generic.prototype._temporary = function (isTemporary) {

    this._setTemporary(isTemporary !== false);           // Defaults to true
    return this;
};


internals.Generic.prototype._permanent = function (isPermanent) {

    this._setTemporary(isPermanent === false);           // Defaults to true
    return this;
};


internals.Generic.prototype._rewritable = function (isRewritable) {

    this._setRewritable(isRewritable !== false);         // Defaults to true
    return this;
};


internals.Generic.prototype._isTemporary = function () {

    return this._code === 302 || this._code === 307;
};


internals.Generic.prototype._isRewritable = function () {

    return this._code === 301 || this._code === 302;
};


internals.Generic.prototype._setTemporary = function (isTemporary) {

    if (isTemporary) {
        if (this._isRewritable()) {
            this._code = 302;
        }
        else {
            this._code = 307;
        }
    }
    else {
        if (this._isRewritable()) {
            this._code = 301;
        }
        else {
            this._code = 308;
        }
    }
};


internals.Generic.prototype._setRewritable = function (isRewritable) {

    if (isRewritable) {
        if (this._isTemporary()) {
            this._code = 302;
        }
        else {
            this._code = 301;
        }
    }
    else {
        if (this._isTemporary()) {
            this._code = 307;
        }
        else {
            this._code = 308;
        }
    }
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

    this._payload = this._payload || (this.source instanceof Stream ? this.source : new Payload(this.source, request, this._flags));

    if (request.jsonp &&
        this._payload.jsonp) {

        this._header('content-type', 'text/javascript');
        this._payload.jsonp(request.jsonp);
    }

    if (this._payload.size) {
        this._header('content-length', this._payload.size(this._flags.encoding));
    }

    if (this._payload.statusCode) {                      // Stream is an HTTP response
        this._code = this._payload.statusCode;
    }

    if (this._flags.location) {
        this._header('location', Headers.location(this._flags.location, request));
    }

    Headers.cache(this, request, (this._payload.headers && this._payload.headers['cache-control']));
    Headers.cors(this, request);
    Headers.content(this, request);
    Headers.state(this, request, function (err) {

        if (err) {
            return callback(err);
        }

        Headers.auth(self, request, function (err) {

            if (!err) {

                // Apply pass through headers

                if (self._payload.headers &&
                    (!self._payload._hapi || self._payload._hapi.passThrough !== false)) {

                    var localCookies = Utils.clone(self._headers['set-cookie']);
                    var localHeaders = self._headers;
                    self._headers = Utils.clone(self._payload.headers);
                    Utils.merge(self._headers, localHeaders);

                    if (localCookies) {
                        var headerKeys = Object.keys(self._payload.headers);
                        for (var i = 0, il = headerKeys.length; i < il; ++i) {

                            if (headerKeys[i].toLowerCase() === 'set-cookie') {
                                delete self._headers[headerKeys[i]];
                                self._header('set-cookie', [].concat(self._payload.headers[headerKeys[i]]).concat(localCookies));
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


internals.Peek = function () {

    Stream.Transform.call(this);
};

Utils.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this.emit('peek', chunk);
    this.push(chunk);
    callback();
};


internals.prepare = function (item, request, callback) {

    var prepareCount = 0;

    var prepare = function (response) {

        if (response._payload ||
            response.isBoom) {

            return callback(response);
        }

        response._prepare(request, function (result) {

            if (result._payload ||
                result.isBoom) {

                return callback(result);
            }

            ++prepareCount;
            if (prepareCount > internals.maxNestedPreparations) {    // Prevent prepare loops
                return callback(Boom.badImplementation('Response prepare count exceeded maximum allowed', item));
            }

            return prepare(result);
        });
    };

    prepare(item);
};


exports._respond = function (item, request, callback) {

    var prepare = function (response) {

        if (!response.isBoom) {
            return etag(response);
        }

        // Boom

        var boom = response;
        var error = boom.response;
        response = new internals.Generic(error.payload);
        response._err = boom;
        response.code(error.code);

        Utils.merge(response._headers, error.headers);
        if (error.type) {
            response._header('content-type', error.type);
        }

        response._prepare(request, function (result) {

            if (!result.isBoom) {
                return send(result);
            }

            return send(response);      // Return the original error (which is partially prepared) instead of having to prepare the result error
        });
    };

    var etag = function (response) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return send(response);
        }

        // Process ETag

        var etag = response._headers && response._headers.etag;
        if (etag &&
            request.headers['if-none-match'] === etag) {

            return unchanged();
        }

        // Process If-Modified-Since headers

        var ifModifiedSinceHeader = request.headers['if-modified-since'];
        var lastModifiedHeader = response._headers && response._headers['last-modified'];

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

        var empty = new internals.Generic();
        empty.code(304);
        internals.prepare(empty, request, send);
    };

    var send = function (response) {

        // Injection

        if (response.isPlain &&
            Shot.isInjection(request.raw.req)) {

            request.raw.res._hapi = { result: response.source };
        }

        internals.transmit(response, request, function () {

            request._response = response;                            // Error occurs late and should update request.response object
            request.log(['hapi', 'response']);
            return callback();
        });
    };

    internals.prepare(item, request, prepare);
};


internals.transmit = function (response, request, callback) {

    var source = response._payload;

    // Content encoding

    var encoder = null;
    if (!response._headers['content-encoding']) {
        var negotiator = new Negotiator(request.raw.req);
        var encoding = negotiator.preferredEncoding(['gzip', 'deflate', 'identity']);
        if (encoding === 'deflate' || encoding === 'gzip') {
            var keys = Object.keys(response._headers);
            for (var i = 0, il = keys.length; i < il; ++i) {
                var key = keys[i];
                if (/content\-length/i.test(key)) {                 // Can be lowercase when coming from proxy
                    delete response._headers[key];
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

    // Headers

    var headers = Object.keys(response._headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, response._headers[header]);
    }

    request.raw.res.writeHead(response._code);

    // Payload

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
