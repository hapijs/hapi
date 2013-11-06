// Load modules

var Joi = require('joi');


// Declare internals

var internals = {};


// Validate server options

exports.server = function (options) {

    var error = Joi.validate(options, internals.serverSchema);
    return (error ? error.annotated() : null);
};


internals.multipart = function (dest) {

    var schema = [
        {
            mode: Joi.string().valid('file', 'stream'),
            encoding: Joi.string(),
            maxFieldBytes: Joi.number(),
            maxFields: Joi.number(),
            uploadDir: Joi.string(),
            hash: Joi.string().valid('sha1', 'md5')
        },
        Joi.string().valid('file', 'stream').allow(false),
    ];

    if (dest === 'server') {
        schema[0].mode = schema[0].mode.required();
    }

    return schema;
};


internals.serverSchema = {
    app: Joi.object().nullOk(),
    auth: Joi.object().allow(false).allow(true),
    cache: [Joi.string().nullOk(), Joi.object({
        engine: [Joi.string().required(), Joi.object().required()],
        partition: Joi.string(),
        host: Joi.string(),
        location: [Joi.string(), Joi.array(), Joi.object()],
        port: Joi.number(),
        username: Joi.string(),
        password: Joi.string(),
        poolSize: Joi.number(),
        maxByteSize: Joi.number()
    }).nullOk()],
    cors: Joi.object({
        origin: Joi.array(),
        isOriginExposed: Joi.boolean(),
        maxAge: Joi.number(),
        headers: Joi.array(),
        additionalHeaders: Joi.array(),
        methods: Joi.array(),
        additionalMethods: Joi.array(),
        exposedHeaders: Joi.array(),
        additionalExposedHeaders: Joi.array(),
        credentials: Joi.boolean()
    }).nullOk().allow(false).allow(true),
    debug: Joi.object({
        request: Joi.array()
    }).allow(false),
    files: Joi.object({
        relativeTo: Joi.string()
    }).allow(false).allow(true),
    json: Joi.object({
        replacer: [Joi.func().nullOk(), Joi.array()],
        space: Joi.number().nullOk()
    }),
    labels: [Joi.string(), Joi.array()],
    location: Joi.string().emptyOk(),
    payload: Joi.object({
        maxBytes: Joi.number(),
        multipart: internals.multipart('server')
    }),
    plugins: Joi.object(),
    router: Joi.object({
        isCaseSensitive: Joi.boolean(),
        normalizeRequestPath: Joi.boolean()
    }).allow(false).allow(true),
    state: Joi.object({
        cookies: Joi.object({
            parse: Joi.boolean(),
            failAction: Joi.string().valid('error', 'log', 'ignore'),
            clearInvalid: Joi.boolean(),
            strictHeader: Joi.boolean()
        })
    }).allow(false).allow(true),
    timeout: Joi.object({
        socket: Joi.number().nullOk().allow(false).allow(true),
        client: Joi.number().nullOk().allow(false).allow(true),
        server: Joi.number().nullOk().allow(false).allow(true)
    }).allow(false).allow(true),
    tls: Joi.object().nullOk(),
    views: Joi.object({
        engines: Joi.object().required(),
        defaultExtension: Joi.string(),
        path: Joi.string(),
        basePath: Joi.string(),
        compileOptions: Joi.object(),
        runtimeOptions: Joi.object(),
        layout: Joi.boolean(),
        layoutKeyword: Joi.string(),
        encoding: Joi.string(),
        isCached: Joi.boolean(),
        allowAbsolutePaths: Joi.boolean(),
        allowInsecureAccess: Joi.boolean(),
        partialsPath: Joi.string(),
        helpersPath: Joi.string(),
        contentType: Joi.string(),
        compileMode: Joi.string().valid('sync', 'async')
    }).nullOk(),
    maxSockets: Joi.number().nullOk()
};


// Validate route options

exports.routeOptions = function (options) {

    var error = Joi.validate(options, internals.routeOptionsSchema);
    return (error ? error.annotated() : null);
};


internals.routeOptionsSchema = {
    method: Joi.string().required(),
    path: Joi.string().required(),
    vhost: [Joi.string(), Joi.array()],
    handler: [Joi.object(), Joi.func(), Joi.string().valid('notFound')],
    config: Joi.object().nullOk()
};


// Validate route config

exports.routeConfig = function (config) {

    var error = Joi.validate(config, internals.routeConfigSchema);
    return (error ? error.annotated() : null);
};


internals.routeConfigSchema = {
    handler: [Joi.object(), Joi.func(), Joi.string().valid('notFound')],
    context: Joi.object(),
    payload: [Joi.string().valid('stream', 'raw', 'parse', 'try'),
        Joi.object({
            mode: Joi.string().valid(['stream', 'raw', 'parse', 'try']),
            allow: [Joi.string(), Joi.array()],
            override: Joi.string(),
            maxBytes: Joi.number(),
            multipart: internals.multipart('route')
        })
    ],
    auth: [
        Joi.object({
            mode: Joi.string().valid(['required', 'optional', 'try']),
            scope: [Joi.string(), Joi.array()],
            tos: Joi.string().allow(false),
            entity: Joi.string(),
            strategy: Joi.string(),
            strategies: Joi.array(),
            payload: [Joi.string(), Joi.boolean()]
        }),
        Joi.boolean().allow(false),
        Joi.string()
    ],
    validate: Joi.object({
        payload: Joi.object().nullOk().allow(true).allow(false),
        query: Joi.object().nullOk().allow(true).allow(false),
        path: Joi.object().nullOk().allow(true).allow(false),
        failAction: [Joi.string().valid('error', 'log', 'ignore'), Joi.func()],
        errorFields: Joi.object(),
        response: internals.routeOptionsSchema.config                   // Backwards compatibilty
    }),
    response: Joi.object({
        schema: Joi.object().nullOk(),
        sample: Joi.number().min(0).max(100),
        failAction: Joi.string().valid('error', 'log')
    }).allow(true).allow(false),
    cache: Joi.object({
        mode: Joi.string().valid(['server+client', 'client+server', 'client', 'server']),
        segment: Joi.string(),
        privacy: Joi.string().valid('default', 'public', 'private'),
        expiresIn: Joi.number().xor('expiresAt'),
        expiresAt: Joi.string(),
        staleIn: Joi.number().with('staleTimeout'),
        staleTimeout: Joi.number().with('staleIn')
    }),
    jsonp: Joi.string(),
    pre: Joi.array(),
    app: Joi.object().nullOk(),
    plugins: Joi.object(),
    description: Joi.string(),
    notes: [Joi.string(), Joi.array()],
    tags: [Joi.string(), Joi.array()]
};


exports.view = function (options) {

    var error = Joi.validate(options, internals.viewSchema);
    return (error ? error.annotated() : null);
};


internals.viewSchema = {
    module: [Joi.object({
        compile: Joi.func().required()
    }).options({ allowUnknown: true }).required(), Joi.string().required()],
    path: Joi.string().emptyOk(),
    basePath: Joi.string().emptyOk(),
    compileOptions: Joi.object(),
    runtimeOptions: Joi.object(),
    layout: Joi.boolean(),
    layoutKeyword: Joi.string(),
    encoding: Joi.string(),
    isCached: Joi.boolean(),
    allowAbsolutePaths: Joi.boolean(),
    allowInsecureAccess: Joi.boolean(),
    partialsPath: Joi.string().emptyOk(),
    helpersPath: Joi.string().emptyOk(),
    contentType: Joi.string(),
    compileMode: Joi.string().valid('sync', 'async')
};
