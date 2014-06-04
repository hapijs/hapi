// Load modules

var Joi = require('joi');
var Hoek = require('hoek');


// Declare internals

var internals = {};


exports.assert = function (type, options, message) {

    var error = Joi.validate(options, internals[type]).error;
    Hoek.assert(!error, 'Invalid', type, 'options', message ? '(' + message + ')' : '', error && error.annotate());
};


internals.cache = Joi.object({
    name: Joi.string().invalid('_default'),
    engine: Joi.alternatives([
        Joi.string(),
        Joi.object(),
        Joi.func()
    ])
        .required(),
    partition: Joi.string(),
    shared: Joi.boolean()
})
    .unknown();


internals.viewBase = Joi.object({
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
    compileMode: Joi.string().valid('sync', 'async'),
    defaultExtension: Joi.string()
});


internals.security = Joi.object({
    hsts: [
        Joi.object({
            maxAge: Joi.number(),
            includeSubdomains: Joi.boolean()
        }),
        Joi.boolean(),
        Joi.number()
    ],
    xframe: [
        Joi.boolean(),
        Joi.string().valid('sameorigin', 'deny'),
        Joi.object({
            rule: Joi.string().valid('sameorigin', 'deny', 'allow-from'),
            source: Joi.string()
        })
    ],
    xss: Joi.boolean(),
    noOpen: Joi.boolean(),
    noSniff: Joi.boolean()
}).allow(null, false, true);


internals.server = Joi.object({
    app: Joi.object().allow(null),
    cache: Joi.alternatives(Joi.string(), internals.cache, Joi.array().includes(internals.cache)).allow(null),
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
    security: internals.security,
    debug: Joi.object({
        request: Joi.array().allow(false)
    }).allow(false),
    files: Joi.object({
        relativeTo: Joi.string().regex(/^([\/\.])|([A-Za-z]:\\)|(\\\\)/).required(),
        etagsCacheMaxSize: Joi.number().min(0)
    }).allow(false, true),
    json: Joi.object({
        replacer: Joi.alternatives(Joi.func(), Joi.array()).allow(null),
        space: Joi.number().allow(null),
        suffix: Joi.string().allow(null)
    }),
    labels: [
        Joi.string(),
        Joi.array().includes(Joi.string())
    ],
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
        isCaseSensitive: Joi.boolean(),
        stripTrailingSlash: Joi.boolean()
    }),
    validation: Joi.object().allow(null),
    state: Joi.object({
        cookies: Joi.object({
            parse: Joi.boolean(),
            failAction: Joi.string().valid('error', 'log', 'ignore'),
            clearInvalid: Joi.boolean(),
            strictHeader: Joi.boolean()
        })
    }),
    timeout: Joi.object({
        socket: Joi.number().positive().allow(false),
        client: Joi.number().positive().allow(false).required(),
        server: Joi.number().positive().allow(false).required()
    }),
    tls: Joi.object().allow(null),
    views: internals.viewBase.keys({
        engines: Joi.object().required()
    }),
    maxSockets: Joi.number().positive().allow(false)
});


internals.route = Joi.object({
    method: Joi.alternatives(Joi.string(), Joi.array().includes(Joi.string()).min(1)).required(),
    path: Joi.string().required(),
    vhost: [
        Joi.string(),
        Joi.array()
    ],
    handler: Joi.any(),                         // Validated in route.config
    config: Joi.object().allow(null)
});


internals.pre = [
    Joi.string(),
    Joi.func(),
    Joi.object({
        method: Joi.alternatives(Joi.string(), Joi.func()).required(),
        assign: Joi.string(),
        mode: Joi.string().valid('serial', 'parallel'),
        failAction: Joi.string().valid('error', 'log', 'ignore')
    })
];


internals.routeConfig = Joi.object({
    pre: Joi.array().includes(internals.pre.concat(Joi.array().includes(internals.pre).min(1))),
    handler: [
        Joi.func(),
        Joi.string(),
        Joi.object().length(1)
    ],
    bind: Joi.object().allow(null),
    payload: Joi.object({
        output: Joi.string().valid('data', 'stream', 'file'),
        parse: Joi.boolean().allow('gunzip'),
        allow: [
            Joi.string(),
            Joi.array()
        ],
        override: Joi.string(),
        maxBytes: Joi.number(),
        uploads: Joi.string(),
        failAction: Joi.string().valid('error', 'log', 'ignore')
    }),
    auth: [
        Joi.object({
            mode: Joi.string().valid('required', 'optional', 'try'),
            scope: [
                Joi.string(),
                Joi.array()
            ],
            tos: Joi.string().allow(false),
            entity: Joi.string(),
            strategy: Joi.string(),
            strategies: Joi.array(),
            payload: [
                Joi.string(),
                Joi.boolean()
            ]
        }),
        Joi.boolean().allow(false),
        Joi.string()
    ],
    validate: Joi.object({
        headers: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        params: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        query: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        payload: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        failAction: [
            Joi.string().valid('error', 'log', 'ignore'),
            Joi.func()
        ],
        errorFields: Joi.object()
    })
        .or('headers', 'params', 'query', 'payload'),
    response: Joi.object({
        schema: Joi.alternatives(Joi.object(), Joi.func()).allow(true, false).required(),
        sample: Joi.number().min(0).max(100),
        failAction: Joi.string().valid('error', 'log')
    }),
    cache: Joi.object({
        privacy: Joi.string().valid('default', 'public', 'private'),
        expiresIn: Joi.number(),
        expiresAt: Joi.string()
    })
        .xor('expiresIn', 'expiresAt'),
    cors: Joi.boolean(),
    security: internals.security,
    jsonp: Joi.string(),
    app: Joi.object().allow(null),
    plugins: Joi.object(),
    description: Joi.string(),
    notes: [
        Joi.string(),
        Joi.array()
    ],
    tags: [
        Joi.string(),
        Joi.array()
    ]
});


internals['directory handler'] = Joi.object({
    path: Joi.alternatives(Joi.string(), Joi.array().includes(Joi.string()), Joi.func()).required(),
    index: Joi.boolean(),
    listing: Joi.boolean(),
    showHidden: Joi.boolean(),
    redirectToSlash: Joi.boolean(),
    lookupCompressed: Joi.boolean(),
    defaultExtension: Joi.string().alphanum()
});


internals['file handler'] = Joi.alternatives([
    Joi.string(),
    Joi.func(),
    Joi.object({
        path: Joi.string().required(),
        filename: Joi.string(),
        mode: Joi.string().valid('attachment', 'inline').allow(false),
        lookupCompressed: Joi.boolean()
    })
        .with('filename', 'mode')
]);


internals['proxy handler'] = Joi.object({
    host: Joi.string(),
    port: Joi.number().integer(),
    protocol: Joi.string().valid('http', 'https', 'http:', 'https:'),
    uri: Joi.string(),
    passThrough: Joi.boolean(),
    rejectUnauthorized: Joi.boolean(),
    xforward: Joi.boolean(),
    redirects: Joi.number().min(0).integer().allow(false),
    timeout: Joi.number().integer(),
    mapUri: Joi.func(),
    onResponse: Joi.func(),
    ttl: Joi.string().valid('upstream').allow(null),
    keepAcceptEncoding: Joi.boolean()
})
    .xor('host', 'mapUri', 'uri')
    .without('mapUri', 'port', 'protocol')
    .without('uri', 'port', 'protocol');


internals['view handler'] = Joi.alternatives([
    Joi.string(),
    Joi.object({
        template: Joi.string(),
        context: Joi.object()
    })
]);


internals.view = internals.viewBase.keys({
    module: Joi.alternatives([
        Joi.object({
            compile: Joi.func().required()
        }).options({ allowUnknown: true }),
        Joi.string()
    ]).required()
});


internals.cachePolicy = Joi.object({
    cache: Joi.string().allow(null).allow(''),
    segment: Joi.string(),
    shared: Joi.boolean(),
    expiresIn: Joi.number(),
    expiresAt: Joi.string(),
    staleIn: Joi.number(),
    staleTimeout: Joi.number()
})
    .without('expiresIn', 'expiresAt')
    .and('staleIn', 'staleTimeout');


internals.method = Joi.object({
    bind: Joi.object().allow(null),
    generateKey: Joi.func(),
    cache: internals.cachePolicy
});
