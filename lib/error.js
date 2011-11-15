/*
* Copyright (c) 2011 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Declare internals

var internals = {};


// Define error codes

exports.generic = function (code, text, message, log) {

    return { code: code, type: 'http', text: text, message: message, log: log };
};

exports.unauthorized = function (message) {

    return { code: 401, type: 'http', text: 'Unauthorized', message: message };
};

exports.badRequest = function (message) {

    return { code: 400, type: 'http', text: 'Bad request', message: message };
};

exports.forbidden = function (message) {

    return { code: 403, type: 'http', text: 'Not allowed', message: message };
};

exports.notFound = function (message) {

    return { code: 404, type: 'http', text: 'Not Found', message: message };
};

exports.internal = function (message, log) {

    return { code: 500, type: 'http', text: 'Internal error', message: message, log: { input: log, stack: internals.callStack()} };
};

exports.database = function (err, collection, action, input) {

    return { code: 500, type: 'http', text: 'Internal error', log: { error: err, collection: collection, action: action, input: input, stack: internals.callStack()} };
};

exports.informative = function (message) {

    return { code: 200, type: 'http', text: 'Informative', message: message };
};

exports.oauth = function (code, description) {

    return { code: 400, type: 'oauth', text: description, error: code };
};


internals.callStack = function () {

    try {

        throw new Error('Trace');
    }
    catch (e) {

        return e.stack;
    }

    return '';
};


