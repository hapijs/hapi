// Load modules

var Obj = require('./obj');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Error response (Generic -> Cacheable -> Obj -> Error)

exports = module.exports = internals.Error = function (options) {

    // { code, payload, type, headers } or Boom

    if (options.isBoom) {
        this._err = options;
        options = options.response;
    }

    Obj.call(this, options.payload);
    this.variety = 'error';
    this.varieties.error = true;

    this._code = options.code;

    Utils.merge(this._headers, options.headers);
    if (options.type) {
        this._headers['Content-Type'] = options.type;
    }
};

Utils.inherits(internals.Error, Obj);

