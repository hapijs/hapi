'use strict';

const Stream = require('stream');

const Boom = require('@hapi/boom');
const Bounce = require('@hapi/bounce');
const Hoek = require('@hapi/hoek');
const Podium = require('@hapi/podium');

const Streams = require('./streams');


const internals = {
    events: Podium.validate(['finish', { name: 'peek', spread: true }]),
    hopByHop: {
        connection: true,
        'keep-alive': true,
        'proxy-authenticate': true,
        'proxy-authorization': true,
        'te': true,
        'trailer': true,
        'transfer-encoding': true,
        'upgrade': true
    },
    reserved: ['app', 'headers', 'plugins', 'request', 'source', 'statusCode', 'variety',
        'settings', 'events', 'code', 'message', 'header', 'vary', 'etag', 'type', 'contentType',
        'bytes', 'location', 'created', 'compressed', 'replacer', 'space', 'suffix', 'escape',
        'passThrough', 'redirect', 'temporary', 'permanent', 'rewritable', 'encoding', 'charset',
        'ttl', 'state', 'unstate', 'takeover']
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
            charset: 'utf-8',                       // '-' required by IANA
            compressed: null,
            encoding: 'utf8',
            message: null,
            passThrough: true,
            stringify: null,                        // JSON.stringify options
            ttl: null,
            varyEtag: false
        };

        this._events = null;
        this._payload = null;                       // Readable stream
        this._error = options.error ?? null;        // The boom object when created from an error (used for logging)
        this._contentType = null;                   // Used if no explicit content-type is set and type is known
        this._takeover = false;
        this._statusCode = false;                   // true when code() called
        this._state = this._error ? 'prepare' : 'init'; // One of 'init', 'prepare', 'marshall', 'close'

        this._processors = {
            marshal: options.marshal,
            prepare: options.prepare,
            close: options.close
        };

        this._setSource(source, options.variety);
    }

    static wrap(result, request) {

        if (result instanceof request._core.Response ||
            typeof result === 'symbol') {

            return result;
        }

        if (result instanceof Error) {
            return Boom.boomify(result);
        }

        return new request._core.Response(result, request);
    }

    _setSource(source, variety) {

        // Method must not set any headers or other properties as source can change later

        this.variety = variety ?? 'plain';

        if (source === null ||
            source === undefined) {

            source = null;
        }
        else if (Buffer.isBuffer(source)) {
            this.variety = 'buffer';
            this._contentType = 'application/octet-stream';
        }
        else if (Streams.isStream(source)) {
            this.variety = 'stream';
            this._contentType = 'application/octet-stream';
        }

        this.source = source;

        if (this.variety === 'plain' &&
            this.source !== null) {

            this._contentType = typeof this.source === 'string' ? 'text/html' : 'application/json';
        }
    }

    get events() {

        if (!this._events) {
            this._events = new Podium.Podium(internals.events);
        }

        return this._events;
    }

    code(statusCode) {

        Hoek.assert(Number.isSafeInteger(statusCode), 'Status code must be an integer');

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

        const append = options.append ?? false;
        const separator = options.separator || ',';
        const override = options.override !== false;
        const duplicate = options.duplicate !== false;

        if (!append && override ||
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
                    for (const v of values) {
                        if (v === value) {
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

        const entity = this.request._core.Response.entity(tag, options);
        this._header('etag', entity.etag);
        this.settings.varyEtag = entity.vary;
        return this;
    }

    static entity(tag, options = {}) {

        Hoek.assert(tag !== '*', 'ETag cannot be *');

        return {
            etag: (options.weak ? 'W/' : '') + '"' + tag + '"',
            vary: options.vary !== false && !options.weak,                      // vary defaults to true
            modified: options.modified
        };
    }

    static unmodified(request, entity) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return false;
        }

        // Strong verifier

        if (entity.etag &&
            request.headers['if-none-match']) {

            const ifNoneMatch = request.headers['if-none-match'].split(/\s*,\s*/);
            for (const etag of ifNoneMatch) {

                // Compare tags (https://tools.ietf.org/html/rfc7232#section-2.3.2)

                if (etag === entity.etag) {             // Strong comparison
                    return true;
                }

                if (!entity.vary) {
                    continue;
                }

                if (etag === `W/${entity.etag}`) {      // Weak comparison
                    return etag;
                }

                const etagBase = entity.etag.slice(0, -1);
                const encoders = request._core.compression.encodings;
                for (const encoder of encoders) {
                    if (etag === etagBase + `-${encoder}"`) {
                        return true;
                    }
                }
            }

            return false;
        }

        // Weak verifier

        if (!entity.modified) {
            return false;
        }

        const ifModifiedSinceHeader = request.headers['if-modified-since'];
        if (!ifModifiedSinceHeader) {
            return false;
        }

        const ifModifiedSince = internals.parseDate(ifModifiedSinceHeader);
        if (!ifModifiedSince) {
            return false;
        }

        const lastModified = internals.parseDate(entity.modified);
        if (!lastModified) {
            return false;
        }

        return ifModifiedSince >= lastModified;
    }

    type(type) {

        this._header('content-type', type);
        return this;
    }

    get contentType() {

        let type = this.headers['content-type'];
        if (type) {
            type = type.trim();
            if (this.settings.charset &&
                type.match(/^(?:text\/)|(?:application\/(?:json)|(?:javascript))/) &&
                !type.match(/; *charset=/)) {

                const semi = type[type.length - 1] === ';';
                return type + (semi ? ' ' : '; ') + 'charset=' + this.settings.charset;
            }

            return type;
        }

        if (this._contentType) {
            const charset = this.settings.charset && this._contentType !== 'application/octet-stream' ? '; charset=' + this.settings.charset : '';
            return this._contentType + charset;
        }

        return null;
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

        Hoek.assert(this.request.method === 'post' ||
            this.request.method === 'put' ||
            this.request.method === 'patch', 'Cannot return 201 status codes for ' + this.request.method.toUpperCase());

        this.statusCode = 201;
        this.location(location);
        return this;
    }

    compressed(encoding) {

        Hoek.assert(encoding && typeof encoding === 'string', 'Invalid content-encoding');
        this.settings.compressed = encoding;
        return this;
    }

    replacer(method) {

        this.settings.stringify = this.settings.stringify ?? {};
        this.settings.stringify.replacer = method;
        return this;
    }

    spaces(count) {

        this.settings.stringify = this.settings.stringify ?? {};
        this.settings.stringify.space = count;
        return this;
    }

    suffix(suffix) {

        this.settings.stringify = this.settings.stringify ?? {};
        this.settings.stringify.suffix = suffix;
        return this;
    }

    escape(escape) {

        this.settings.stringify = this.settings.stringify ?? {};
        this.settings.stringify.escape = escape;
        return this;
    }

    passThrough(enabled) {

        this.settings.passThrough = enabled !== false;      // Defaults to true
        return this;
    }

    redirect(location) {

        this.statusCode = 302;
        this.location(location);
        return this;
    }

    temporary(isTemporary) {

        Hoek.assert(this.headers.location, 'Cannot set redirection mode without first setting a location');

        this._setTemporary(isTemporary !== false);           // Defaults to true
        return this;
    }

    permanent(isPermanent) {

        Hoek.assert(this.headers.location, 'Cannot set redirection mode without first setting a location');

        this._setTemporary(isPermanent === false);           // Defaults to true
        return this;
    }

    rewritable(isRewritable) {

        Hoek.assert(this.headers.location, 'Cannot set redirection mode without first setting a location');

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

        this.settings.charset = charset ?? null;
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

        Hoek.assert(this._state === 'init');

        this._state = 'prepare';

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

                    for (const key of headerKeys) {
                        const lower = key.toLowerCase();
                        if (!internals.hopByHop[lower] &&
                            !byHop[lower]) {

                            this.header(lower, Hoek.clone(this.source.headers[key]));     // Clone arrays
                        }
                    }

                    headerKeys = Object.keys(localHeaders);
                    for (const key of headerKeys) {
                        this.header(key, localHeaders[key], { append: key === 'set-cookie' });
                    }
                }
            }
        }

        this.statusCode = this.statusCode ?? 200;
    }

    async _marshal() {

        Hoek.assert(this._state === 'prepare');

        this._state = 'marshall';

        // Processor marshal

        let source = this.source;

        if (this._processors.marshal) {
            try {
                source = await this._processors.marshal(this);
            }
            catch (err) {
                throw Boom.boomify(err);
            }
        }

        // Stream source

        if (Streams.isStream(source)) {
            this._payload = source;
            return;
        }

        // Plain source (non string or null)

        const jsonify = this.variety === 'plain' && source !== null && typeof source !== 'string';

        if (!jsonify &&
            this.settings.stringify) {

            throw Boom.badImplementation('Cannot set formatting options on non object response');
        }

        let payload = source;

        if (jsonify) {
            const options = this.settings.stringify ?? {};
            const space = options.space ?? this.request.route.settings.json.space;
            const replacer = options.replacer ?? this.request.route.settings.json.replacer;
            const suffix = options.suffix ?? this.request.route.settings.json.suffix ?? '';
            const escape = this.request.route.settings.json.escape;

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

        if (this._events.hasListeners('peek') ||
            this._events.hasListeners('finish')) {

            return new internals.Response.Peek(this._events);
        }

        return null;
    }

    _close() {

        if (this._state === 'close') {
            return;
        }

        this._state = 'close';

        if (this._processors.close) {
            try {
                this._processors.close(this);
            }
            catch (err) {
                Bounce.rethrow(err, 'system');
                this.request._log(['response', 'cleanup', 'error'], err);
            }
        }

        const stream = this._payload || this.source;
        if (Streams.isStream(stream)) {
            internals.Response.drain(stream);
        }
    }

    _isPayloadSupported() {

        return this.request.method !== 'head' && this.statusCode !== 304 && this.statusCode !== 204;
    }

    static drain(stream) {

        stream.destroy();
    }
};


internals.Response.reserved = internals.reserved;


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
        this._encoding = options.encoding;
    }

    _read(size) {

        if (this._data) {
            this.push(this._data, this._encoding);
        }

        this.push(null);
    }

    size() {

        if (!this._data) {
            return 0;
        }

        return Buffer.isBuffer(this._data) ? this._data.length : Buffer.byteLength(this._data, this._encoding);
    }

    writeToStream(stream) {

        if (this._data) {
            stream.write(this._data, this._encoding);
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
