// Load modules

var NodeUtil = require('util');
var Base = require('./base');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Generic response

exports = module.exports = internals.Generic = function () {

    Utils.assert(this.constructor !== internals.Generic, 'Generic must not be instantiated directly');

    Base.call(this);
    this._tag = 'generic';

    this._code = 200;
    this._payload = null;
    this.headers = {};

    return this;
};

NodeUtil.inherits(internals.Generic, Base);


internals.Generic.prototype._transmit = function (request, callback) {

    request.raw.res.writeHead(this._code, this.headers);
    request.raw.res.end(request.method !== 'head' ? this._payload : '');

    return callback();
};


internals.Generic.prototype.header = function (key, value) {

    this.headers[key] = value;
    return this;
};


internals.Generic.prototype.type = function (type) {

    this.headers['Content-Type'] = type;
    return this;
};


internals.Generic.prototype.bytes = function (bytes) {

    this.headers['Content-Length'] = bytes;
    return this;
};


internals.Generic.prototype.created = function (uri) {

    this._code = 201;
    this.headers['Location'] = uri;
    return this;
};


internals.Generic.prototype.ttl = function (ttl, isOverride) {      // isOverride defaults to true

    this._ttl = (isOverride === false ? (this._ttl ? this._ttl : ttl) : ttl);
    return this;
};
