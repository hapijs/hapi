// Load modules

var Joi = require('joi');
var Boom = require('boom');
var Response = require('./response');


// Declare internals

var internals = {};


// Common shortcuts

var T = Joi.Types;


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

exports.server = function (options, next) {

    Joi.validate(options, internals.serverSchema, function (err) {

        return next(err);
    });
};


internals.serverSchema = {
    strict: T.Boolean(),
    nickname: T.String().optional(),
    host: T.String().optional(),
    port: T.Number().optional(),
    uri: T.String().optional(),
    auth: T.Object({
        scheme: T.String(),
        loadUserFunc: T.Function(),
        hashPasswordFunc: T.Function()
    }).nullOk().allow(false).allow(true),
    cors: T.Object({
        origin: T.Array(),
        maxAge: T.Number(),
        headers: T.Array(),
        additionalHeaders: T.Array(),
        methods: T.Array(),
        additionalMethods: T.Array(),
        credentials: T.Boolean()
    }).nullOk().allow(false).allow(true),
    monitor: T.Object({
        broadcastInterval: T.Number(),
        opsInterval: T.Number(),
        extendedRequests: T.Boolean(),
        requestsEvent: T.String(),
        subscribers: T.Object().nullOk()
    }).nullOk().allow(false).allow(true),
    router: T.Object({
        isCaseSensitive: T.Boolean(),
        normalizeRequestPath: T.Boolean(),
        routeDefaults: T.Object().nullOk()
    }).nullOk().allow(false).allow(true),
    state: T.Object({
        cookies: T.Object({
            parse: T.Boolean(),
            failAction: T.String(),
            clearInvalid: T.Boolean()
        }).nullOk()
    }).nullOk().allow(false).allow(true),
    payload: T.Object({
        maxBytes: T.Number()
    }).nullOk().allow(false).allow(true),
    files: T.Object({
        relativeTo: T.String()
    }).nullOk().allow(false).allow(true),
    timeout: T.Object({
        client: T.Number().nullOk().allow(false).allow(true),
        server: T.Number().nullOk().allow(false).allow(true)
    }).nullOk().allow(false).allow(true),
    tls: T.Object().nullOk().allow(false).allow(true).optional(),
    debug: T.Object({
        debugEndpoint: T.String(),
        queryKey: T.String()
    }).nullOk().allow(false).allow(true),
    batch: T.Object({
        batchEndpoint: T.String()
    }).nullOk().allow(false).allow(true),
    docs: T.Object().nullOk().allow(false).allow(true),
    views: T.Object({
        engines: T.Object({
            html: T.Object({
                module: T.String(),
                extension: T.String(),
                cache: T.Object(),
                map: T.Object()
            })
        }),
        compileOptions: T.Object(),
        layout: T.Boolean(),
        layoutKeyword: T.String(),
        encoding: T.String(),
        cache: T.Object(),
        allowAbsolutePaths: T.Boolean().nullOk(),
        allowInsecureAccess: T.Boolean().nullOk()
    }).nullOk().allow(false).allow(true),
    cache: [T.String().nullOk(), T.Object({
        engine: T.String().required(),
        partition: T.String(),
        host: T.String(),
        port: T.Number(),
        username: T.String(),
        password: T.String(),
        poolSize: T.Number(),
        maxByteSize: T.Number()
    }).allow(false).allow(true)]
};
