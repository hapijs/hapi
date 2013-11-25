// Load modules

var Cacheable = require('./cacheable');
var Utils = require('../utils');

// Declare internals

var internals = {};


// Obj response (Generic -> Cacheable -> Obj)

exports = module.exports = internals.Obj = function (object, options) {

    Cacheable.call(this);
    this.variety = 'obj';
    this.varieties.obj = true;

    // Convert immediately to snapshot content

    this.raw = object;                              // Can change if reference is modified
    this.update(options);
};

Utils.inherits(internals.Obj, Cacheable);


internals.Obj.prototype.update = function (options) {

    options = options || {};

    this._payload = [JSON.stringify(this.raw, options.replacer, options.space)];
    this._headers['content-type'] = options.type || this._headers['content-type'] || 'application/json';
    this.encoding(options.encoding);
};
