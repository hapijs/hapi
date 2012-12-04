// Load modules

var NodeUtil = require('util');
var Cacheable = require('./cacheable');


// Declare internals

var internals = {};


// Obj response (Base -> Generic -> Cacheable -> Obj)

exports = module.exports = internals.Obj = function (object, type) {

    Cacheable.call(this);
    this._tag = 'obj';

    this._payload = JSON.stringify(object);                                 // Convert immediately to snapshot content
    this._raw = object;                                                     // Can change if reference is modified
    this._headers['Content-Type'] = type || 'application/json';
    this._headers['Content-Length'] = Buffer.byteLength(this._payload);

    return this;
};

NodeUtil.inherits(internals.Obj, Cacheable);
