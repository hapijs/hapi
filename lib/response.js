'use strict';

// Load modules

const Stream = require('stream');

const Boom = require('boom');
const Bounce = require('bounce');
const Hoek = require('hoek');
const Podium = require('podium');

const Streams = require('./streams');


// Declare internals

const internals = {
    events: Podium.validate(['finish', { name: 'peek', spread: true }]),
    hopByHop: {
        connection: true,
        'keep-alive': true,
        'proxy-authenticate': true,
        'proxy-authorization': true,
        'te': true,
        'trailers': true,
        'transfer-encoding': true,
        'upgrade': true
    }
};


exports = module.exports = internals.Response = class {

    constructor(source, request, options = {}) {

        this.app = {};
        this.headers = {};                          // Incomplete as some headers are stored in flags
        this.plugins = {};
        this.request = request;
        this.source = null;
        this.statusCode = null;
        this.variety = null;

        this.settings = {
            encoding: 'utf8',
            charset: 'utf-8',                       // '-' required by IANA
            ttl: null,
            stringify: null,                        // JSON.stringify options
            passThrough: true,
            varyEtag: false,
            message: null
        };

        this._events = null;
        this._payload = null;                       // Readable stream
        this._error = null;                         // The boom object when created from an error (used for logging)
        this._contentEncoding = null;               // Set during transmit
        this._contentType = null;                   // Used if no explicit content-type is set and type is known
        this._takeover = false;
        this._statusCode = false;                   // true when code() called

        this._processors = {
            marshal: options.marshal,
            prepare: options.prepare,
            close: options.close
        };

        this.temporary = null;
        this.permanent = null;
        this.rewritable = null;

        this._setSource(source, options.variety);
    }

    static wrap(result, request) {

        if (result instanceof internals.Response) {
            return result;
        }

        if (result instanceof Error) {
            return Boom.boomify(result);
        }

        return new internals.Response(result, request);
    }

    _setSource(source, variety) {

        // Method must not set any headers or other properties as source can change later

        this.variety = variety || 'plain';

        if (source === null ||
            source === undefined) {

            source = null;
        }
        else if (Buffer.isBuffer(source)) {
            this.variety = 'buffer';
            this._contentType = 'application/octet-stream';
        }
        else if (source instanceof Stream) {
            this.variety = 'stream';
        }

        this.source = source;

        if (this.variety === 'plain' &&
            this.source !== null &&
            this.source !== '') {

            this._contentType = (this.source && typeof this.source === 'string' ? 'text/html' : 'application/json');
        }
    }

    get events() {

        if (!this._events) {
            this._events = new Podium(internals.events);
        }

        return this._events;
    }

    code(statusCode) {

        Hoek.assert(Hoek.isInteger(statusCode), 'Status code must be an integer');

        this.statusCode = statusCode;
        this._statusCode = true;

        return this;
    }

    message(httpMessage) {

        this.settings.message = httpMessage;
        return this;
    }

    header(key, value, options) {

        key = key.toLowerCase();
        if (key === 'vary') {
            return this.vary(value);
        }

        return this._header(key, value, options);
    }

    _header(key, value, options = {}) {

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
    }

    vary(value) {

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
    }

    etag(tag, options) {

        const entity = internals.Response.entity(tag, options);
        this._header('etag', entity.etag);
        this.settings.varyEtag = entity.vary;
        return this;
    }

    static entity(tag, options = {}) {

        Hoek.assert(tag !== '*', 'ETag cannot be *');

        return {
            etag: (options.weak ? 'W/' : '') + '"' + tag + '"',
            vary: (options.vary !== false && !options.weak),                    // vary defaults to true
            modified: options.modified
        };
    }

    static unmodified(request, options) {

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
                    const encoders = request._core.compression.encodings;
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
    }

    type(type) {

        this._header('content-type', type);
        return this;
    }

    bytes(bytes) {

        this._header('content-length', bytes);
        return this;
    }

    location(uri) {

        this._header('location', uri);
        return this;
    }

    created(location) {

        Hoek.assert(this.request.method === 'post' || this.request.method === 'put', 'Cannot create resource on GET');

        this.statusCode = 201;
        this.location(location);
        return this;
    }

    replacer(method) {

        this.settings.stringify = this.settings.stringify || {};
        this.settings.stringify.replacer = method;
        return this;
    }

    spaces(count) {

        this.settings.stringify = this.settings.stringify || {};
        this.settings.stringify.space = count;
        return this;
    }

    suffix(suffix) {

        this.settings.stringify = this.settings.stringify || {};
        this.settings.stringify.suffix = suffix;
        return this;
    }

    escape(escape) {

        this.settings.stringify = this.settings.stringify || {};
        this.settings.stringify.escape = escape;
        return this;
    }

    passThrough(enabled) {

        this.settings.passThrough = (enabled !== false);    // Defaults to true
        return this;
    }

    redirect(location) {

        this.statusCode = 302;
        this.location(location);
        this.temporary = this._temporary;
        this.permanent = this._permanent;
        this.rewritable = this._rewritable;
        return this;
    }

    _temporary(isTemporary) {

        this._setTemporary(isTemporary !== false);           // Defaults to true
        return this;
    }

    _permanent(isPermanent) {

        this._setTemporary(isPermanent === false);           // Defaults to true
        return this;
    }

    _rewritable(isRewritable) {

        this._setRewritable(isRewritable !== false);         // Defaults to true
        return this;
    }

    _isTemporary() {

        return this.statusCode === 302 || this.statusCode === 307;
    }

    _isRewritable() {

        return this.statusCode === 301 || this.statusCode === 302;
    }

    _setTemporary(isTemporary) {

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
    }

    _setRewritable(isRewritable) {

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
    }

    encoding(encoding) {

        this.settings.encoding = encoding;
        return this;
    }

    charset(charset) {

        this.settings.charset = charset || null;
        return this;
    }

    ttl(ttl) {

        this.settings.ttl = ttl;
        return this;
    }

    state(name, value, options) {

        this.request._setState(name, value, options);
        return this;
    }

    unstate(name, options) {

        this.request._clearState(name, options);
        return this;
    }

    takeover() {

        this._takeover = true;
        return this;
    }

    _prepare() {

        this._passThrough();

        if (!this._processors.prepare) {
            return this;
        }

        try {
            return this._processors.prepare(this);
        }
        catch (err) {
            throw Boom.boomify(err);
        }
    }

    _passThrough() {

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

                    const connection = this.source.headers.connection;
                    const byHop = {};
                    if (connection) {
                        connection.split(/\s*,\s*/).forEach((header) => {

                            byHop[header] = true;
                        });
                    }

                    for (let i = 0; i < headerKeys.length; ++i) {
                        const key = headerKeys[i];
                        const lower = key.toLowerCase();
                        if (!internals.hopByHop[lower] &&
                            !byHop[lower]) {

                            this.header(lower, Hoek.clone(this.source.headers[key]));     // Clone arrays
                        }
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
    }

    async _marshal() {

        let source = this.source;

        // Processor marshal

        if (this._processors.marshal) {
            try {
                source = await this._processors.marshal(this);
            }
            catch (err) {
                throw Boom.boomify(err);
            }
        }

        // Stream source

        if (source instanceof Stream) {
            if (typeof source._read !== 'function' || typeof source._readableState !== 'object') {
                throw Boom.badImplementation('Stream must have a streams2 readable interface');
            }

            if (source._readableState.objectMode) {
                throw Boom.badImplementation('Cannot reply with stream in object mode');
            }

            this._payload = source;
            return;
        }

        // Plain source (non string or null)

        const jsonify = (this.variety === 'plain' && source !== null && typeof source !== 'string');

        if (!jsonify &&
            this.settings.stringify) {

            throw Boom.badImplementation('Cannot set formatting options on non object response');
        }

        let payload = source;

        if (jsonify) {
            const options = this.settings.stringify || {};
            const space = options.space || this.request.route.settings.json.space;
            const replacer = options.replacer || this.request.route.settings.json.replacer;
            const suffix = options.suffix || this.request.route.settings.json.suffix || '';
            const escape = this.request.route.settings.json.escape || false;

            try {
                if (replacer || space) {
                    payload = JSON.stringify(payload, replacer, space);
                }
                else {
                    payload = JSON.stringify(payload);
                }
            }
            catch (err) {
                throw Boom.boomify(err);
            }

            if (suffix) {
                payload = payload + suffix;
            }

            if (escape) {
                payload = Hoek.escapeJson(payload);
            }
        }

        this._payload = new internals.Response.Payload(payload, this.settings);
    }

    _tap() {

        if (!this._events) {
            return null;
        }

        return (this._events.hasListeners('finish') || this._events.hasListeners('peek') ? new internals.Response.Peek(this._events) : null);
    }

    _close(request) {

        if (this._processors.close) {
            try {
                this._processors.close(this);
            }
            catch (err) {
                Bounce.rethrow(err, 'system');
                request._log(['response', 'cleanup', 'error'], err);
            }
        }

        const stream = this._payload || this.source;
        if (stream instanceof Stream) {
            internals.Response.drain(stream);
        }
    }

    _isPayloadSupported() {

        return (this.request.method !== 'head' && this.statusCode !== 304 && this.statusCode !== 204);
    }

    static drain(stream) {

        if (stream.unpipe) {
            stream.unpipe();
        }

        if (stream.close) {
            stream.close();
        }
        else if (stream.destroy) {
            stream.destroy();
        }
        else {
            Streams.drain(stream);
        }
    }
};


internals.parseDate = function (string) {

    try {
        return Date.parse(string);
    }
    catch (errIgnore) { }
};


internals.Response.Payload = class extends Stream.Readable {

    constructor(payload, options) {

        super();

        this._data = payload;
        this._prefix = null;
        this._suffix = null;
        this._sizeOffset = 0;
        this._encoding = options.encoding;
    }

    _read(size) {

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
    }

    size() {

        if (!this._data) {
            return this._sizeOffset;
        }

        return (Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, this._encoding)) + this._sizeOffset;
    }

    jsonp(variable) {

        this._sizeOffset = this._sizeOffset + variable.length + 7;
        this._prefix = '/**/' + variable + '(';                 // '/**/' prefix prevents CVE-2014-4671 security exploit
        this._data = (this._data === null || Buffer.isBuffer(this._data)) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
        this._suffix = ');';
    }

    writeToStream(stream) {

        if (this._prefix) {
            stream.write(this._prefix, this._encoding);
        }

        if (this._data) {
            stream.write(this._data, this._encoding);
        }

        if (this._suffix) {
            stream.write(this._suffix, this._encoding);
        }

        stream.end();
    }
};


internals.Response.Peek = class extends Stream.Transform {

    constructor(podium) {

        super();

        this._podium = podium;
        this.on('finish', () => podium.emit('finish'));
    }

    _transform(chunk, encoding, callback) {

        this._podium.emit('peek', [chunk, encoding]);
        this.push(chunk, encoding);
        callback();
    }
};
