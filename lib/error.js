/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Declare internals

var internals = {};


// Define error codes

exports.generic = function (code, text, message, log) {

    return internals.create(message, { code: code, type: 'http', text: text, log: log });
};

exports.unauthorized = function (message) {

    return internals.create(message, { code: 401, type: 'http', text: 'Unauthorized' });
};

exports.badRequest = function (message) {

    return internals.create(message, { code: 400, type: 'http', text: 'Bad request' });
};

exports.forbidden = function (message) {

    return internals.create(message, { code: 403, type: 'http', text: 'Not allowed' });
};

exports.notFound = function (message) {

    return internals.create(message, { code: 404, type: 'http', text: 'Not Found' });
};

exports.internal = function (message, log) {

    return internals.create(message, { code: 500, type: 'http', text: 'Internal error', log: { input: log, stack: internals.callStack()} });
};

exports.database = function (err, collection, action, input) {

    return internals.create(message, { code: 500, type: 'http', text: 'Internal error', log: { error: err, collection: collection, action: action, input: input} });
};

exports.informative = function (message) {

    return internals.create(message, { code: 200, type: 'http', text: 'Informative' });
};

exports.oauth = function (code, description) {

    return internals.create('OAuth', { code: 400, type: 'oauth', text: description, error: code });
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

    return '';
};


