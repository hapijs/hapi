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


// Validate server options

exports.serverOptions = function (options, next) {

    var optionsSchema = {
        strict: Joi.Types.Boolean(),
        auth: Joi.Types.Object({
            scheme: Joi.Types.String(),
            loadUserFunc: Joi.Types.Function(),
            hashPasswordFunc: Joi.Types.Function()
        }).nullOk().allow(false).allow(true),
        cors: Joi.Types.Object({
            origin: Joi.Types.Array(),
            maxAge: Joi.Types.Number(),
            headers: Joi.Types.Array(),
            additionalHeaders: Joi.Types.Array(),
            methods: Joi.Types.Array(),
            additionalMethods: Joi.Types.Array(),
            credentials: Joi.Types.Boolean()
        }).nullOk().allow(false).allow(true),
        monitor: Joi.Types.Object({
            broadcastInterval: Joi.Types.Number(),
            opsInterval: Joi.Types.Number(),
            extendedRequests: Joi.Types.Boolean(),
            requestsEvent: Joi.Types.String(),
            subscribers: Joi.Types.Object().nullOk()
        }).nullOk().allow(false).allow(true),
        router: Joi.Types.Object({
            isCaseSensitive: Joi.Types.Boolean(),
            normalizeRequestPath: Joi.Types.Boolean(),
            routeDefaults: Joi.Types.Object().nullOk()
        }).nullOk().allow(false).allow(true),
        state: Joi.Types.Object({
            cookies: Joi.Types.Object({
                parse: Joi.Types.Boolean(),
                failAction: Joi.Types.String(),
                clearInvalid: Joi.Types.Boolean()
            }).nullOk()
        }).nullOk().allow(false).allow(true),
        payload: Joi.Types.Object({
            maxBytes: Joi.Types.Number()
        }).nullOk().allow(false).allow(true),
        files: Joi.Types.Object({
            relativeTo: Joi.Types.String()
        }).nullOk().allow(false).allow(true),
        timeout: Joi.Types.Object({
            client: Joi.Types.Number().nullOk().allow(false).allow(true),
            server: Joi.Types.Number().nullOk().allow(false).allow(true)
        }).nullOk().allow(false).allow(true),
        tls: Joi.Types.Object().nullOk().allow(false).allow(true),
        debug: Joi.Types.Object({
            debugEndpoint: Joi.Types.String(),
            queryKey: Joi.Types.String()
        }).nullOk().allow(false).allow(true),
        batch: Joi.Types.Object({
            batchEndpoint: Joi.Types.String()
        }).nullOk().allow(false).allow(true),
        docs: Joi.Types.Object().nullOk().allow(false).allow(true),
        views: Joi.Types.Object({
            engines: Joi.Types.Object({
                html: Joi.Types.Object({
                    module: Joi.Types.String(),
                    extension: Joi.Types.String(),
                    cache: Joi.Types.Object(),
                    map: Joi.Types.Object()
                })
            }),
            compileOptions: Joi.Types.Object(),
            layout: Joi.Types.Boolean(),
            layoutKeyword: Joi.Types.String(),
            encoding: Joi.Types.String(),
            cache: Joi.Types.Object(),
            allowAbsolutePaths: Joi.Types.Boolean().nullOk(),
            allowInsecureAccess: Joi.Types.Boolean().nullOk()
        }).nullOk().allow(false).allow(true),
        cache: [Joi.Types.String().nullOk(), Joi.Types.Object({
            engine: Joi.Types.String().required(),
            partition: Joi.Types.String(),
            host: Joi.Types.String(),
            port: Joi.Types.Number(),
            username: Joi.Types.String(),
            password: Joi.Types.String(),
            poolSize: Joi.Types.Number(),
            maxByteSize: Joi.Types.Number()
        }).allow(false).allow(true)]
    };

    Joi.validate(options, optionsSchema, function (err) {

        if (err) {
            return next(err);
        }
    });
};
