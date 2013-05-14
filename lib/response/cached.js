// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cached response (Generic -> Cacheable -> Cached)

exports = module.exports = internals.Cached = function (item, ttl) {

    Generic.call(this);
    this.variety = 'cached';
    this.varieties.cached = true;

    this._code = item.code;
    this._payload = [item.payload];
    this._headers = item.headers;

    Utils.merge(this._flags, item.flags);
    this._flags.ttl = ttl;
};

Utils.inherits(internals.Cached, Generic);
