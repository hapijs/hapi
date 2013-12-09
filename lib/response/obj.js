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

    this._stringify = {};                           // JSON.stringify options
    this.raw = object;                              // Can change if reference is modified
    this.options(options);
};

Utils.inherits(internals.Obj, Cacheable);


internals.Obj.prototype.options = function (options) {

    options = options || {};

    if (options.hasOwnProperty('replacer')) {
        this._stringify.replacer = options.replacer;
    }

    if (options.hasOwnProperty('space')) {
        this._stringify.space = options.space;
    }

    this._headers['content-type'] = options.type || this._headers['content-type'] || 'application/json';
    this.encoding(options.encoding);
};


internals.Obj.prototype._prepare = function (request, callback) {

    var space = this._stringify.space || request.server.settings.json.space;
    var replacer = this._stringify.replacer || request.server.settings.json.replacer;
    this._payload = [JSON.stringify(this.raw, replacer, space)];
    return Cacheable.prototype._prepare.call(this, request, callback);
};


internals.Obj.prototype.toCache = function () {

    return {
        code: this._code,
        payload: JSON.stringify(this.raw, this._stringify.replacer, this._stringify.space),
        headers: this._headers,
        flags: this._flags
    };
};
