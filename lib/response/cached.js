// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cached response (Base -> Generic -> Cacheable -> Cached)

exports = module.exports = internals.Cached = function (item, ttl) {

    Generic.call(this);
    this._tag = 'cache';

    this._code = item.code;
    this._payload = item.payload;
    this._headers = item.headers;

    Utils.merge(this._flags, item.flags);
    this._flags.ttl = ttl;

    return this;
};

NodeUtil.inherits(internals.Cached, Generic);
