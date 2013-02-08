// Load modules

var Boom = require('boom');

// Declare internals

var internals = {};


exports.handler = function (route) {

    return function (request) {

        return request.reply(Boom.notFound('Not found'));
    };
};