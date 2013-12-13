// Load modules

var Obj = require('./obj');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Error response (Generic -> Obj -> Error)

exports = module.exports = internals.Error = function (error, options) {

    // { code, payload, type, headers } or Boom

    var item = (error.isBoom ? error.response : error);

    Obj.call(this, item.payload, item, options);
    this.variety = 'error';
    this.varieties.error = true;

    this._err = error;
    this._code = item.code;

    Utils.merge(this._headers, item.headers);
    if (item.type) {
        this._headers['content-type'] = item.type;
    }
};

Utils.inherits(internals.Error, Obj);
