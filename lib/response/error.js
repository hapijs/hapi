// Load modules

var Obj = require('./obj');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Error response (Generic -> Cacheable -> Obj -> Error)

exports = module.exports = internals.Error = function (error, options) {

    // { code, payload, type, headers } or Boom

    if (error.isBoom) {
        this._err = error;
        error = error.response;
    }

    Obj.call(this, error.payload, error, options);
    this.variety = 'error';
    this.varieties.error = true;

    this._code = error.code;

    Utils.merge(this._headers, error.headers);
    if (error.type) {
        this._headers['content-type'] = error.type;
    }
};

Utils.inherits(internals.Error, Obj);

