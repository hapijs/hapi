// Load modules

var Joi = require('joi');
var Boom = require('boom');
var Response = require('./response');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request.route.validate.query === null ||
        request.route.validate.query === undefined ||
        request.route.validate.query === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.query, request.route.validate.query, function (err) {

        next(err ? Boom.badRequest(err.message) : null);
    });
};


// Validate payload schema

exports.payload = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request.route.validate.schema === null ||
        request.route.validate.schema === undefined ||
        request.route.validate.schema === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.payload, request.route.validate.schema, function (err) {

        next(err ? Boom.badRequest(err.message) : null);
    });
};


// Validate path params

exports.path = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request.route.validate.path === null ||
        request.route.validate.path === undefined ||
        request.route.validate.path === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.params, request.route.validate.path, function (err) {

        next(err ? Boom.badRequest(err.message) : null);
    });
};


// Validate response schema

exports.response = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request.route.response === null ||
        request.route.response === undefined ||
        request.route.response === true ||          // Value can be false
        request.route.response.sample === 0) {

        return next();
    }

    if (request.route.response.sample) {
        var currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request.route.response.sample) {
            return next();
        }
    }

    if (request.response.isBoom ||
        request.response.varieties.error) {

        return next();
    }

    if (!request.response.varieties.obj) {
        return next(Boom.internal('Cannot validate non-object response'));
    }

    Joi.validate(request.response.raw, request.route.response.schema, function (err) {

        // failAction: 'error', 'log', 'ignore'

        if (!err ||
            request.route.response.failAction === 'ignore') {
            return next();
        }

        if (request.route.response.failAction === 'log') {
            request.log(['validation', 'error'], err.message);
            return next();
        }

        next(Boom.internal(err.message));
    });
};

