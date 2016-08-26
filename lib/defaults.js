'use strict';

// Load modules

const Os = require('os');


// Declare internals

const internals = {};


exports.server = {
    debug: {
        request: ['implementation'],
        log: ['implementation']
    },
    load: {
        sampleInterval: 0
    },
    mime: null,                                     // Mimos options
    useDomains: true
};


exports.connection = {
    compression: true,                              // Enable response compression
    router: {
        isCaseSensitive: true,                      // Case-sensitive paths
        stripTrailingSlash: false                   // Remove trailing slash from incoming paths
    },
    routes: {
        cache: {
            statuses: [200, 204],                   // Array of HTTP status codes for which cache-control header is set
            otherwise: 'no-cache'
        },
        compression: {},
        cors: false,                                // CORS headers
        files: {
            relativeTo: '.'                         // Determines what file and directory handlers use to base relative paths off
        },
        json: {
            replacer: null,
            space: null,
            suffix: null
        },
        log: false,                                 // Enables request level log collection
        payload: {
            failAction: 'error',
            maxBytes: 1024 * 1024,
            output: 'data',
            parse: true,
            timeout: 10 * 1000,                     // Determines how long to wait for receiving client payload. Defaults to 10 seconds
            uploads: Os.tmpDir(),
            defaultContentType: 'application/json',
            compression: {}
        },
        response: {
            ranges: true,
            emptyStatusCode: 200,                   // HTTP status code when payload is empty (200, 204)
            options: {}                             // Joi validation options
        },
        security: false,                            // Security headers on responses: false -> null, true -> defaults, {} -> override defaults
        state: {
            parse: true,                            // Parse content of req.headers.cookie
            failAction: 'error'                     // Action on bad cookie - 'error': return 400, 'log': log and continue, 'ignore': continue
        },
        timeout: {
            socket: undefined,                      // Determines how long before closing request socket. Defaults to node (2 minutes)
            server: false                           // Determines how long to wait for server request processing. Disabled by default
        },
        validate: {
            options: {}                             // Joi validation options
        }
    }
};


exports.security = {
    hsts: 15768000,
    xframe: 'deny',
    xss: true,
    noOpen: true,
    noSniff: true
};


exports.cors = {
    origin: ['*'],
    maxAge: 86400,                                  // One day
    headers: [
        'Accept',
        'Authorization',
        'Content-Type',
        'If-None-Match'
    ],
    additionalHeaders: [],
    exposedHeaders: [
        'WWW-Authenticate',
        'Server-Authorization'
    ],
    additionalExposedHeaders: [],
    credentials: false
};
