// Load modules

var Joi = require('joi');
var Boom = require('boom');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, next) {

    return internals.input('query', 'query', request, next);
};


// Validate payload schema

exports.payload = function (request, next) {

    return internals.input('payload', 'payload', request, next);
};


// Validate path params

exports.path = function (request, next) {

    return internals.input('path', 'params', request, next);
};


internals.input = function (source, key, request, next) {

    var err = Joi.validate(request[key], request.route.validate[source]);
    if (!err) {
        return next();
    }

    // failAction: 'error', 'log', 'ignore', function (source, err, next)

    if (request.route.validate.failAction === 'ignore') {
        return next();
    }

    // Prepare error

    var error = Boom.badRequest(err.message);
    error.response.payload.validation = { source: source, keys: [] };
    if (err._errors) {
        for (var i = 0, il = err._errors.length; i < il; ++i) {
            error.response.payload.validation.keys.push(err._errors[i].path);
        }
    }

    // Log only

    if (request.route.validate.failAction === 'log') {
        request.log(['hapi', 'validation', source], error);
        return next();
    }

    // Custom handler

    if (typeof request.route.validate.failAction === 'function') {
        return request.route.validate.failAction(source, error, next);
    }

    // Return error

    return next(error);
};


// Validate response schema

exports.response = function (request, next) {

    if (request.route.response.sample) {
        var currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request.route.response.sample) {
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

    var error = Joi.validate(request._response.raw, request.route.response.schema);
    if (!error) {
        return next();
    }

    // failAction: 'error', 'log'

    if (request.route.response.failAction === 'log') {
        request.log(['hapi', 'validation', 'error'], error.message);
        return next();
    }

    next(Boom.internal(error.message));
};