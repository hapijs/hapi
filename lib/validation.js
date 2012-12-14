// Load modules

var Joi = require('joi');
var Err = require('./error');
var Response = require('./response');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request._route.config.validate.query === null ||
        request._route.config.validate.query === undefined ||
        request._route.config.validate.query === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.query, request._route.config.validate.query, function (err) {

        next(err ? Err.badRequest(err.message) : null);
    });
};


// Validate payload schema

exports.payload = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request._route.config.validate.schema === null ||
        request._route.config.validate.schema === undefined ||
        request._route.config.validate.schema === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.payload, request._route.config.validate.schema, function (err) {

        next(err ? Err.badRequest(err.message) : null);
    });
};


// Validate path params

exports.path = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request._route.config.validate.path === null ||
        request._route.config.validate.path === undefined ||
        request._route.config.validate.path === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.params, request._route.config.validate.path, function (err) {

        next(err ? Err.badRequest(err.message) : null);
    });
};


// Validate response schema

exports.response = function (request, next) {

    // null, undefined, true - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request._route.config.response === null ||
        request._route.config.response === undefined ||
        request._route.config.response === true) {       // Value can be false

        return next();
    }

    if (request._response instanceof Response.Obj === false) {
        return next(Err.internal('Cannot validate non-object response'));
    }

    Joi.validate(request._response._raw, request._route.config.response, function (err) {

        next(err ? Err.internal(err.message) : null);
    });
};


