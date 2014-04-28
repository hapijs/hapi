// Load modules

var Boom = require('boom');
var Joi = require('joi');
var Utils = require('./utils');


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


internals.emptyObject = Joi.object({});


internals.input = function (source, key, request, next) {

    if (typeof request[key] !== 'object') {
        return next(Boom.unsupportedMediaType(source + ' must represent an object'));
    }

    var postValidate = function (err) {

        if (!err) {
            return next();
        }

        // failAction: 'error', 'log', 'ignore', function (source, err, next)

        if (request.route.validate.failAction === 'ignore') {
            return next();
        }

        // Prepare error

        var error = Boom.badRequest(Utils.escapeHtml(err.message), err);
        error.output.payload.validation = { source: source, keys: [] };
        if (err.details) {
            for (var i = 0, il = err.details.length; i < il; ++i) {
                error.output.payload.validation.keys.push(err.details[i].path);
            }
        }

        if (request.route.validate.errorFields) {
            var fields = Object.keys(request.route.validate.errorFields);
            for (var f = 0, fl = fields.length; f < fl; ++f) {
                var field = fields[f];
                error.output.payload[field] = request.route.validate.errorFields[field];
            }
        }

        request.log(['hapi', 'validation', 'error', source], error);

        // Log only

        if (request.route.validate.failAction === 'log') {
            return next();
        }

        // Custom handler

        if (typeof request.route.validate.failAction === 'function') {
            return request.route.validate.failAction(source, error, next);
        }

        // Return error

        return next(error);
    };

    var schema = request.route.validate[source] || internals.emptyObject;

    if (typeof schema === 'function') {
        return schema(request[key], request.server.settings.validation, postValidate);
    }

    return schema.validateCallback(request[key], request.server.settings.validation, postValidate);
};


// Validate response schema

exports.response = function (request, next) {

    if (request.route.response.sample) {
        var currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request.route.response.sample) {
            return next();
        }
    }

    if (request.response.isBoom) {
        return next();
    }

    if (request.response.variety !== 'plain' ||
        typeof request.response.source !== 'object') {

        return next(Boom.badImplementation('Cannot validate non-object response'));
    }

    var postValidate = function (err) {

        if (!err) {
            return next();
        }

        // failAction: 'error', 'log'

        if (request.route.response.failAction === 'log') {
            request.log(['hapi', 'validation', 'error'], err.message);
            return next();
        }

        return next(Boom.badImplementation(err.message));
    };

    var schema = request.route.response.schema;
    if (typeof schema === 'function') {
        return schema(request.response.source, request.server.settings.validation, postValidate);
    }

    return Joi.validateCallback(request.response.source, schema, request.server.settings.validation, postValidate);
};