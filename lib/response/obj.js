// Load modules

var Cacheable = require('./cacheable');
var Utils = require('../utils');

// Declare internals

var internals = {};


// Obj response (Generic -> Cacheable -> Obj)

exports = module.exports = internals.Obj = function (object, type, encoding) {

    Cacheable.call(this);
    this.variety = 'obj';
    this.varieties.obj = true;

    // Convert immediately to snapshot content

    this.raw = object;              // Can change if reference is modified
    this.update(type, encoding);
};

Utils.inherits(internals.Obj, Cacheable);


internals.Obj.prototype.update = function (type, encoding) {

    this._payload = [JSON.stringify(this.raw)];
    this._headers['Content-Type'] = type || this._headers['Content-Type'] || 'application/json';
    this._flags.encoding = encoding || 'utf-8';
};
