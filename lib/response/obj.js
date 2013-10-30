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
    this.update(arguments[1], arguments[2]);        // [options] or [type, encoding] for backwards compatibility
};

Utils.inherits(internals.Obj, Cacheable);


internals.Obj.prototype.update = function (options) {

    options = options || {};
    if (typeof options !== 'object') {
        options = {
            type: arguments[0],
            encoding: arguments[1]
        };
    }

    this._payload = [JSON.stringify(this.raw, options.replacer, options.space)];
    this._headers['content-type'] = options.type || this._headers['content-type'] || 'application/json';
    this.encoding(options.encoding);
};
