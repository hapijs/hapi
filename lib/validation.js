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

    if (request.route.validate.query === null ||
        request.route.validate.query === undefined ||
        request.route.validate.query === true) {       // Value can be false

        return next();
    }

    Joi.validate(request.query, request.route.validate.query, function (err) {

        next(err ? Err.badRequest(err.message) : null);
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

        next(err ? Err.badRequest(err.message) : null);
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

        next(err ? Err.badRequest(err.message) : null);
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

    if (request.response instanceof Error) {
        return next();
    }

    if (!request.response.varieties.obj) {
        return next(Err.internal('Cannot validate non-object response'));
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
