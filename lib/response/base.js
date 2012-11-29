// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


// Base response

exports = module.exports = internals.Base = function () {

    Utils.assert(this.constructor !== internals.Base, 'Base must not be instantiated directly');
    this._tag = 'base';
    this._flags = {};

    return this;
};


internals.Base.prototype.ttl = function (ttl) {

    this._flags.ttl = ttl;
    return this;
};


// Required interface

/*

this._transmit = function (request, callback) {

    callback();
};



*/