// Load modules

var Generic = require('./generic');
var Payload = require('./payload');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cached response (Generic -> Cached)

exports = module.exports = internals.Cached = function (item, ttl) {

    Generic.call(this);
    this.variety = 'cached';
    this.varieties.cached = true;

    this._source = item;
    this._code = item.code;
    this._headers = item.headers;

    Utils.merge(this._flags, item.flags);
    this._flags.ttl = ttl;
};

Utils.inherits(internals.Cached, Generic);


internals.Cached.prototype._prepare = function (request, callback) {

    this._payload = new Payload(this._source.payload);
    return Generic.prototype._prepare.call(this, request, callback);
};
