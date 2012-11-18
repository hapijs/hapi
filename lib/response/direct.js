// Load modules

var NodeUtil = require('util');
var Base = require('./base');
var Headers = require('./headers');


// Declare internals

var internals = {
    decorators: ['code', 'header', 'type', 'bytes', 'created', 'ttl']
};


// Direct response (Base -> Direct)

exports = module.exports = internals.Direct = function (request) {

    Base.call(this);
    this._tag = 'chunked';

    this._request = request;
    this._request.raw.res.statusCode = 200;
    this._isDecorated = true;

    // Decorate

    this.write = internals.write;
    for (var i = 0, il = internals.decorators.length; i < il; ++i) {
        var name = internals.decorators[i];
        this[name] = internals[name];
    }

    return this;
};

NodeUtil.inherits(internals.Direct, Base);


internals.Direct.prototype._undecorate = function () {

    if (!this._isDecorated) {
        return;
    }

    this._isDecorated = false;

    for (var i = 0, il = internals.decorators.length; i < il; ++i) {
        var name = internals.decorators[i];
        delete this[name];
    }
};


internals.Direct.prototype._transmit = function (request, callback) {

    this._undecorate();
    delete this.write;

    this._request.raw.res.end();

    return callback();
};


// Decorators

internals.write = function (chunk, encoding) {

    if (this._isDecorated) {
        Headers.set(this, this._request);        // First write - set Cache, CORS headers
    }

    this._undecorate();

    if (this._request.method !== 'head') {

        this._request.raw.res.write(chunk, encoding);
    }

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


internals.ttl = function (ttl) {

    this.options.ttl = ttl;
    return this;
};

