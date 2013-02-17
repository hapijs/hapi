// Load modules

var Cacheable = require('./cacheable');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Obj response (Base -> Generic -> Cacheable -> Obj)

exports = module.exports = internals.Obj = function (object, type) {

    Cacheable.call(this);
    this.variety = 'obj';
    this.varieties.obj = true;

    this.raw = object;              // Can change if reference is modified
    this.update(type);              // Convert immediately to snapshot content

    return this;
};

Utils.inherits(internals.Obj, Cacheable);


internals.Obj.prototype.update = function (type) {

    this._payload = [JSON.stringify(this.raw)];
    this._headers['Content-Type'] = type || this._headers['Content-Type'] || 'application/json';
};
