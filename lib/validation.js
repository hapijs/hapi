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
        request._route.config.response === true ||          // Value can be false
        request._route.config.response.sample === 0) {

        return next();
    }

    if (request._route.config.response.sample) {
        var currentSample = Math.ceil((Math.random() * 100));
        if (currentSample > request._route.config.response.sample) {
            return next();
        }
    }

    if (request._response instanceof Error) {
        return next();
    }

    if (request._response instanceof Response.Obj === false) {
        return next(Err.internal('Cannot validate non-object response'));
    }

    Joi.validate(request._response._raw, request._route.config.response.schema, function (err) {

        // failAction: 'error', 'log', 'ignore'

        if (!err ||
            request._route.config.response.failAction === 'ignore') {
            return next();
        }

        if (request._route.config.response.failAction === 'log') {
            request.log(['validation', 'error'], err.message);
            return next();
        }

        next(Err.internal(err.message));
    });
};


// Validate server options

exports.serverOptions = function (options, next) {

    var optionsSchema = {
        strict: { strict: Joi.Types.Boolean() },
        auth: {
            scheme: Joi.Types.String(),
            loadUserFunc: Joi.Types.Object().nullOk(),
            hashPasswordFunc: Joi.Types.Object().nullOk()
        },
        cors: {
            origin: Joi.Types.Array(),
            maxAge: Joi.Types.Number(),
            headers: Joi.Types.Array(),
            additionalHeaders: Joi.Types.Array(),
            methods: Joi.Types.Array(),
            additionalMethods: Joi.Types.Array(),
            credentials: Joi.Types.Boolean()
        },
        monitor: {
            broadcastInterval: Joi.Types.Number(),
            opsInterval: Joi.Types.Number(),
            extendedRequests: Joi.Types.Boolean(),
            requestsEvent: Joi.Types.String(),
            subscribers: Joi.Types.Object().nullOk()
        },
        router: {
            isCaseSensitive: Joi.Types.Boolean(),
            normalizeRequestPath: Joi.Types.Boolean(),
            routeDefaults: Joi.Types.Object().nullOk()
        },
        state: {
            cookies: {
                parse: Joi.Types.Boolean(),
                failAction: Joi.Types.String()
            }
        }
    };

    Object.keys(options).forEach(function (key) {

        if (optionsSchema[key] === undefined) {
            return next(Err.internal('option not allowed: ' + key));
        }

        var optionToValidate = options[key];

        if (typeof options[key] !== 'object' || Object.keys(options[key]).length === 0) {
            optionToValidate = {};
            optionToValidate[key] = options[key];
        }

        Joi.validate(optionToValidate, optionsSchema[key], function (err) {

            if (err) {
                return next(err);
            }
        });
    });

    return next();
};