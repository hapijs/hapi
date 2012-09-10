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
        return { error: request.response.error.error, error_description: request.response.error.text };
    }
    else if (error.code === 500) {
        return { error: request.response.error.text, code: request.response.error.code };
    }
    else {
        return { error: request.response.error.text, message: request.response.error.message, code: request.response.error.code };
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


