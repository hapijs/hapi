// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cache response (Base -> Generic -> Cache)

exports = module.exports = internals.Cache = function (item, ttl) {

    Generic.call(this);
    this._tag = 'cache';

    this._code = item.code;
    this._payload = item.payload;
    this.headers = item.headers;
    this.options.ttl = ttl;

    return this;
};

NodeUtil.inherits(internals.Cache, Generic);
