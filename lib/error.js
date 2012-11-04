// Load modules

var Http = require('http');
var NodeUtil = require('util');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = internals.Error = function (code, message, options) {

    Utils.assert(this.constructor === internals.Error, 'Error must be instantiated using new');
    Utils.assert(!options || !options.toResponse || typeof options.toResponse === 'function', 'options.toReponse must be a function');
    Utils.assert(code >= 400, 'Error code must be 4xx or 5xx');

    Error.call(this);

    this.code = code;
    this.message = message;
    this._settings = Utils.clone(options) || {};               // Options can be reused;

    return this;
};

NodeUtil.inherits(internals.Error, Error);


internals.Error.prototype.toResponse = function () {

    if (this._settings.toResponse) {

        return this._settings.toResponse.call(this);
    }

    var response = {
        code: this.code,
        payload: {
            error: Http.STATUS_CODES[this.code] || 'Unknown',
            code: this.code,
            message: this.message
        }
        // contentType: 'application/json'
    };

    for (var d in this) {
        if (this.hasOwnProperty(d) &&
            !response.payload.hasOwnProperty(d)) {

            response.payload[d] = this[d];
        }
    }

    return response;
};


// Utilities

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

    var format = function () {

        var response = {
            code: 500,
            payload: {
                error: Http.STATUS_CODES[500],
                code: 500,
                message: 'An internal server error occurred'                // Hide actual error from user
            }
        };

        return response;
    };

    var err = new internals.Error(500, message, { toResponse: format });
    err.trace = Utils.callStack(1);
    err.data = data;
    return err;
};


internals.Error.passThrough = function (code, payload, contentType) {

    var format = function () {

        var response = {
            code: code,
            payload: payload,
            contentType: contentType
        };

        return response;
    };

    var err = new internals.Error(500, 'Pass-through', { toResponse: format });     // 500 code is only used internally and is not exposed when sent

    err.passThrough = {
        code: code,
        payload: payload,
        contentType: contentType
    };
    
    return err;
};


internals.Error.toResponse = function (err) {

    Utils.assert(err instanceof Error, 'Input must be instance of Error');

    if (err instanceof internals.Error) {

        return err.toResponse();
    }

    // Other Error

    var response = {
        code: 500,
        payload: {
            message: err.message,
            name: err.name
        }
    };

    for (var d in err) {
        if (err.hasOwnProperty(d)) {
            response.payload[d] = err[d];
        }
    }

    return response;
};