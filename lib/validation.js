// Load modules

var Joi = require('joi');
var Boom = require('boom');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, next) {

    var error = Joi.validate(request.query, request.route.validate.query);
    next(error ? Boom.badRequest(error.message) : null);
};


// Validate payload schema

exports.payload = function (request, next) {

    var error = Joi.validate(request.payload, request.route.validate.payload);
    next(error ? Boom.badRequest(error.message) : null);
};


// Validate path params

exports.path = function (request, next) {

    var error = Joi.validate(request.params, request.route.validate.path);
    next(error ? Boom.badRequest(error.message) : null);
};


// Validate response schema

exports.response = function (request, next) {

    if (request.route.validate.response.sample) {
        var currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request.route.validate.response.sample) {
            return next();
        }
    }

    if (request._response.isBoom ||
        request._response.varieties.error) {

        return next();
    }

    if (!request._response.varieties.obj) {
        return next(Boom.internal('Cannot validate non-object response'));
    }

    var error = Joi.validate(request._response.raw, request.route.validate.response.schema);

    // failAction: 'error', 'log'

    if (!error) {
        return next();
    }

    if (request.route.validate.response.failAction === 'log') {
        request.log(['hapi', 'validation', 'error'], error.message);
        return next();
    }

    next(Boom.internal(error.message));
};