// Load modules

var Crypto = require('crypto');
var Stream = require('stream');
var Events = require('events');
var Boom = require('boom');
var Hoek = require('hoek');
var Peekaboo = require('peekaboo');


// Declare internals

var internals = {};


exports = module.exports = internals.Response = function (source, request, options) {

    Events.EventEmitter.call(this);

    options = options || {};

    this.statusCode = 200;
    this.headers = {};                          // Incomplete as some headers are stored in flags
    this.variety = options.variety || 'plain';
    this.app = {};
    this.plugins = {};

    this.settings = {
        encoding: 'utf8',
        charset: 'utf-8',                       // '-' required by IANA
        ttl: null,
        stringify: null,
        passThrough: true,
        varyEtag: false
    };

    this.request = request;
    this._payload = null;                       // Readable stream
    this._takeover = false;
    this._prepare = null;                       // Set by the reply interface

    this._processors = {
        marshall: options.marshall,
        prepare: options.prepare
    };

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
        this.passThrough = this._passThrough;               // Expose method

        if (source.statusCode) {                            // Stream is an HTTP response
            this.statusCode = source.statusCode;
        }
    }
    else if (this.variety === 'plain') {
        this.settings.stringify = {};                       // JSON.stringify options

        this.replacer = this._replacer;
        this.spaces = this._spaces;
        this.suffix = this._suffix;

        this.type('application/json');
    }

    this.source = source;
};

Hoek.inherits(internals.Response, Events.EventEmitter);


internals.Response.wrap = function (result, request) {

    return (result instanceof Error ? Boom.wrap(result)
                                    : (result instanceof internals.Response ? result
                                                                           : new internals.Response(result, request)));
};


internals.Response.prototype.code = function (statusCode) {

    Hoek.assert(Hoek.isInteger(statusCode), 'Status code must be an integer');

    this.statusCode = statusCode;
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
    options.append = options.append || false;
    options.separator = options.separator || ',';
    options.override = options.override !== false;

    if ((!options.append && options.override) ||
        !this.headers[key]) {

        this.headers[key] = value;
    }
    else if (options.override) {
        if (key === 'set-cookie') {
            this.headers[key] = [].concat(this.headers[key], value);
        }
        else {
            this.headers[key] = this.headers[key] + options.separator + value;
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
        this._header('vary', value, { append: true });
    }

    return this;
};


internals.Response.prototype.etag = function (tag, options) {

    options = options || {};
    this._header('etag', (options.weak ? 'W/' : '') + '"' + tag + '"');
    this.settings.varyEtag = !!options.vary && !options.weak;
    return this;
};


internals.Response.prototype._varyEtag = function () {

    if (this.settings.varyEtag &&
        this.headers.etag &&
        this.headers.vary) {

        var hash = Crypto.createHash('sha1');
        hash.update(this.headers.vary.replace(/\s/g, ''));
        this.headers.etag = '"' + this.headers.etag.slice(1, -1) + '-' + hash.digest('hex') + '"';
    }
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


internals.Response.prototype._replacer = function (method) {

    this.settings.stringify.replacer = method;
    return this;
};


internals.Response.prototype._spaces = function (count) {

    this.settings.stringify.space = count;
    return this;
};


internals.Response.prototype._suffix = function (suffix) {

    this.settings.stringify.suffix = suffix;
    return this;
};


internals.Response.prototype._passThrough = function (enabled) {

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


internals.Response.prototype._marshall = function (callback) {

    var self = this;

    if (!this._processors.marshall) {
        return this._streamify(this.source, callback);
    }

    this._processors.marshall(this, function (err, source) {

        if (err) {
            return callback(err);
        }

        return self._streamify(source, callback);
    });
};


internals.Response.prototype._streamify = function (source, callback) {

    if (source instanceof Stream) {
        this._payload = source;
        return callback();
    }

    var payload = source;
    if (this.settings.stringify) {
        var space = this.settings.stringify.space || this.request.connection.settings.json.space;
        var replacer = this.settings.stringify.replacer || this.request.connection.settings.json.replacer;
        var suffix = this.settings.stringify.suffix || this.request.connection.settings.json.suffix || '';
        try {
            payload = JSON.stringify(payload, replacer, space);
        }
        catch (err) {
            return callback(err);
        }

        if (suffix) {
            payload += suffix;
        }
    }

    this._payload = new internals.Payload(payload, this.settings);
    return callback();
};


internals.Response.prototype._tap = function () {

    return (this.listeners('finish').length || this.listeners('peek').length ? new Peekaboo(this) : null);
};


internals.Response.prototype._close = function () {

    var stream = this._payload || this.source;
    if (stream instanceof Stream) {
        if (stream.close) {
            stream.close();
        }
        else if (stream.destroy) {
            stream.destroy();
        }
        else {
            var read = function () {

                stream.read();
            };

            var end = function () {

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


internals.Payload = function (payload, options) {

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

    this._sizeOffset += variable.length + 7;
    this._prefix = '/**/' + variable + '(';                 // '/**/' prefix prevents CVE-2014-4671 security exploit
    this._data = Buffer.isBuffer(this._data) ? this._data : this._data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this._suffix = ');';
};
