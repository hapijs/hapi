// Load modules

var Err = require('./error');

// Declare internals

var internals = {};


exports.handler = function (route) {

    return function (request) {

        return request.reply(Err.notFound('Not found'));
    };
};