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

    return exports.create(message, 500, 'Internal error', { data: data, stack: internals.callStack() });
};


exports._oauth = function (code, description) {

    return exports.create('OAuth', 400, description, { type: 'oauth', error: code });
};


exports.format = function (error) {

    if (error.type === 'oauth') {
        return { error: error.error, error_description: error.text };
    }
    else if (error.code >= 500 && error.code < 600) {
        return { error: error.text, message: 'An internal server error occured', code: error.code };
    }
    else {
        return { error: error.text, message: error.message, code: error.code };
    }
};


exports.create = function (message, code, text, options) {

    var err = new Error(message || '');
    err.code = code;
    err.text = text;

    for (var d in options) {
        if (options.hasOwnProperty(d)) {
            err[d] = options[d];
        }
    }

    return err;
};


internals.callStack = function () {

    try {
        throw new Error('Trace');
    }
    catch (e) {
        return e.stack;
    }
};


