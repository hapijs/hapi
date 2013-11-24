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


internals.cache = Joi.object({
    name: Joi.string().invalid('_default'),
    engine: [Joi.string().required(), Joi.object().required()],
    partition: Joi.string(),
    shared: Joi.boolean(),
    host: Joi.string(),
    location: [Joi.string(), Joi.array(), Joi.object()],
    port: Joi.number(),
    username: Joi.string(),
    password: Joi.string(),
    poolSize: Joi.number(),
    maxByteSize: Joi.number()
});


internals.serverSchema = {
    app: Joi.object().allow(null),
    auth: Joi.object().allow(false, true),
    cache: [
        Joi.string().allow(null),
        internals.cache,
        Joi.array().includes(internals.cache)
    ],
    cors: Joi.object({
        origin: Joi.array(),
        isOriginExposed: Joi.boolean(),
        matchOrigin: Joi.boolean(),
        maxAge: Joi.number(),
        headers: Joi.array(),
        additionalHeaders: Joi.array(),
        methods: Joi.array(),
        additionalMethods: Joi.array(),
        exposedHeaders: Joi.array(),
        additionalExposedHeaders: Joi.array(),
        credentials: Joi.boolean()
    }).allow(null, false, true),
    debug: Joi.object({
        request: Joi.array()
    }).allow(false),
    files: Joi.object({
        relativeTo: Joi.string()
    }).allow(false, true),
    json: Joi.object({
        replacer: [Joi.func().allow(null), Joi.array()],
        space: Joi.number().allow(null)
    }),
    labels: [Joi.string(), Joi.array()],
    load: {
        maxHeapUsedBytes: Joi.number().min(0),
        maxEventLoopDelay: Joi.number().min(0),
        maxRssBytes: Joi.number().min(0),
        sampleInterval: Joi.number().min(0)
    },
    location: Joi.string().allow(''),
    payload: Joi.object({
        maxBytes: Joi.number(),
        multipart: internals.multipart('server')
    }),
    plugins: Joi.object(),
    router: Joi.object({
        isCaseSensitive: Joi.boolean(),
        normalizeRequestPath: Joi.boolean()
    }).allow(false, true),
    validation: Joi.object().allow(null),
    state: Joi.object({
        cookies: Joi.object({
            parse: Joi.boolean(),
            failAction: Joi.string().valid('error', 'log', 'ignore'),
            clearInvalid: Joi.boolean(),
            strictHeader: Joi.boolean()
        })
    }).allow(false, true),
    timeout: Joi.object({
        socket: Joi.number().allow(null, false, true),
        client: Joi.number().allow(null, false, true),
        server: Joi.number().allow(null, false, true)
    }).allow(false, true),
    tls: Joi.object().allow(null),
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
    }).allow(null),
    maxSockets: Joi.number().allow(null)
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
    config: Joi.object().allow(null)
};


// Validate route config

exports.routeConfig = function (config) {

    var error = Joi.validate(config, internals.routeConfigSchema);
    return (error ? error.annotated() : null);
};


internals.routeConfigSchema = {
    handler: [
        Joi.func(),
        Joi.string().valid('notFound'),
        Joi.object({
            file: [
                Joi.string().required(),
                Joi.func().required(),
                Joi.object({
                    path: Joi.string().required(),
                    mode: Joi.string().valid('attachment', 'inline').allow(false),
                    lookupCompressed: Joi.boolean()
                }).required()
            ]
        }),
        Joi.object({
            directory: Joi.object({
                path: [
                    Joi.string().required(),
                    Joi.array().includes(Joi.string()).required(),
                    Joi.func().required()
                ],
                index: Joi.boolean(),
                listing: Joi.boolean(),
                showHidden: Joi.boolean(),
                redirectToSlash: Joi.boolean(),
                lookupCompressed: Joi.boolean()
            }).required()
        }),
        Joi.object({
            proxy: Joi.object({
                host: Joi.string().xor('mapUri', 'uri'),
                port: Joi.number().integer().without('mapUri', 'uri'),
                protocol: Joi.string().valid('http', 'https').without('mapUri', 'uri'),
                uri: Joi.string().without('host', 'port', 'protocol', 'mapUri'),
                passThrough: Joi.boolean(),
                rejectUnauthorized: Joi.boolean(),
                xforward: Joi.boolean(),
                redirects: Joi.number().min(0).integer().allow(false),
                timeout: Joi.number().integer(),
                mapUri: Joi.func().without('host', 'port', 'protocol', 'uri'),
                postResponse: Joi.func(),
                ttl: Joi.string().valid('upstream').allow(null)
            }).required()
        }),
        Joi.object({
            view: Joi.string().required()
        })
    ],
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
        payload: Joi.object().allow(null, false, true),
        query: Joi.object().allow(null, false, true),
        path: Joi.object().allow(null, false, true),
        failAction: [Joi.string().valid('error', 'log', 'ignore'), Joi.func()],
        errorFields: Joi.object(),
        response: internals.routeOptionsSchema.config                   // Backwards compatibilty
    }),
    response: Joi.object({
        schema: Joi.object().allow(null),
        sample: Joi.number().min(0).max(100),
        failAction: Joi.string().valid('error', 'log')
    }).allow(true, false),
    cache: Joi.object({
        mode: Joi.string().valid(['server+client', 'client+server', 'client', 'server']),
        cache: Joi.string().allow(null).allow(''),
        segment: Joi.string(),
        shared: Joi.boolean(),
        privacy: Joi.string().valid('default', 'public', 'private'),
        expiresIn: Joi.number().without('expiresAt'),
        expiresAt: Joi.string(),
        staleIn: Joi.number().with('staleTimeout'),
        staleTimeout: Joi.number().with('staleIn')
    }),
    cors: Joi.boolean(),
    jsonp: Joi.string(),
    pre: Joi.array(),
    app: Joi.object().allow(null),
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
    path: Joi.string().allow(''),
    basePath: Joi.string().allow(''),
    compileOptions: Joi.object(),
    runtimeOptions: Joi.object(),
    layout: Joi.boolean(),
    layoutKeyword: Joi.string(),
    encoding: Joi.string(),
    isCached: Joi.boolean(),
    allowAbsolutePaths: Joi.boolean(),
    allowInsecureAccess: Joi.boolean(),
    partialsPath: Joi.string().allow(''),
    helpersPath: Joi.string().allow(''),
    contentType: Joi.string(),
    compileMode: Joi.string().valid('sync', 'async')
};
