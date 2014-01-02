// Load modules

var Stream = require('stream');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Plain = function (source, request, variety) {

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

    this._states = {};
    this._payload = null;                       // Readable stream
    this._preview = new internals.Peek();
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

    if (value === '*') {
        this.headers.vary = '*';
    }
    else if (!this.headers.vary) {
        this.headers.vary = value;
    }
    else if (this.headers.vary !== '*') {
        this._header('vary', value, true);
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


internals.Plain.prototype.takeover = function () {

    this._takeover = true;
    return this;
};


internals.Plain.prototype._marshall = function (request, callback) {

    this._payload = (this.source instanceof Stream ? this.source : new Payload(this.source, request, this.settings));
    return callback();
};


// Payload Pipe

internals.Peek = function () {

    Stream.Transform.call(this);
};

Utils.inherits(internals.Peek, Stream.Transform);


internals.Peek.prototype._transform = function (chunk, encoding, callback) {

    this.emit('peek', chunk);
    this.push(chunk, encoding);
    callback();
};
