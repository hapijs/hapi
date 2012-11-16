// Load modules

var NodeUtil = require('util');
var Base = require('./base');


// Declare internals

var internals = {};


// Generic response

exports = module.exports = internals.Generic = function () {

    Base.call(this);
    this._tag = 'generic';

    this.code = 200;
    this.headers = {};
    this.payload = null;
    this.options = {};

    return this;
};

NodeUtil.inherits(internals.Generic, Base);


internals.Generic.prototype._transmit = function (request, callback) {

    request.raw.res.writeHead(this.code, this.headers);
    request.raw.res.end(request.method !== 'head' ? this.payload : '');

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

    this.code = 201;
    this.headers['Location'] = uri;
    return this;
};


internals.Generic.prototype.ttl = function (ttlMsec, isOverride) {      // isOverride defaults to true

    this.ttlMsec = (isOverride === false ? (this.ttlMsec ? this.ttlMsec : ttlMsec) : ttlMsec);
    return this;
};


