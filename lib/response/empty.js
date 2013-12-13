// Load modules

var Generic = require('./generic');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Empty response (Generic -> Empty)

exports = module.exports = internals.Empty = function () {

    Generic.call(this);
    this.variety = 'empty';
    this.varieties.empty = true;
};

Utils.inherits(internals.Empty, Generic);


internals.Empty.prototype.toCache = function () {

    return {
        code: this._code,
        payload: '',
        headers: this._headers,
        flags: this._flags
    };
};

