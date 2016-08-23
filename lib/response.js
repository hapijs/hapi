'use strict';

// Load modules

const Stream = require('stream');
const Boom = require('boom');
const Hoek = require('hoek');
const Podium = require('podium');


// Declare internals

const internals = {};


exports = module.exports = internals.Response = function (source, request, options) {

    Podium.call(this, ['finish', { name: 'peek', spread: true }]);

    options = options || {};

    this.request = request;
    this.statusCode = null;
    this.headers = {};                          // Incomplete as some headers are stored in flags
    this.variety = null;
    this.source = null;
    this.app = {};
    this.plugins = {};
    this.send = null;                           // Set by reply()
    this.hold = null;                           // Set by reply()

    this.settings = {
        encoding: 'utf8',
        charset: 'utf-8',                       // '-' required by IANA
        ttl: null,
        stringify: null,                        // JSON.stringify options
        passThrough: true,
        varyEtag: false,
        message: null
    };

    this._payload = null;                       // Readable stream
    this._takeover = false;
    this._contentEncoding = null;               // Set during transmit
    this._contentType = null;                   // Used if no explicit content-type is set and type is known
    this._error = null;                         // The boom object when created from an error

    this._processors = {
        marshal: options.marshal,
        prepare: options.prepare,
        close: options.close
    };

    this._setSource(source, options.variety);
};

Hoek.inherits(internals.Response, Podium);


internals.Response.wrap = function (result, request) {

    return (result instanceof Error ? Boom.wrap(result)
                                    : (result instanceof internals.Response ? result
                                                                            : new internals.Response(result, request)));
};


internals.Response.prototype._setSource = function (source, variety) {

    // Method must not set any headers or other properties as source can change later

    this.variety = variety || 'plain';

    if (source === null ||
        source === undefined ||
        source === '') {

        source = null;
    }
    else if (Buffer.isBuffer(source)) {
        this.variety = 'buffer';
        this._contentType = 'application/octet-stream';
    }
    else if (source instanceof Stream) {
        this.variety = 'stream';
    }
    else if (typeof source === 'object' &&
        typeof source.then === 'function') {                // Promise object

        this.variety = 'promise';
    }

    this.source = source;

    if (this.variety === 'plain' &&
        this.source !== null) {

        this._contentType = (typeof this.source === 'string' ? 'text/html' : 'application/json');
    }
};


internals.Response.prototype.code = function (statusCode) {

    Hoek.assert(Hoek.isInteger(statusCode), 'Status code must be an integer');

    this.statusCode = statusCode;
    return this;
};


internals.Response.prototype.message = function (httpMessage) {

    this.settings.message = httpMessage;
    return this;
};


internals.Response.prototype.header = function (key, value, options) {

    key = key.toLowerCase();
    if (key === 'vary') {
        return this.vary(value);
    }

    return this._header(key, value, options);
};


internals.Response.prototype._header = function (key, value, options) {

    options = options || {};
    const append = options.append || false;
    const separator = options.separator || ',';
    const override = options.override !== false;
    const duplicate = options.duplicate !== false;

    if ((!append && override) ||
        !this.headers[key]) {

        this.headers[key] = value;
    }
    else if (override) {
        if (key === 'set-cookie') {
            this.headers[key] = [].concat(this.headers[key], value);
        }
        else {
            const existing = this.headers[key];
            if (!duplicate) {
                const values = existing.split(separator);
                for (let i = 0; i < values.length; ++i) {
                    if (values[i] === value) {
                        return this;
                    }
                }
            }

            this.headers[key] = existing + separator + value;
        }
    }

    return this;
};


internals.Response.prototype.vary = function (value) {

    if (value === '*') {
        this.headers.vary = '*';
    }
    else if (!this.headers.vary) {
        this.headers.vary = value;
    }
    else if (this.headers.vary !== '*') {
        this._header('vary', value, { append: true, duplicate: false });
    }

    return this;
};


internals.Response.prototype.etag = function (tag, options) {

    Hoek.assert(tag !== '*', 'ETag cannot be *');

    options = options || {};
    this._header('etag', (options.weak ? 'W/' : '') + '"' + tag + '"');
    this.settings.varyEtag = options.vary !== false && !options.weak;       // vary defaults to true
    return this;
};


internals.Response.unmodified = function (request, options) {

    if (request.method !== 'get' &&
        request.method !== 'head') {

        return false;
    }

    // Strong verifier

    if (options.etag &&
        request.headers['if-none-match']) {

        const ifNoneMatch = request.headers['if-none-match'].split(/\s*,\s*/);
        for (let i = 0; i < ifNoneMatch.length; ++i) {
            const etag = ifNoneMatch[i];
            if (etag === options.etag) {
                return true;
            }

            if (options.vary) {
                const etagBase = options.etag.slice(0, -1);
                const encoders = request.connection._compression.encodings;
                for (let j = 0; j < encoders.length; ++j) {
                    if (etag === etagBase + `-${encoders[j]}"`) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Weak verifier

    const ifModifiedSinceHeader = request.headers['if-modified-since'];

    if (ifModifiedSinceHeader &&
        options.modified) {

        const ifModifiedSince = internals.parseDate(ifModifiedSinceHeader);
        const lastModified = internals.parseDate(options.modified);

        if (ifModifiedSince &&
            lastModified &&
            ifModifiedSince >= lastModified) {

            return true;
        }
    }

    return false;
};


internals.parseDate = function (string) {

    try {
        return Date.parse(string);
    }
    catch (errIgnore) { }
};


internals.Response.prototype.type = function (type) {

    this._header('content-type', type);
    return this;
};


internals.Response.prototype.bytes = function (bytes) {

    this._header('content-length', bytes);
    return this;
};


internals.Response.prototype.location = function (uri) {

    this._header('location', uri);
    return this;
};


internals.Response.prototype.created = function (location) {

    Hoek.assert(this.request.method === 'post' || this.request.method === 'put', 'Cannot create resource on GET');

    this.statusCode = 201;
    this.location(location);
    return this;
};


internals.Response.prototype.replacer = function (method) {

    this.settings.stringify = this.settings.stringify || {};
    this.settings.stringify.replacer = method;
    return this;
};


internals.Response.prototype.spaces = function (count) {

    this.settings.stringify = this.settings.stringify || {};
    this.settings.stringify.space = count;
    return this;
};


internals.Response.prototype.suffix = function (suffix) {

    this.settings.stringify = this.settings.stringify || {};
    this.settings.stringify.suffix = suffix;
    return this;
};


internals.Response.prototype.passThrough = function (enabled) {

    this.settings.passThrough = (enabled !== false);    // Defaults to true
    return this;
};


internals.Response.prototype.redirect = function (location) {

    this.statusCode = 302;
    this.location(location);
    this.temporary = this._temporary;
    this.permanent = this._permanent;
    this.rewritable = this._rewritable;
    return this;
};


internals.Response.prototype._temporary = function (isTemporary) {

    this._setTemporary(isTemporary !== false);           // Defaults to true
    return this;
};


internals.Response.prototype._permanent = function (isPermanent) {

    this._setTemporary(isPermanent === false);           // Defaults to true
    return this;
};


internals.Response.prototype._rewritable = function (isRewritable) {

    this._setRewritable(isRewritable !== false);         // Defaults to true
    return this;
};


internals.Response.prototype._isTemporary = function () {

    return this.statusCode === 302 || this.statusCode === 307;
};


internals.Response.prototype._isRewritable = function () {

    return this.statusCode === 301 || this.statusCode === 302;
};


internals.Response.prototype._setTemporary = function (isTemporary) {

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


internals.Response.prototype._setRewritable = function (isRewritable) {

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


internals.Response.prototype.encoding = function (encoding) {

    this.settings.encoding = encoding;
    return this;
};


internals.Response.prototype.charset = function (charset) {

    this.settings.charset = charset || null;
    return this;
};


internals.Response.prototype.ttl = function (ttl) {

    this.settings.ttl = ttl;
    return this;
};


internals.Response.prototype.state = function (name, value, options) {          // options: see Defaults.state

    this.request._setState(name, value, options);
    return this;
};


internals.Response.prototype.unstate = function (name, options) {

    this.request._clearState(name, options);
    return this;
};


internals.Response.prototype.takeover = function () {

    this._takeover = true;
    return this;
};


internals.Response.prototype._prepare = function (next) {

    this._passThrough();

    if (this.variety !== 'promise') {
        return this._processPrepare(next);
    }

    const onDone = Hoek.nextTick((source) => {

        if (source instanceof Error) {
            return next(Boom.wrap(source));
        }

        if (source instanceof internals.Response) {
            return source._processPrepare(next);
        }

        this._setSource(source);
        this._passThrough();
        this._processPrepare(next);
    });

    const onError = (source) => {

        if (!(source instanceof Error)) {
            const err = new Error('Rejected promise');
            err.data = source;
            return next(Boom.wrap(err));
        }

        return next(Boom.wrap(source));
    };

    this.source.then(onDone, onError);
};


internals.Response.prototype._passThrough = function () {

    if (this.variety === 'stream' &&
        this.settings.passThrough) {

        if (this.source.statusCode &&
            !this.statusCode) {

            this.statusCode = this.source.statusCode;                        // Stream is an HTTP response
        }

        if (this.source.headers) {
            let headerKeys = Object.keys(this.source.headers);

            if (headerKeys.length) {
                const localHeaders = this.headers;
                this.headers = {};

                for (let i = 0; i < headerKeys.length; ++i) {
                    const key = headerKeys[i];
                    this.header(key.toLowerCase(), Hoek.clone(this.source.headers[key]));     // Clone arrays
                }

                headerKeys = Object.keys(localHeaders);
                for (let i = 0; i < headerKeys.length; ++i) {
                    const key = headerKeys[i];
                    this.header(key, localHeaders[key], { append: key === 'set-cookie' });
                }
            }
        }
    }

    this.statusCode = this.statusCode || 200;
};


internals.Response.prototype._processPrepare = function (next) {

    if (!this._processors.prepare) {
        return next(this);
    }

    return this._processors.prepare(this, next);
};


internals.Response.prototype._marshal = function (next) {

    if (!this._processors.marshal) {
        return this._streamify(this.source, next);
    }

    this._processors.marshal(this, (err, source) => {

        if (err) {
            return next(err);
        }

        return this._streamify(source, next);
    });
};


internals.Response.prototype._streamify = function (source, next) {

    if (source instanceof Stream) {
        if (typeof source._read !== 'function' || typeof source._readableState !== 'object') {
            return next(Boom.badImplementation('Stream must have a streams2 readable interface'));
        }

        if (source._readableState.objectMode) {
            return next(Boom.badImplementation('Cannot reply with stream in object mode'));
        }

        this._payload = source;
        return next();
    }

    let payload = source;
    if (this.variety === 'plain' &&
        source !== null &&
        typeof source !== 'string') {

        const options = this.settings.stringify || {};
        const space = options.space || this.request.route.settings.json.space;
        const replacer = options.replacer || this.request.route.settings.json.replacer;
        const suffix = options.suffix || this.request.route.settings.json.suffix || '';
        try {
            if (replacer || space) {
                payload = JSON.stringify(payload, replacer, space);
            }
            else {
                payload = JSON.stringify(payload);
            }
        }
        catch (err) {
            return next(err);
        }

        if (suffix) {
            payload = payload + suffix;
        }
    }
    else if (this.settings.stringify) {
        return next(Boom.badImplementation('Cannot set formatting options on non object response'));
    }

    this._payload = new internals.Payload(payload, this.settings);
    return next();
};


internals.Response.prototype._tap = function () {

    return (this.hasListeners('finish') || this.hasListeners('peek') ? new internals.Peek(this) : null);
};


internals.Response.prototype._close = function () {

    if (this._processors.close) {
        this._processors.close(this);
    }

    const stream = this._payload || this.source;
    if (stream instanceof Stream) {
        if (stream.close) {
            stream.close();
        }
        else if (stream.destroy) {
            stream.destroy();
        }
        else {
            const read = () => {

                stream.read();
            };

            const end = () => {

                stream.removeListener('readable', read);
                stream.removeListener('error', end);
                stream.removeListener('end', end);
            };

            stream.on('readable', read);
            stream.once('error', end);
            stream.once('end', end);
        }
    }
};


internals.Response.prototype._isPayloadSupported = function () {

    return (this.request.method !== 'head' && this.statusCode !== 304 && this.statusCode !== 204);
};


internals.Response.Payload = internals.Payload = function (payload, options) {

    Stream.Readable.call(this);
    this._data = payload;
    this._prefix = null;
    this._suffix = null;
    this._sizeOffset = 0;
    this._encoding = options.encoding;
};

Hoek.inherits(internals.Payload, Stream.Readable);


internals.Payload.prototype._read = function (/* size */) {

    if (this._prefix) {
        this.push(this._prefix, this._encoding);
    }

    if (this._data) {
        this.push(this._data, this._encoding);
    }

    if (this._suffix) {
        this.push(this._suffix, this._encoding);
    }

    this.push(null);
};


internals.Payload.prototype.size = function () {

    if (!this._data) {
        return this._sizeOffset;
    }

    return (Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, this._encoding)) + this._sizeOffset;
};


internals.Payload.prototype.jsonp = function (variable) {

    this._sizeOffset = this._sizeOffset + variable.length + 7;
    this._prefix = '/**/' + variable + '(';                 // '/**/' prefix prevents CVE-2014-4671 security exploit
    this._data = (this._data === null || Buffer.isBuffer(this._data)) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this._suffix = ');';
};


internals.Response.Peek = internals.Peek = function (podium) {

    Stream.Transform.call(this);
    this._podium = podium;
    this.once('finish', () => {

        podium.emit('finish');
    });
};

Hoek.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this._podium.emit('peek', [chunk, encoding]);
    this.push(chunk, encoding);
    callback();
};
