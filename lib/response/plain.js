// Load modules

var Crypto = require('crypto');
var Stream = require('stream');
var Events = require('events');
var Hoek = require('hoek');
var Payload = require('./payload');


// Declare internals

var internals = {};


exports = module.exports = internals.Plain = function (source, request, variety) {

    Events.EventEmitter.call(this);

    this.statusCode = 200;
    this.headers = {};                          // Incomplete as some headers are stored in flags
    this.variety = variety || 'plain';
    this.app = {};
    this.plugins = {};

    this.settings = {
        encoding: 'utf8',
        charset: 'utf-8',                       // '-' required by IANA
        location: null,
        ttl: null,
        stringify: null,
        passThrough: true,
        varyEtag: false
    };

    this._request = request;
    this._payload = null;                       // Readable stream
    this._takeover = false;

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

    if (request.method === 'post' ||
        request.method === 'put') {

        this.created = this._created;
    }
};

Hoek.inherits(internals.Plain, Events.EventEmitter);


internals.Plain.prototype.code = function (statusCode) {

    this.statusCode = statusCode;
    return this;
};


internals.Plain.prototype.header = function (key, value, options) {

    key = key.toLowerCase();
    if (key === 'vary') {
        return this.vary(value);
    }

    return this._header(key, value, options);
};


internals.Plain.prototype._header = function (key, value, options) {

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


internals.Plain.prototype.vary = function (value) {

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


internals.Plain.prototype.etag = function (tag, options) {

    options = options || {};
    this._header('etag', (options.weak ? 'W/' : '') + '"' + tag + '"');
    this.settings.varyEtag = !!options.vary && !options.weak;
    return this;
};


internals.Plain.prototype._varyEtag = function () {

    if (this.settings.varyEtag &&
        this.headers.etag &&
        this.headers.vary) {

        var hash = Crypto.createHash('sha1');
        hash.update(this.headers.vary.replace(/\s/g, ''));
        this.headers.etag = '"' + this.headers.etag.slice(1, -1) + '-' + hash.digest('hex') + '"';
    }
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


internals.Plain.prototype._created = function (location) {

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


internals.Plain.prototype._suffix = function (suffix) {

    this.settings.stringify.suffix = suffix;
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

    this.settings.encoding = encoding;
    return this;
};


internals.Plain.prototype.charset = function (charset) {

    this.settings.charset = charset;
    return this;
};


internals.Plain.prototype.ttl = function (ttl) {

    this.settings.ttl = ttl;
    return this;
};


internals.Plain.prototype.state = function (name, value, options) {          // options: see Defaults.state

    this._request._setState(name, value, options);
    return this;
};


internals.Plain.prototype.unstate = function (name) {

    this._request._clearState(name);
    return this;
};


internals.Plain.prototype.takeover = function () {

    this._takeover = true;
    return this;
};


internals.Plain.prototype._marshall = function (request, callback) {

    if (this.source instanceof Stream) {
        this._payload = this.source;
        return callback();
    }

    var payload = this.source;
    if (this.settings.stringify) {
        var space = this.settings.stringify.space || request.server.settings.json.space;
        var replacer = this.settings.stringify.replacer || request.server.settings.json.replacer;
        var suffix = this.settings.stringify.suffix || request.server.settings.json.suffix || '';
        try {
            payload = JSON.stringify(payload, replacer, space);
        }
        catch (err) {
            return callback(err);
        }
    }

    if (suffix) {
        payload += suffix;
    }

    this._payload = new Payload(payload, this.settings);
    return callback();
};


internals.Plain.prototype._tap = function () {

    return (this.listeners('finish').length || this.listeners('peek').length ? new internals.Peek(this) : null);
};


internals.Plain.prototype._close = function () {

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


internals.Plain.prototype._isPayloadSupported = function () {

    return (this._request.method !== 'head' && this.statusCode !== 304 && this.statusCode !== 204);
};


internals.Peek = function (response) {

    Stream.Transform.call(this);
    this._response = response;
    this.once('finish', function () {

        response.emit('finish');
    });
};

Hoek.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this._response.emit('peek', chunk, encoding);
    this.push(chunk, encoding);
    callback();
};
