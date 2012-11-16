// Load modules

var NodeUtil = require('util');
var Generic = require('./generic');


// Declare internals

var internals = {};


// Obj response

exports = module.exports = internals.Obj = function (object, type) {

    Generic.call(this);
    this._tag = 'obj';

    this.payload = JSON.stringify(object);                              // Convert immediately to snapshot content
    this.raw = object;                                                  // Can change is reference is modified
    this.headers['Content-Type'] = type || 'application/json';
    this.headers['Content-Length'] = Buffer.byteLength(this.payload);

    return this;
};

NodeUtil.inherits(internals.Obj, Generic);
