// Load modules

var Joi = require('joi');


// Declare internals

var internals = {};


// Common shortcuts

var T = Joi.Types;


// Validate route options

exports.route = function (options, next) {

    Joi.validate(options, internals.routeSchema, function (err) {

        return next(err);
    });
};


// Validate server options

exports.server = function (options, next) {

    Joi.validate(options, internals.serverSchema, function (err) {

        return next(err);
    });
};


internals.routeSchema = {
    method: T.String().invalid('head').required(),
    path: T.String().required(),
    handler: [T.Object().optional(), T.Function().optional(), T.String().valid('notFound').optional()],
    config: T.Object({
        handler: [T.Object(), T.Function(), T.String().valid('notFound').optional()],
        payload: T.String().valid(['stream', 'raw', 'parse']).optional(),
        response: T.Object({
            schema: T.Object().nullOk().optional(),
            sample: T.Number().optional(),
            failAction: T.String().optional().valid(['error', 'log', 'ignore'])
        }).optional().nullOk().allow(true).allow(false),
        auth: T.Object({
            mode: T.String().valid(['required', 'optional', 'try', 'none']).optional().nullOk(),
            scope: T.String().optional().nullOk(),
            tos: T.Number().optional().nullOk(),
            entity: T.String().optional().nullOk(),
            strategy: T.String().optional().nullOk(),
            strategies: T.Array().optional().nullOk()
        }).optional().nullOk(),
        validate: T.Object({
            schema: T.Object().optional().nullOk().allow(true).allow(false),
            query: T.Object().optional().nullOk().allow(true).allow(false),
            path: T.Object().optional().nullOk().allow(true).allow(false)
        }).optional().nullOk(),
        cache: T.Object({
            mode: T.String().optional().valid(['server+client', 'client+server', 'client', 'server', 'none']),
            segment: T.String().optional(),
            expiresIn: T.Number().optional().without('expiresAt'),
            expiresAt: T.String().optional().without('expiresIn'),
            strict: T.Boolean()
        }).optional().nullOk(),
        pre: T.Array().optional().nullOk(),
        app: T.Object().optional().nullOk(),
        plugins: T.Object().optional().nullOk()
    }).optional().nullOk()
};


internals.serverSchema = {
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
        path: T.String().optional().nullOk(),
        engines: T.Object().optional().nullOk(),
        compileOptions: T.Object().optional().nullOk(),
        layout: T.Boolean().optional().nullOk(),
        layoutKeyword: T.String().optional().nullOk(),
        encoding: T.String().optional().nullOk(),
        cache: T.Object().optional().nullOk().allow(true).allow(false),
        allowAbsolutePaths: T.Boolean().nullOk().optional(),
        allowInsecureAccess: T.Boolean().nullOk().optional()
    }).nullOk().allow(false).allow(true).optional(),
    cache: [T.String().nullOk(), T.Object({
        engine: T.String().required(),
        partition: T.String(),
        host: T.String(),
        port: T.Number(),
        username: T.String(),
        password: T.String(),
        poolSize: T.Number(),
        maxByteSize: T.Number()
    }).allow(false).allow(true)],
    app: T.Object().optional().nullOk(),
    plugins: T.Object().optional().nullOk()
};