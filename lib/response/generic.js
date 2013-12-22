// Load modules

var Stream = require('stream');
var Headers = require('./headers');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Generic response  (Generic)

exports = module.exports = internals.Generic = function (source) {

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
