// Load modules

var NodeUtil = require('util');
var Base = require('./base');


// Declare internals

var internals = {};


// Direct response

exports = module.exports = internals.Direct = function (request) {

    Base.call(this);
    this._tag = 'chunked';
    this._request = request;

    return this;
};

NodeUtil.inherits(internals.Direct, Base);


internals.Direct.prototype._transmit = function (request, callback) {

    request.raw.res.writeHead(this.code, this.headers);
    request.raw.res.end(request.method !== 'head' ? this.payload : '');

    return callback();
};


internals.Direct.prototype.header = function (key, value) {

    this.headers[key] = value;
    return this;
};


internals.Direct.prototype.type = function (type) {

    this.headers['Content-Type'] = type;
    return this;
};


internals.Direct.prototype.bytes = function (bytes) {

    this.headers['Content-Length'] = bytes;
    return this;
};


internals.Direct.prototype.created = function (uri) {

    this.code = 201;
    this.headers['Location'] = uri;
    return this;
};


internals.Direct.prototype.ttl = function (ttlMsec, isOverride) {      // isOverride defaults to true

    this.ttlMsec = (isOverride === false ? (this.ttlMsec ? this.ttlMsec : ttlMsec) : ttlMsec);
    return this;
};

