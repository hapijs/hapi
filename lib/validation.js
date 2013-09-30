// Load modules

var Joi = require('joi');
var Boom = require('boom');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, next) {

    var error = Joi.validate(request.query, request.route.validate.query);
    
    if (error && request.route.errorHandler && request.route.errorHandler.query) {
        return request.route.errorHandler.query(Boom.badRequest(error.message), next);
    }
    
    next(error ? Boom.badRequest(error.message) : null);
};


// Validate payload schema

exports.payload = function (request, next) {

    var error = Joi.validate(request.payload, request.route.validate.payload);
    
    if (error && request.route.errorHandler && request.route.errorHandler.payload) {
        return request.route.errorHandler.payload(error, next);
    }
    
    next(error ? Boom.badRequest(error.message) : null);
};


// Validate path params

exports.path = function (request, next) {

    var error = Joi.validate(request.params, request.route.validate.path);
    
    if (error && request.route.errorHandler && request.route.errorHandler.path) {
        return request.route.errorHandler.path(error, next);
    }
    
    next(error ? Boom.badRequest(error.message) : null);
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

    // failAction: 'error', 'log'

    if (!error) {
        return next();
    }

    if (request.route.response.failAction === 'log') {
        request.log(['hapi', 'validation', 'error'], error.message);
        return next();
    }

    next(Boom.internal(error.message));
};