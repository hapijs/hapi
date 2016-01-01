'use strict';

// Load modules

const Joi = require('joi');
const Hoek = require('hoek');


// Declare internals

const internals = {};


exports.apply = function (type, options, message) {

    const result = Joi.validate(options, internals[type]);
    Hoek.assert(!result.error, 'Invalid', type, 'options', message ? '(' + message + ')' : '', result.error && result.error.annotate());
    return result.value;
};


internals.cache = Joi.object({
    name: Joi.string().invalid('_default'),
    partition: Joi.string(),
    shared: Joi.boolean(),
    engine: Joi.alternatives([
        Joi.object(),
        Joi.func()
    ])
        .required()
}).unknown();


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
        sandbox: Joi.string().valid('connection', 'plugin')
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
        statuses: Joi.array().items(Joi.number().integer().min(200)).min(1)
    }),
    cors: Joi.object({
        origin: Joi.array().min(1),
        maxAge: Joi.number(),
        headers: Joi.array().items(Joi.string()),
        additionalHeaders: Joi.array().items(Joi.string()),
        exposedHeaders: Joi.array().items(Joi.string()),
        additionalExposedHeaders: Joi.array().items(Joi.string()),
        credentials: Joi.boolean()
    })
        .allow(false, true),
    ext: Joi.object({
        onPreAuth: Joi.array().items(internals.event).single(),
        onPostAuth: Joi.array().items(internals.event).single(),
        onPreHandler: Joi.array().items(internals.event).single(),
        onPostHandler: Joi.array().items(internals.event).single(),
        onPreResponse: Joi.array().items(internals.event).single()
    })
        .default({}),
    files: Joi.object({
        relativeTo: Joi.string().regex(/^([\/\.])|([A-Za-z]:\\)|(\\\\)/).required()
    }),
    json: Joi.object({
        replacer: Joi.alternatives(Joi.func(), Joi.array()).allow(null),
        space: Joi.number().allow(null),
        suffix: Joi.string().allow(null)
    }),
    jsonp: Joi.string(),
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
        failAction: Joi.string().valid('error', 'log', 'ignore'),
        timeout: Joi.number().integer().positive().allow(false),
        defaultContentType: Joi.string()
    }),
    plugins: Joi.object(),
    response: Joi.object({
        emptyStatusCode: Joi.number().valid(200, 204),
        schema: Joi.alternatives(Joi.object(), Joi.func()).allow(true, false),
        status: Joi.object().pattern(/\d\d\d/, Joi.alternatives(Joi.object(), Joi.func()).allow(true, false)),
        sample: Joi.number().min(0).max(100),
        failAction: Joi.string().valid('error', 'log'),
        modify: Joi.boolean(),
        options: Joi.object()
    })
        .without('modify', 'sample')
        .assert('options.stripUnknown', Joi.ref('modify'), 'meet requirement of having peer modify set to true'),
    security: Joi.object({
        hsts: [
            Joi.object({
                maxAge: Joi.number(),
                includeSubdomains: Joi.boolean(),
                includeSubDomains: Joi.boolean(),
                preload: Joi.boolean()
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
    })
        .allow(null, false, true),
    state: Joi.object({
        parse: Joi.boolean(),
        failAction: Joi.string().valid('error', 'log', 'ignore')
    }),
    timeout: Joi.object({
        socket: Joi.number().integer().positive().allow(false),
        server: Joi.number().integer().positive().allow(false).required()
    }),
    validate: Joi.object({
        headers: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        params: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        query: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        payload: Joi.alternatives(Joi.object(), Joi.func()).allow(null, false, true),
        failAction: [
            Joi.string().valid('error', 'log', 'ignore'),
            Joi.func()
        ],
        errorFields: Joi.object(),
        options: Joi.object()
    })
});


internals.connectionBase = Joi.object({
    app: Joi.object().allow(null),
    compression: Joi.boolean(),
    load: Joi.object(),
    plugins: Joi.object(),
    router: Joi.object({
        isCaseSensitive: Joi.boolean(),
        stripTrailingSlash: Joi.boolean()
    }),
    routes: internals.routeBase,
    state: Joi.object()                                     // Cookie defaults
});


internals.server = Joi.object({
    app: Joi.object().allow(null),
    cache: Joi.alternatives([
        Joi.func(),
        internals.cache,
        Joi.array().items(internals.cache).min(1)
    ]).allow(null),
    connections: internals.connectionBase,
    debug: Joi.object({
        request: Joi.array().allow(false),
        log: Joi.array().allow(false)
    }).allow(false),
    load: Joi.object(),
    mime: Joi.object(),
    plugins: Joi.object(),
    useDomains: Joi.boolean()
});


internals.connection = internals.connectionBase.keys({
    autoListen: Joi.boolean(),
    host: Joi.string().hostname(),
    address: Joi.string().hostname(),
    labels: Joi.array().items(Joi.string()).single(),
    listener: Joi.any(),
    port: Joi.alternatives([
        Joi.number().integer().min(0),          // TCP port
        Joi.string().regex(/\//),               // Unix domain socket
        Joi.string().regex(/^\\\\\.\\pipe\\/)   // Windows named pipe
    ])
        .allow(null),
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


internals.routeConfig = internals.routeBase.keys({
    id: Joi.string(),
    isInternal: Joi.boolean(),
    pre: Joi.array().items(internals.pre.concat(Joi.array().items(internals.pre).min(1))),
    handler: [
        Joi.func(),
        Joi.string(),
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


internals.cachePolicy = Joi.object({
    cache: Joi.string().allow(null).allow(''),
    segment: Joi.string(),
    shared: Joi.boolean()
})
    .options({ allowUnknown: true });               // Catbox validates other keys


internals.method = Joi.object({
    bind: Joi.object().allow(null),
    generateKey: Joi.func(),
    cache: internals.cachePolicy,
    callback: Joi.boolean()
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
        .default({}),
    select: Joi.array().items(Joi.string()).single()
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
            connections: Joi.boolean().default(true),
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
