// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Cacheable response  (Base -> Generic -> Cacheable)

exports = module.exports = internals.Cacheable = function (text, type) {

    Utils.assert(this.constructor !== internals.Cacheable, 'Cacheable must not be instantiated directly');

    Generic.call(this);
    this._tag = 'cacheable';

    return this;
};

NodeUtil.inherits(internals.Cacheable, Generic);


internals.Cacheable.prototype.toCache = function () {

    return {
        code: this._code,
        payload: this._payload,
        headers: this._headers,
        flags: this._flags
    };
};


internals.Cacheable.prototype._prepare = function (request, callback) {

    return Generic.prototype._prepare.call(this, request, callback);
};
