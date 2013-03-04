// Load modules

var Base = require('./base');
var Headers = require('./headers');
var Utils = require('../utils');


// Declare internals

var internals = {
    decorators: ['code', 'header', 'type', 'bytes', 'created']
};


// Raw response (Base -> Raw)

exports = module.exports = internals.Raw = function (request) {

    Base.call(this);
    this.variety = 'raw';
    this.varieties.raw = true;

    this._request = request;
    this._request.raw.res.statusCode = 200;
    this._isFlushed = false;

    // Decorate

    for (var i = 0, il = internals.decorators.length; i < il; ++i) {
        var name = internals.decorators[i];
        this[name] = internals[name];
    }

    return this;
};

Utils.inherits(internals.Raw, Base);


internals.Raw.prototype.begin = function (callback) {

    var self = this;

    if (this._isFlushed) {
        return callback();
    }

    this._isFlushed = true;

    // Sent headers

    Headers.cache(this, this._request);
    Headers.cors(this, this._request);
    Headers.state(this, this._request, function (err) {

        if (err) {
            self._request.log(['http', 'response', 'direct', 'state'], err);        // Note the error as the callback error is likely to be ignored
        }

        for (var i = 0, il = internals.decorators.length; i < il; ++i) {
            var name = internals.decorators[i];
            delete self[name];
        }

        delete self.ttl;
        delete self.state;

        self.write = internals.write;
        return callback(err);
    });
};


internals.Raw.prototype._transmit = function (request, callback) {

    var self = this;

    this.begin(function (err) {                 // Flush header if begin() not called. Too late to handle the error (ignored).

        delete self.write;
        self._request.raw.res.end();
        return callback();
    });
};


internals.Raw.prototype.getTtl = function () {

    // Overrides Base

    return this._request.raw.res.statusCode === 200 ? this._flags.ttl : 0;
};


// Decorators

internals.write = function (chunk, encoding) {

    if (this._request.method === 'head') {
        return this;
    }

    this._request.raw.res.write(chunk, encoding);
    return this;
};


internals.code = function (code) {

    this._request.raw.res.statusCode = code;
    return this;
};


internals.header = function (key, value) {

    this._request.raw.res.setHeader(key, value);
    return this;
};


internals.type = function (type) {

    this._request.raw.res.setHeader('Content-Type', type);
    return this;
};


internals.bytes = function (bytes) {

    this._request.raw.res.setHeader('Content-Length', bytes);
    return this;
};


internals.created = function (uri) {

    this.code(201);
    this._request.raw.res.setHeader('Location', Headers.location(uri, this._request));
    return this;
};
