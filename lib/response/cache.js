// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cache response

exports = module.exports = internals.Cache = function (item) {

    Generic.call(this);
    this._tag = 'cache';

    this._code = item.code;
    this._payload = item.payload;
    this.headers = item.headers;

    return this;
};

NodeUtil.inherits(internals.Cache, Generic);
