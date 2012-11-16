// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');


// Declare internals

var internals = {};


// Empty response

exports = module.exports = internals.Empty = function () {

    Generic.call(this);
    this._tag = 'empty';

    this.payload = '';
    this.headers['Content-Length'] = 0;

    return this;
};

NodeUtil.inherits(internals.Empty, Generic);


