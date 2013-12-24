// Load modules

var Stream = require('stream');
var Events = require('events');
var Payload = require('./payload');
var Utils = require('../utils');


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
        passThrough: true
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
        this.passThrough = this._passThrough;
    }
    else if (this.variety === 'plain') {
        this.settings.stringify = {};                     // JSON.stringify options

        this.replacer = this._replacer;
        this.spaces = this._spaces;

        this.type('application/json');
    }

    this.source = source;

    if (request.method === 'post' ||
        request.method === 'put') {

        this.created = this._created;
    }
};

Utils.inherits(internals.Plain, Events.EventEmitter);


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
    else if (options.append && options.override) {
        this.headers[key] = this.headers[key] + options.separator + value;
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

    this._payload = (this.source instanceof Stream ? this.source : new Payload(this.source, request, this.settings));
    return callback();
};


internals.Plain.prototype._tap = function () {

    return (this.listeners('finish').length || this.listeners('peek').length ? new internals.Peek(this) : null);
};


internals.Peek = function (response) {

    Stream.Transform.call(this);
    this._response = response;
    this.once('finish', function () {

        response.emit('finish');
    });
};

Utils.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this._response.emit('peek', chunk, encoding);
    this.push(chunk, encoding);
    callback();
};
