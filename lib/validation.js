// Load modules

var Boom = require('boom');
var JoiV1 = require('joi-v1');
var Joi = require('joi');


// Declare internals

var internals = {};


// Joi versions

internals.versions = {
    v1: JoiV1,
    v2: Joi
}

exports.version = function (version) {

    exports.lib = internals.versions[version];
    exports.types = exports.lib.types;
};

exports.version('v1');


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

    if (typeof request[key] !== 'object') {
        return next(Boom.unsupportedMediaType(source + ' must represent an object'));
    }

    var err = exports.lib.validate(request[key], request.route.validate[source] || {}, request.server.settings.validation);
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
    
    if (request.route.validate.errorFields) {
        var fields = Object.keys(request.route.validate.errorFields);
        for (var f = 0, fl = fields.length; f < fl; ++f) {
            var field = fields[f];
            error.response.payload[field] = request.route.validate.errorFields[field];
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
        return next(Boom.badImplementation('Cannot validate non-object response'));
    }

    var error = exports.lib.validate(request._response.raw, request.route.response.schema || {}, request.server.settings.validation);
    if (!error) {
        return next();
    }

    // failAction: 'error', 'log'

    if (request.route.response.failAction === 'log') {
        request.log(['hapi', 'validation', 'error'], error.message);
        return next();
    }

    next(Boom.badImplementation(error.message));
};