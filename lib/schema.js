// Load modules

var Joi = require('joi');


// Declare internals

var internals = {};


// Common shortcuts

var T = Joi.Types;


// Validate route options

exports.route = function (options, config, next) {

    var error = Joi.validate(options, internals.routeOptionsSchema);

    if (error) {
        return next(error.annotated());
    }

    error = Joi.validate(config, internals.routeConfigSchema);
    return next(error ? error.annotated() : null);
};


// Validate server options

exports.server = function (options, next) {

    var error = Joi.validate(options, internals.serverSchema);
    return next(error ? error.annotated() : null);
};


internals.routeOptionsSchema = {
    method: T.String().invalid('head').required(),
    path: T.String().required(),
    vhost: [T.String().optional(), T.Array().optional()],
    handler: [T.Object().optional(), T.Function().optional(), T.String().valid('notFound').optional()],
    config: T.Object().optional().nullOk()
};


internals.routeConfigSchema = {
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
    jsonp: T.String().optional(),
    pre: T.Array().optional().nullOk(),
    app: T.Object().optional().nullOk(),
    plugins: T.Object().optional().nullOk(),
    description: T.String().optional(),
    notes: [T.String().optional(), T.Array()],
    tags: [T.String().optional(), T.Array()]
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
        socket: T.Number().nullOk().allow(false).allow(true),
        client: T.Number().nullOk().allow(false).allow(true),
        server: T.Number().nullOk().allow(false).allow(true)
    }).nullOk().allow(false).allow(true),
    tls: T.Object().nullOk().allow(false).allow(true).optional(),
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
    cache: [T.String().nullOk().optional(), T.Object({
        engine: T.String().required(),
        partition: T.String(),
        host: T.String(),
        port: T.Number(),
        username: T.String(),
        password: T.String(),
        poolSize: T.Number(),
        maxByteSize: T.Number()
    }).allow(false).allow(true).optional()],
    app: T.Object().optional().nullOk(),
    plugins: T.Object().optional().nullOk(),
    pack: T.Object().optional().nullOk()
};