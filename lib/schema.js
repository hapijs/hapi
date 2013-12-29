// Load modules

var Joi = require('joi');
var Utils = require('./utils');


// Declare internals

var internals = {};


// Validate server options

exports.server = function (options) {

    var error = Joi.validate(options, internals.serverSchema);
    return (error ? error.annotated() : null);
};


internals.cache = Joi.object({
    name: Joi.string().invalid('_default'),
    engine: [Joi.string().required(), Joi.object().required()],
    partition: Joi.string(),
    shared: Joi.boolean(),
    host: Joi.string(),
    port: Joi.number(),
    location: [Joi.string(), Joi.array(), Joi.object()],
    username: Joi.string(),
    password: Joi.string(),
    poolSize: Joi.number(),
    maxByteSize: Joi.number()
});


internals.viewSchema = function (base) {
    var schema = {
        path: Joi.string(),
        basePath: Joi.string(),
        compileOptions: Joi.object(),
        runtimeOptions: Joi.object(),
        layout: Joi.string().allow(false, true),
        layoutKeyword: Joi.string(),
        layoutPath: Joi.string(),
        encoding: Joi.string(),
        isCached: Joi.boolean(),
        allowAbsolutePaths: Joi.boolean(),
        allowInsecureAccess: Joi.boolean(),
        partialsPath: Joi.string(),
        helpersPath: Joi.string(),
        contentType: Joi.string(),
        compileMode: Joi.string().valid('sync', 'async')
    };
    
    return Utils.merge(schema, base);
};


internals.serverSchema = {
    app: Joi.object().allow(null),
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
        relativeTo: Joi.string().regex(/^[\/\.]/).required(),
        etagsCacheMaxSize: Joi.number().min(0)
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
        uploads: Joi.string(),
    }),
    plugins: Joi.object(),
    router: Joi.object({
        isCaseSensitive: Joi.boolean()
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
    views: internals.viewSchema({
        engines: Joi.object().required()
    }),
    maxSockets: Joi.number().allow(null)
};


// Validate route options

exports.routeOptions = function (options) {

    var error = Joi.validate(options, internals.routeOptionsSchema);
    return (error ? error.annotated() : null);
};


internals.routeOptionsSchema = {
    method: [
        Joi.string().required(),
        Joi.array().includes(Joi.string()).min(1).required()
    ],
    path: Joi.string().required(),
    vhost: [Joi.string(), Joi.array()],
    handler: Joi.any(),                         // Validated in route.config
    config: Joi.object().allow(null)
};


// Validate route config

exports.routeConfig = function (config) {

    var error = Joi.validate(config, internals.routeConfigSchema);
    return (error ? error.annotated() : null);
};


internals.pre = [
    Joi.string(),
    Joi.func(),
    Joi.object({
        method: [Joi.string().required(), Joi.func().required()],
        assign: Joi.string(),
        mode: Joi.string().valid('serial', 'parallel'),
        failAction: Joi.string().valid('error', 'log', 'ignore')
    })
];


internals.routeConfigSchema = {
    pre: Joi.array().includes(internals.pre.concat(Joi.array().includes(internals.pre).min(1))),
    handler: [
        Joi.func(),
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
            }),
            file: [
                Joi.string(),
                Joi.func(),
                Joi.object({
                    path: Joi.string().required(),
                    mode: Joi.string().valid('attachment', 'inline').allow(false),
                    lookupCompressed: Joi.boolean()
                })
            ],
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
            }),
            view: Joi.string()
        }).length(1)
    ],
    bind: Joi.object().allow(null),
    payload: Joi.object({
        output: Joi.string().valid('data', 'stream', 'file'),
        parse: Joi.boolean(),
        allow: [Joi.string(), Joi.array()],
        override: Joi.string(),
        maxBytes: Joi.number(),
        uploads: Joi.string(),
        failAction: Joi.string().valid('error', 'log', 'ignore')
    }),
    auth: [
        Joi.object({
            mode: Joi.string().valid('required', 'optional', 'try'),
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
        errorFields: Joi.object()
    }),
    response: Joi.object({
        schema: Joi.object().allow(null),
        sample: Joi.number().min(0).max(100),
        failAction: Joi.string().valid('error', 'log')
    }).allow(true, false),
    cache: Joi.object({
        privacy: Joi.string().valid('default', 'public', 'private'),
        expiresIn: Joi.number().xor('expiresAt'),
        expiresAt: Joi.string()
    }),
    cors: Joi.boolean(),
    jsonp: Joi.string(),
    app: Joi.object().allow(null),
    plugins: Joi.object(),
    description: Joi.string(),
    notes: [Joi.string(), Joi.array()],
    tags: [Joi.string(), Joi.array()]
};


exports.view = function (options) {

    var schema = internals.viewSchema({
        module: [
            Joi.object({
                compile: Joi.func().required()
            }).options({ allowUnknown: true }).required(), Joi.string().required()
        ]
    });

    var error = Joi.validate(options, schema);
    return (error ? error.annotated() : null);
};


exports.cache = function (options) {

    var error = Joi.validate(options, internals.cacheSchema);
    return (error ? error.annotated() : null);
};


internals.cacheSchema = {
    cache: Joi.string().allow(null).allow(''),
    segment: Joi.string(),
    shared: Joi.boolean(),
    expiresIn: Joi.number().without('expiresAt'),
    expiresAt: Joi.string(),
    staleIn: Joi.number().with('staleTimeout'),
    staleTimeout: Joi.number().with('staleIn')
};


exports.helper = function (options) {

    var error = Joi.validate(options, internals.helperSchema);
    return (error ? error.annotated() : null);
};


internals.helperSchema = {
    generateKey: Joi.func(),
    cache: internals.cacheSchema
};
