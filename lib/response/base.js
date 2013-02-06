// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


// Base response

exports = module.exports = internals.Base = function () {

    Utils.assert(this.constructor !== internals.Base, 'Base must not be instantiated directly');
    this._tag = 'base';
    this._flags = {};           // Cached
    this._states = [];          // Not cached

    return this;
};


internals.Base.prototype.ttl = function (ttl) {

    this._flags.ttl = ttl;
    return this;
};


internals.Base.prototype.getTtl = function () {

    return this._code === 200 ? this._flags.ttl : 0;
};


internals.Base.prototype.state = function (name, value, options) {          // options: see Defaults.state

    var state = {
        name: name,
        value: value
    };

    if (options) {
        state.options = Utils.clone(options);
    }

    this._states.push(state);
    return this;
};


internals.Base.prototype.unstate = function (name) {

    var state = {
        name: name,
        options: {
            ttl: 0
        }
    };

    this._states.push(state);
    return this;
};


// Required interface

/*

this._transmit = function (request, callback) {

    callback();
};

*/