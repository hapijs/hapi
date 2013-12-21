// Load modules

var Stream = require('stream');
var Headers = require('./headers');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Generic response  (Generic)

exports = module.exports = internals.Generic = function () {

    Utils.assert(this.constructor !== internals.Generic, 'Generic must not be instantiated directly');

    this.isHapiResponse = true;

    this.variety = 'generic';
    this.varieties = {};
    this.varieties.generic = true;

    this._flags = {};
    this._states = {};

    this._code = 200;
    this._headers = {};
    this._payload = null;       // Readable stream

    this._preview = new internals.Peek();
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

    this._headers['content-type'] = type;
    return this;
};


internals.Generic.prototype.created = function (uri) {

    this._code = 201;
    this._flags.location = uri;
    return this;
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


internals.Generic.prototype.getTtl = function () {

    return this._code === 200 ? this._flags.ttl : 0;
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

    if (request.jsonp &&
        this._payload.jsonp) {

        this.header('content-type', 'text/javascript');
        this._payload.jsonp(request.jsonp);
    }

    if (this._payload.size) {
        this.header('content-length', this._payload.size(this._flags.encoding));
    }

    if (this._payload.statusCode) {                      // Stream is an HTTP response
        this._code = this._payload.statusCode;
    }

    if (this._flags.location) {
        this._headers.location = Headers.location(this._flags.location, request);
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
                                self._headers['set-cookie'] = [].concat(self._payload.headers[headerKeys[i]]).concat(localCookies);
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
