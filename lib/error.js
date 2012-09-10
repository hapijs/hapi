// Declare internals

var internals = {};


exports.badRequest = function (message) {

    return internals.create(message, { code: 400, type: 'http', text: 'Bad request' });
};


exports.unauthorized = function (message) {

    return internals.create(message, { code: 401, type: 'http', text: 'Unauthorized' });
};


exports.forbidden = function (message) {

    return internals.create(message, { code: 403, type: 'http', text: 'Not allowed' });
};


exports.notFound = function (message) {

    return internals.create(message, { code: 404, type: 'http', text: 'Not Found' });
};


exports.internal = function (message, data) {

    return internals.create(message, { code: 500, type: 'http', text: 'Internal error', data: data, stack: internals.callStack() });
};


exports._oauth = function (code, description) {

    return internals.create('OAuth', { code: 400, type: 'oauth', text: description, error: code });
};


exports._format = function (error) {

    if (error.type === 'oauth') {
        return { error: error.error, error_description: error.text };
    }
    else if (error.code === 500) {
        return { error: error.text, code: error.code };
    }
    else {
        return { error: error.text, message: error.message, code: error.code };
    }
};


internals.create = function (message, state) {

    var err = new Error(message || '');
    for (var d in state) {
        if (state.hasOwnProperty(d)) {
            err[d] = state[d];
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


