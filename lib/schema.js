// Load modules

var Joi = require('joi');


// Declare internals

var internals = {};


// Common shortcuts

var T = Joi.Types;


// Validate server options

exports.server = function (options) {

    var error = Joi.validate(options, internals.serverSchema);
    return (error ? error.annotated() : null);
};


internals.serverSchema = {
    app: T.Object().nullOk(),
    auth: T.Object().nullOk().allow(false).allow(true),
    cache: [T.String().nullOk(), T.Object({
        engine: T.String().required(),
        partition: T.String(),
        host: T.String(),
        port: T.Number(),
        username: T.String(),
        password: T.String(),
        poolSize: T.Number(),
        maxByteSize: T.Number()
    })],
    cors: T.Object({
        origin: T.Array(),
        maxAge: T.Number(),
        headers: T.Array(),
        additionalHeaders: T.Array(),
        methods: T.Array(),
        additionalMethods: T.Array(),
        exposedHeaders: T.Array(),
        additionalExposedHeaders: T.Array(),
        credentials: T.Boolean()
    }).nullOk().allow(false).allow(true),
    debug: T.Object({
        request: T.Array()
    }).nullOk().allow(false),
    files: T.Object({
        relativeTo: T.String()
    }).nullOk().allow(false).allow(true),
    labels: T.Array().nullOk(),
    location: T.String().emptyOk(),
    payload: T.Object({
        maxBytes: T.Number()
    }).nullOk().allow(false).allow(true),
    plugins: T.Object().nullOk(),
    router: T.Object({
        isCaseSensitive: T.Boolean(),
        normalizeRequestPath: T.Boolean()
    }).nullOk().allow(false).allow(true),
    state: T.Object({
        cookies: T.Object({
            parse: T.Boolean(),
            failAction: T.String(),
            clearInvalid: T.Boolean(),
            strictHeader: T.Boolean()
        }).nullOk()
    }).nullOk().allow(false).allow(true),
    timeout: T.Object({
        socket: T.Number().nullOk().allow(false).allow(true),
        client: T.Number().nullOk().allow(false).allow(true),
        server: T.Number().nullOk().allow(false).allow(true)
    }).nullOk().allow(false).allow(true),
    tls: T.Object().nullOk(),
    views: T.Object({
        engines: T.Object().required(),
        defaultExtension: T.String(),
        path: T.String(),
        basePath: T.String(),
        compileOptions: T.Object(),
        runtimeOptions: T.Object(),
        layout: T.Boolean(),
        layoutKeyword: T.String(),
        encoding: T.String(),
        isCached: T.Boolean(),
        allowAbsolutePaths: T.Boolean(),
        allowInsecureAccess: T.Boolean(),
        partialsPath: T.String(),
        contentType: T.String()
    }).nullOk()
};


// Validate route options

exports.routeOptions = function (options) {

    var error = Joi.validate(options, internals.routeOptionsSchema);
    return (error ? error.annotated() : null);
};


internals.routeOptionsSchema = {
    method: T.String().required(),
    path: T.String().required(),
    vhost: [T.String(), T.Array()],
    handler: [T.Object(), T.Function(), T.String().valid('notFound')],
    config: T.Object().nullOk()
};


// Validate route config

exports.routeConfig = function (config) {

    var error = Joi.validate(config, internals.routeConfigSchema);
    return (error ? error.annotated() : null);
};


internals.routeConfigSchema = {
    handler: [T.Object(), T.Function(), T.String().valid('notFound')],
    payload: T.String().valid('stream', 'raw', 'parse').nullOk(),
    auth: [
        T.Object({
            mode: T.String().valid(['required', 'optional', 'try']).nullOk(),
            scope: T.String().nullOk(),
            tos: T.String().allow(false).nullOk(),
            entity: T.String().nullOk(),
            strategy: T.String().nullOk(),
            strategies: T.Array().nullOk(),
            payload: [T.String().nullOk(), T.Boolean()]
        }).nullOk(),
        T.Boolean().allow(false).nullOk(),
        T.String().nullOk()
    ],
    validate: T.Object({
        payload: T.Object().nullOk().allow(true).allow(false),
        query: T.Object().nullOk().allow(true).allow(false),
        path: T.Object().nullOk().allow(true).allow(false),
        response: T.Object({
            schema: T.Object().nullOk(),
            sample: T.Number().min(0).max(100),
            failAction: T.String().valid('error', 'log')
        }).nullOk().allow(true).allow(false)
    }).nullOk(),
    cache: T.Object({
        mode: T.String().valid(['server+client', 'client+server', 'client', 'server']),
        segment: T.String(),
        privacy: T.String().valid('default', 'public', 'private'),
        expiresIn: T.Number().xor('expiresAt'),
        expiresAt: T.String(),
        staleIn: T.Number().with('staleTimeout'),
        staleTimeout: T.Number()//.with('staleIn')
    }).nullOk(),
    jsonp: T.String(),
    pre: T.Array().nullOk(),
    app: T.Object().nullOk(),
    plugins: T.Object().nullOk(),
    description: T.String(),
    notes: [T.String(), T.Array()],
    tags: [T.String(), T.Array()]
};


exports.view = function (options) {

    var error = Joi.validate(options, internals.viewSchema);
    return (error ? error.annotated() : null);
};


internals.viewSchema = {
    module: [T.Object({
        compile: T.Function().required()
    }).allowOtherKeys().required(), T.String().required()],
    path: T.String().emptyOk(),
    basePath: T.String().emptyOk(),
    compileOptions: T.Object(),
    runtimeOptions: T.Object(),
    layout: T.Boolean(),
    layoutKeyword: T.String(),
    encoding: T.String(),
    isCached: T.Boolean(),
    allowAbsolutePaths: T.Boolean(),
    allowInsecureAccess: T.Boolean(),
    partialsPath: T.String().emptyOk(),
    contentType: T.String(),
    compileMode: T.String().valid('sync', 'async')
};
