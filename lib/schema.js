// Load modules

var Joi = require('joi');


// Declare internals

var internals = {};


// Common shortcuts

var T = Joi.Types;


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
    }).allow(false).allow(true)]
};