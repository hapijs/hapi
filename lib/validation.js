// Load modules

var Joi = require('joi');
var Err = require('./error');


// Declare internals

var internals = {};


// Validate query

exports.query = function (request, next) {

    // true - anything allowed
    // false, null, {} - nothing allowed
    // {...} - ... allowed

    if (request._route.config.query === true) {
        return next();
    }

    Joi.validate(request.query, request._route.config.query, function (err) {

        next(err ? Err.badRequest(err.message) : null);
    });
};


// Validate payload schema

exports.payload = function (request, next) {

    // null, undefined - anything allowed
    // false, {} - nothing allowed
    // {...} - ... allowed

    if (request._route.config.schema === null ||
        request._route.config.schema === undefined) {       // Value can be false

        return next();
    }

    Joi.validate(request.payload, request._route.config.schema, function (err) {

        next(err ? Err.badRequest(err.message) : null);
    });
};


