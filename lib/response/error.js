// Load modules

var NodeUtil = require('util');
var Obj = require('./obj');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Error response

exports = module.exports = internals.Error = function (options) {

    // { code, payload, type, headers }

    Obj.call(this, options.payload);
    this._tag = 'error';
    this.code = options.code;

    Utils.merge(this.headers, options.headers);
    if (options.type) {
        this.headers['Content-Type'] = options.type;
    }

    return this;
};

NodeUtil.inherits(internals.Error, Obj);

