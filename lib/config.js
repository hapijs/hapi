'use strict';

const Os = require('os');

const Validate = require('@hapi/validate');


const internals = {};


exports.symbol = Symbol('hapi-response');


exports.apply = function (type, options, ...message) {

    const result = internals[type].validate(options);

    if (result.error) {
        throw new Error(`Invalid ${type} options ${message.length ? '(' + message.join(' ') + ')' : ''} ${result.error.annotate()}`);
    }

    return result.value;
};


exports.enable = function (options) {

    const settings = options ? Object.assign({}, options) : {};         // Shallow cloned

    if (settings.security === true) {
        settings.security = {};
    }

    if (settings.cors === true) {
        settings.cors = {};
    }

    return settings;
};


internals.access = Validate.object({
    entity: Validate.valid('user', 'app', 'any'),
    scope: [false, Validate.array().items(Validate.string()).single().min(1)]
});


internals.auth = Validate.alternatives([
    Validate.string(),
    internals.access.keys({
        mode: Validate.valid('required', 'optional', 'try'),
        strategy: Validate.string(),
        strategies: Validate.array().items(Validate.string()).min(1),
        access: Validate.array().items(internals.access.min(1)).single().min(1),
        payload: [
            Validate.valid('required', 'optional'),
            Validate.boolean()
        ]
    })
        .without('strategy', 'strategies')
        .without('access', ['scope', 'entity'])
]);


internals.event = Validate.object({
    method: Validate.array().items(Validate.function()).single(),
    options: Validate.object({
        before: Validate.array().items(Validate.string()).single(),
        after: Validate.array().items(Validate.string()).single(),
        bind: Validate.any(),
        sandbox: Validate.valid('server', 'plugin'),
        timeout: Validate.number().integer().min(1)
    })
        .default({})
});


internals.exts = Validate.array()
    .items(internals.event.keys({ type: Validate.string().required() })).single();


internals.failAction = Validate.alternatives([
    Validate.valid('error', 'log', 'ignore'),
    Validate.function()
])
    .default('error');


internals.routeBase = Validate.object({
    app: Validate.object().allow(null),
    auth: internals.auth.allow(false),
    bind: Validate.object().allow(null),
    cache: Validate.object({
        expiresIn: Validate.number(),
        expiresAt: Validate.string(),
        privacy: Validate.valid('default', 'public', 'private'),
        statuses: Validate.array().items(Validate.number().integer().min(200)).min(1).single().default([200, 204]),
        otherwise: Validate.string().default('no-cache')
    })
        .allow(false)
        .default(),
    compression: Validate.object()
        .pattern(/.+/, Validate.object())
        .default(),
    cors: Validate.object({
        origin: Validate.array().min(1).allow('ignore').default(['*']),
        maxAge: Validate.number().default(86400),
        headers: Validate.array().items(Validate.string()).default(['Accept', 'Authorization', 'Content-Type', 'If-None-Match']),
        additionalHeaders: Validate.array().items(Validate.string()).default([]),
        exposedHeaders: Validate.array().items(Validate.string()).default(['WWW-Authenticate', 'Server-Authorization']),
        additionalExposedHeaders: Validate.array().items(Validate.string()).default([]),
        credentials: Validate.boolean().when('origin', { is: 'ignore', then: false }).default(false)
    })
        .allow(false, true)
        .default(false),
    ext: Validate.object({
        onPreAuth: Validate.array().items(internals.event).single(),
        onCredentials: Validate.array().items(internals.event).single(),
        onPostAuth: Validate.array().items(internals.event).single(),
        onPreHandler: Validate.array().items(internals.event).single(),
        onPostHandler: Validate.array().items(internals.event).single(),
        onPreResponse: Validate.array().items(internals.event).single(),
        onPostResponse: Validate.array().items(internals.event).single()
    })
        .default({}),
    files: Validate.object({
        relativeTo: Validate.string().pattern(/^([\/\.])|([A-Za-z]:\\)|(\\\\)/).default('.')
    })
        .default(),
    json: Validate.object({
        replacer: Validate.alternatives(Validate.function(), Validate.array()).allow(null).default(null),
        space: Validate.number().allow(null).default(null),
        suffix: Validate.string().allow(null).default(null),
        escape: Validate.boolean().default(false)
    })
        .default(),
    jsonp: Validate.string(),
    log: Validate.object({
        collect: Validate.boolean().default(false)
    })
        .default(),
    payload: Validate.object({
        output: Validate.valid('data', 'stream', 'file').default('data'),
        parse: Validate.boolean().allow('gunzip').default(true),
        multipart: Validate.object({
            output: Validate.valid('data', 'stream', 'file', 'annotated').required()
        })
            .default(false)
            .allow(true, false),
        allow: Validate.array().items(Validate.string()).single(),
        override: Validate.string(),
        protoAction: Validate.valid('error', 'remove', 'ignore').default('error'),
        maxBytes: Validate.number().integer().positive().default(1024 * 1024),
        uploads: Validate.string().default(Os.tmpdir()),
        failAction: internals.failAction,
        timeout: Validate.number().integer().positive().allow(false).default(10 * 1000),
        defaultContentType: Validate.string().default('application/json'),
        compression: Validate.object()
            .pattern(/.+/, Validate.object())
            .default()
    })
        .default(),
    plugins: Validate.object(),
    response: Validate.object({
        disconnectStatusCode: Validate.number().integer().min(400).default(499),
        emptyStatusCode: Validate.valid(200, 204).default(204),
        failAction: internals.failAction,
        modify: Validate.boolean(),
        options: Validate.object(),
        ranges: Validate.boolean().default(true),
        sample: Validate.number().min(0).max(100).when('modify', { then: Validate.forbidden() }),
        schema: Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(true, false),
        status: Validate.object().pattern(/\d\d\d/, Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(true, false))
    })
        .default(),
    security: Validate.object({
        hsts: Validate.alternatives([
            Validate.object({
                maxAge: Validate.number(),
                includeSubdomains: Validate.boolean(),
                includeSubDomains: Validate.boolean(),
                preload: Validate.boolean()
            }),
            Validate.boolean(),
            Validate.number()
        ])
            .default(15768000),
        xframe: Validate.alternatives([
            Validate.boolean(),
            Validate.valid('sameorigin', 'deny'),
            Validate.object({
                rule: Validate.valid('sameorigin', 'deny', 'allow-from'),
                source: Validate.string()
            })
        ])
            .default('deny'),
        xss: Validate.boolean().default(true),
        noOpen: Validate.boolean().default(true),
        noSniff: Validate.boolean().default(true),
        referrer: Validate.alternatives([
            Validate.boolean().valid(false),
            Validate.valid('', 'no-referrer', 'no-referrer-when-downgrade',
                'unsafe-url', 'same-origin', 'origin', 'strict-origin',
                'origin-when-cross-origin', 'strict-origin-when-cross-origin')
        ])
            .default(false)
    })
        .allow(null, false, true)
        .default(false),
    state: Validate.object({
        parse: Validate.boolean().default(true),
        failAction: internals.failAction
    })
        .default(),
    timeout: Validate.object({
        socket: Validate.number().integer().positive().allow(false),
        server: Validate.number().integer().positive().allow(false).default(false)
    })
        .default(),
    validate: Validate.object({
        headers: Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(null, true),
        params: Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(null, true),
        query: Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(null, false, true),
        payload: Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(null, false, true),
        state: Validate.alternatives(Validate.object(), Validate.array(), Validate.function()).allow(null, false, true),
        failAction: internals.failAction,
        errorFields: Validate.object(),
        options: Validate.object().default(),
        validator: Validate.object()
    })
        .default()
});


internals.server = Validate.object({
    address: Validate.string().hostname(),
    app: Validate.object().allow(null),
    autoListen: Validate.boolean(),
    cache: Validate.allow(null),                                 // Validated elsewhere
    compression: Validate.object({
        minBytes: Validate.number().min(1).integer().default(1024)
    })
        .allow(false)
        .default(),
    debug: Validate.object({
        request: Validate.array().items(Validate.string()).single().allow(false).default(['implementation']),
        log: Validate.array().items(Validate.string()).single().allow(false)
    })
        .allow(false)
        .default(),
    host: Validate.string().hostname().allow(null),
    info: Validate.object({
        remote: Validate.boolean().default(false)
    })
        .default({}),
    listener: Validate.any(),
    load: Validate.object({
        sampleInterval: Validate.number().integer().min(0).default(0)
    })
        .unknown()
        .default(),
    mime: Validate.object().empty(null).default(),
    operations: Validate.object({
        cleanStop: Validate.boolean().default(true)
    })
        .default(),
    plugins: Validate.object(),
    port: Validate.alternatives([
        Validate.number().integer().min(0),          // TCP port
        Validate.string().pattern(/\//),               // Unix domain socket
        Validate.string().pattern(/^\\\\\.\\pipe\\/)   // Windows named pipe
    ])
        .allow(null),
    query: Validate.object({
        parser: Validate.function()
    })
        .default(),
    router: Validate.object({
        isCaseSensitive: Validate.boolean().default(true),
        stripTrailingSlash: Validate.boolean().default(false)
    })
        .default(),
    routes: internals.routeBase.default(),
    state: Validate.object(),                                    // Cookie defaults
    tls: Validate.alternatives([
        Validate.object().allow(null),
        Validate.boolean()
    ]),
    uri: Validate.string().pattern(/[^/]$/)
});


internals.vhost = Validate.alternatives([
    Validate.string().hostname(),
    Validate.array().items(Validate.string().hostname()).min(1)
]);


internals.handler = Validate.alternatives([
    Validate.function(),
    Validate.object().length(1)
]);


internals.route = Validate.object({
    method: Validate.string().pattern(/^[a-zA-Z0-9!#\$%&'\*\+\-\.^_`\|~]+$/).required(),
    path: Validate.string().required(),
    rules: Validate.object(),
    vhost: internals.vhost,

    // Validated in route construction

    handler: Validate.any(),
    options: Validate.any(),
    config: Validate.any()               // Backwards compatibility
})
    .without('config', 'options');


internals.pre = [
    Validate.function(),
    Validate.object({
        method: Validate.alternatives(Validate.string(), Validate.function()).required(),
        assign: Validate.string(),
        mode: Validate.valid('serial', 'parallel'),
        failAction: internals.failAction
    })
];


internals.routeConfig = internals.routeBase.keys({
    description: Validate.string(),
    id: Validate.string(),
    isInternal: Validate.boolean(),
    notes: [
        Validate.string(),
        Validate.array().items(Validate.string())
    ],
    pre: Validate.array().items(...internals.pre.concat(Validate.array().items(...internals.pre).min(1))),
    tags: [
        Validate.string(),
        Validate.array().items(Validate.string())
    ]
});


internals.cacheConfig = Validate.alternatives([
    Validate.function(),
    Validate.object({
        name: Validate.string().invalid('_default'),
        shared: Validate.boolean(),
        provider: [
            Validate.function(),
            {
                constructor: Validate.function().required(),
                options: Validate.object({
                    partition: Validate.string().default('hapi-cache')
                })
                    .unknown()      // Catbox client validates other keys
                    .default({})
            }
        ],
        engine: Validate.object()
    })
        .xor('provider', 'engine')
]);


internals.cache = Validate.array().items(internals.cacheConfig).min(1).single();


internals.cachePolicy = Validate.object({
    cache: Validate.string().allow(null).allow(''),
    segment: Validate.string(),
    shared: Validate.boolean()
})
    .unknown();                     // Catbox policy validates other keys


internals.method = Validate.object({
    bind: Validate.object().allow(null),
    generateKey: Validate.function(),
    cache: internals.cachePolicy
});


internals.methodObject = Validate.object({
    name: Validate.string().required(),
    method: Validate.function().required(),
    options: Validate.object()
});


internals.register = Validate.object({
    once: true,
    routes: Validate.object({
        prefix: Validate.string().pattern(/^\/.+/),
        vhost: internals.vhost
    })
        .default({})
});


internals.semver = Validate.string();


internals.plugin = internals.register.keys({
    options: Validate.any(),
    plugin: Validate.object({
        register: Validate.function().required(),
        name: Validate.string().when('pkg.name', { is: Validate.exist(), otherwise: Validate.required() }),
        version: Validate.string(),
        multiple: Validate.boolean().default(false),
        dependencies: [
            Validate.array().items(Validate.string()).single(),
            Validate.object().pattern(/.+/, internals.semver)
        ],
        once: true,
        requirements: Validate.object({
            hapi: Validate.string(),
            node: Validate.string()
        })
            .default(),
        pkg: Validate.object({
            name: Validate.string(),
            version: Validate.string().default('0.0.0')
        })
            .unknown()
            .default({})
    })
        .unknown()
})
    .without('once', 'options')
    .unknown();


internals.rules = Validate.object({
    validate: Validate.object({
        schema: Validate.alternatives(Validate.object(), Validate.array()).required(),
        options: Validate.object()
            .default({ allowUnknown: true })
    })
});
