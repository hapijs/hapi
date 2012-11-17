// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


// Base response

exports = module.exports = internals.Base = function () {

    Utils.assert(this.constructor !== internals.Base, 'Base must not be instantiated directly');
    this._tag = 'base';

    return this;
};

