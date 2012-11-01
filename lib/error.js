// Load modules

var Http = require('http');
var NodeUtil = require('util');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Error = function (code, message, custom, options) {

    Utils.assert(this.constructor === internals.Error, 'Error must be instantiated using new');
    Utils.assert(!options || !options.toResponse || typeof options.toResponse === 'function', 'options.toReponse must be a function');

    Error.call(this);

    this.name = 'HapiError';
    this.code = code;
    this.message = message;
    this.text = Http.STATUS_CODES[code] || 'Unknown';
    this.settings = Utils.clone(options) || {};               // Options can be reused;

    for (var d in custom) {
        if (custom.hasOwnProperty(d)) {
            this[d] = custom[d];
        }
    }

    return this;
};

NodeUtil.inherits(internals.Error, Error);


internals.Error.prototype.response = function () {

    if (this.settings.toResponse) {

        return this.settings.toResponse.call(this);
    }

    var response = {
        code: this.code,
        payload: {
            error: this.text,
            code: this.code,
            message: (this.code >= 500 && this.code < 600 ? 'An internal server error occurred' : this.message)
        }
    }

    return response;
};


internals.Error.prototype.format = function () {

    return this.response().payload;
};


// Utilities

internals.Error.create = function (message, code, options) {

    return new internals.Error(message, code, options);
};


internals.Error.badRequest = function (message) {

    return new internals.Error(400, message);
};


internals.Error.unauthorized = function (message) {

    return new internals.Error(401, message);
};


internals.Error.forbidden = function (message) {

    return new internals.Error(403, message);
};


internals.Error.notFound = function (message) {

    return new internals.Error(404, message);
};


internals.Error.internal = function (message, data) {

    var custom = {
        trace: Utils.callStack(1)
    };

    if (data) {
        custom.data = data;
    }

    return new internals.Error(500, message, custom);
};


internals.Error.format = function (err) {

    return err.format();
};



