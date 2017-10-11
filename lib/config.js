'use strict';

// Load modules

const Os = require('os');

const Joi = require('joi');
const Hoek = require('hoek');


// Declare internals

const internals = {};


exports.symbol = Symbol('hapi-response');


exports.apply = function (type, options, message) {

    const result = Joi.validate(options, internals[type]);
    Hoek.assert(!result.error, 'Invalid', type, 'options', message ? '(' + message + ')' : '', result.error && result.error.annotate());
    return result.value;
};


exports.enable = function (options) {

    const settings = (options ? Hoek.shallow(options) : {});

    if (settings.security === true) {
        settings.security = {};
    }

    if (settings.cors === true) {
        settings.cors = {};
    }

    return settings;
};


internals.access = Joi.object({
    entity: Joi.string().valid('user', 'app', 'any'),
    scope: [false, Joi.array().items(Joi.string()).single().min(1)]
});


internals.auth = Joi.alternatives([
    Joi.string(),
    internals.access.keys({
        mode: Joi.string().valid('required', 'optional', 'try'),
        strategy: Joi.string(),
        strategies: Joi.array().items(Joi.string()).min(1),
        access: Joi.array().items(internals.access.min(1)).single().min(1),
        payload: [
            Joi.string().valid('required', 'optional'),
            Joi.boolean()
        ]
    })
        .without('strategy', 'strategies')
        .without('access', ['scope', 'entity'])
]);


internals.event = Joi.object({
    method: Joi.array().items(Joi.func()).single(),
    options: Joi.object({
        before: Joi.array().items(Joi.string()).single(),
        after: Joi.array().items(Joi.string()).single(),
        bind: Joi.any(),
        sandbox: Joi.string().valid('server', 'plugin')
    })
        .default({})
});


internals.exts = Joi.array().items(internals.event.keys({ type: Joi.string().required() })).single();


internals.routeBase = Joi.object({
    app: Joi.object().allow(null),
    auth: internals.auth.allow(false),
    bind: Joi.object().allow(null),
    cache: Joi.object({
        expiresIn: Joi.number(),
        expiresAt: Joi.string(),
        privacy: Joi.string().valid('default', 'public', 'private'),
        statuses: Joi.array().items(Joi.number().integer().min(200)).min(1).single().default([200, 204]),
        otherwise: Joi.string().default('no-cache')
    })
        .allow(false)
        .default(),
    compression: Joi.object()
        .pattern(/.+/, Joi.object())
        .default(),
    cors: Joi.object({
        origin: Joi.array().min(1).default(['*']),
        maxAge: Joi.number().default(86400),
        headers: Joi.array().items(Joi.string()).default(['Accept', 'Authorization', 'Content-Type', 'If-None-Match']),
        additionalHeaders: Joi.array().items(Joi.string()).default([]),
        exposedHeaders: Joi.array().items(Joi.string()).default(['WWW-Authenticate', 'Server-Authorization']),
        additionalExposedHeaders: Joi.array().items(Joi.string()).default([]),
        credentials: Joi.boolean().default(false)
    })
        .allow(false, true)
        .default(false),
    ext: Joi.object({
        onPreAuth: Joi.array().items(internals.event).single(),
        onPostAuth: Joi.array().items(internals.event).single(),
        onPreHandler: Joi.array().items(internals.event).single(),
        onPostHandler: Joi.array().items(internals.event).single(),
        onPreResponse: Joi.array().items(internals.event).single()
    })
        .default({}),
    files: Joi.object({
        relativeTo: Joi.string().regex(/^([\/\.])|([A-Za-z]:\\)|(\\\\)/).default('.')
    })
        .default(),
    json: Joi.object({
        replacer: Joi.alternatives(Joi.func(), Joi.array()).allow(null).default(null),
        space: Joi.number().allow(null).default(null),
        suffix: Joi.string().allow(null).default(null),
        escape: Joi.boolean().default(false)
    })
        .default(),
    jsonp: Joi.string(),
    log: Joi.object({
        collect: Joi.boolean().default(false)
    })
        .default(),
    payload: Joi.object({
        output: Joi.string().valid('data', 'stream', 'file').default('data'),
        parse: Joi.boolean().allow('gunzip').default(true),
        multipart: Joi.object({
            output: Joi.string().valid('data', 'stream', 'file', 'annotated').required()
        })
            .allow(false),
        allow: Joi.array().items(Joi.string()).single(),
        override: Joi.string(),
        maxBytes: Joi.number().integer().positive().default(1024 * 1024),
        uploads: Joi.string().default(Os.tmpdir()),
        failAction: Joi.alternatives([
            Joi.string().valid('error', 'log', 'ignore'),
            Joi.func()
        ])
            .default('error'),
        timeout: Joi.number().integer().positive().allow(false).default(10 * 1000),
        defaultContentType: Joi.string().default('application/json'),
        compression: Joi.object()
            .pattern(/.+/, Joi.object())
            .default()
    })
        .default(),
    plugins: Joi.object(),
    response: Joi.object({
        emptyStatusCode: Joi.number().valid(200, 204).default(200),
        failAction: [
            Joi.string().valid('error', 'log'),
            Joi.func()
        ],
        modify: Joi.boolean(),
        options: Joi.object().default(),
        ranges: Joi.boolean().default(true),
        sample: Joi.number().min(0).max(100),
        schema: Joi.alternatives(Joi.object(), Joi.array(), Joi.func()).allow(true, false),
        status: Joi.object().pattern(/\d\d\d/, Joi.alternatives(Joi.object(), Joi.array(), Joi.func()).allow(true, false))
    })
        .default()
        .without('modify', 'sample')
        .assert('options.stripUnknown', Joi.when('modify', { is: true, otherwise: Joi.forbidden() }), 'meet requirement of having peer modify set to true'),
    security: Joi.object({
        hsts: Joi.alternatives([
            Joi.object({
                maxAge: Joi.number(),
                includeSubdomains: Joi.boolean(),
                includeSubDomains: Joi.boolean(),
                preload: Joi.boolean()
            }),
            Joi.boolean(),
            Joi.number()
        ])
            .default(15768000),
        xframe: Joi.alternatives([
            Joi.boolean(),
            Joi.string().valid('sameorigin', 'deny'),
            Joi.object({
                rule: Joi.string().valid('sameorigin', 'deny', 'allow-from'),
                source: Joi.string()
            })
        ])
            .default('deny'),
        xss: Joi.boolean().default(true),
        noOpen: Joi.boolean().default(true),
        noSniff: Joi.boolean().default(true)
    })
        .allow(null, false, true)
        .default(false),
    state: Joi.object({
        parse: Joi.boolean().default(true),
        failAction: Joi.string().valid('error', 'log', 'ignore').default('error')
    })
        .default(),
    timeout: Joi.object({
        socket: Joi.number().integer().positive().allow(false),
        server: Joi.number().integer().positive().allow(false).default(false)
    })
        .default(),
    validate: Joi.object({
        headers: Joi.alternatives(Joi.object(), Joi.array(), Joi.func()).allow(null, false, true),
        params: Joi.alternatives(Joi.object(), Joi.array(), Joi.func()).allow(null, false, true),
        query: Joi.alternatives(Joi.object(), Joi.array(), Joi.func()).allow(null, false, true),
        payload: Joi.alternatives(Joi.object(), Joi.array(), Joi.func()).allow(null, false, true),
        failAction: [
            Joi.string().valid('error', 'log', 'ignore'),
            Joi.func()
        ],
        errorFields: Joi.object(),
        options: Joi.object().default()
    })
        .default()
});


internals.server = Joi.object({
    address: Joi.string().hostname(),
    app: Joi.object().allow(null),
    autoListen: Joi.boolean(),
    cache: Joi.allow(null),                                 // Validated elsewhere
    compression: Joi.object({
        minBytes: Joi.number().min(1).integer().default(1024)
    })
        .allow(false)
        .default(),
    debug: Joi.object({
        request: Joi.array().items(Joi.string()).single().allow(false).default(['implementation']),
        log: Joi.array().items(Joi.string()).single().allow(false)
    })
        .allow(false)
        .default(),
    host: Joi.string().hostname().allow(null),
    listener: Joi.any(),
    load: Joi.object({
        sampleInterval: Joi.number().integer().min(0).default(0)
    })
        .unknown()
        .default(),
    mime: Joi.object().allow(null).default(null),
    plugins: Joi.object(),
    port: Joi.alternatives([
        Joi.number().integer().min(0),          // TCP port
        Joi.string().regex(/\//),               // Unix domain socket
        Joi.string().regex(/^\\\\\.\\pipe\\/)   // Windows named pipe
    ])
        .allow(null),
    router: Joi.object({
        isCaseSensitive: Joi.boolean().default(true),
        stripTrailingSlash: Joi.boolean().default(false)
    })
        .default(),
    routes: internals.routeBase.default(),
    state: Joi.object(),                                    // Cookie defaults
    tls: Joi.alternatives([
        Joi.object().allow(null),
        Joi.boolean()
    ]),
    uri: Joi.string().regex(/[^/]$/)
});


internals.vhost = Joi.alternatives([
    Joi.string().hostname(),
    Joi.array().items(Joi.string().hostname()).min(1)
]);


internals.route = Joi.object({
    method: Joi.string().regex(/^[a-zA-Z0-9!#\$%&'\*\+\-\.^_`\|~]+$/).required(),
    path: Joi.string().required(),
    vhost: internals.vhost,
    handler: Joi.any(),                         // Validated in routeConfig
    config: Joi.alternatives([
        Joi.object(),
        Joi.func()
    ]).allow(null)
});


internals.pre = [
    Joi.func(),
    Joi.object({
        method: Joi.alternatives(Joi.string(), Joi.func()).required(),
        assign: Joi.string(),
        mode: Joi.string().valid('serial', 'parallel'),
        failAction: Joi.string().valid('error', 'log', 'ignore')
    })
];


internals.routeConfig = internals.routeBase.keys({
    id: Joi.string(),
    isInternal: Joi.boolean(),
    pre: Joi.array().items(internals.pre.concat(Joi.array().items(internals.pre).min(1))),
    handler: [
        Joi.func(),
        Joi.object().length(1)
    ],
    description: Joi.string(),
    notes: [
        Joi.string(),
        Joi.array().items(Joi.string())
    ],
    tags: [
        Joi.string(),
        Joi.array().items(Joi.string())
    ]
});


internals.cacheConfig = Joi.object({
    name: Joi.string().invalid('_default'),
    partition: Joi.string(),
    shared: Joi.boolean(),
    engine: Joi.alternatives([
        Joi.object(),
        Joi.func()
    ])
        .required()
}).unknown();


internals.cache = Joi.array().items(internals.cacheConfig, Joi.func()).min(1).single();


internals.cachePolicy = Joi.object({
    cache: Joi.string().allow(null).allow(''),
    segment: Joi.string(),
    shared: Joi.boolean()
})
    .options({ allowUnknown: true });               // Catbox validates other keys


internals.method = Joi.object({
    bind: Joi.object().allow(null),
    generateKey: Joi.func(),
    cache: internals.cachePolicy
});


internals.methodObject = Joi.object({
    name: Joi.string().required(),
    method: Joi.func().required(),
    options: Joi.object()
});


internals.register = Joi.object({
    once: Joi.boolean(),
    routes: Joi.object({
        prefix: Joi.string().regex(/^\/.+/),
        vhost: internals.vhost
    })
        .default({})
});


internals.plugin = internals.register.keys({
    register: Joi.func().keys({
        attributes: Joi.object({
            pkg: Joi.object({
                name: Joi.string(),
                version: Joi.string().default('0.0.0')
            })
                .unknown()
                .default({
                    version: '0.0.0'
                }),
            name: Joi.string()
                .when('pkg.name', { is: Joi.exist(), otherwise: Joi.required() }),
            version: Joi.string(),
            multiple: Joi.boolean().default(false),
            dependencies: Joi.array().items(Joi.string()).single(),
            once: Joi.boolean().valid(true)
        })
            .required()
            .unknown()
    })
        .required(),
    options: Joi.any()
})
    .without('once', 'options')
    .unknown();
