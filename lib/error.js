// Load modules

var Utils = require('./utils');


// Declare internals

var internals = {};


exports.badRequest = function (message) {

    return exports.create(message, 400, 'Bad request');
};


exports.unauthorized = function (message) {

    return exports.create(message, 401, 'Unauthorized');
};


exports.forbidden = function (message) {

    return exports.create(message, 403, 'Not allowed');
};


exports.notFound = function (message) {

    return exports.create(message, 404, 'Not Found');
};


exports.internal = function (message, data) {

    var custom = {
        trace: Utils.callStack(1)
    };

    if (data) {
        custom.data = data;
    }

    return exports.create(message, 500, 'Internal error', custom);
};


exports.format = function (error) {

    if (error.hasOwnProperty('toResponse') &&
        typeof error.toResponse === 'function') {

        return error.toResponse();
    }

    var err = {
        error: error.text,
        code: error.code,
        message: (error.code >= 500 && error.code < 600 ? 'An internal server error occurred' : error.message)
    };

    return err;
};


exports.create = function (message, code, text, options) {

    var err = new Error();
    err.message = message;
    err.code = code;
    err.text = text;

    for (var d in options) {
        if (options.hasOwnProperty(d)) {
            err[d] = options[d];
        }
    }

    return err;
};




