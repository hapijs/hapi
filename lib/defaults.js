// Load modules

var Os = require('os');


// Declare internals

var internals = {};


// Server configuration

exports.server = {

    // TLS

    // tls: {
    //
    //     key: '',
    //     cert: ''
    // },

    maxSockets: Infinity,                           // Sets http/https globalAgent maxSockets value. null is node default.

    // Router

    router: {
        isCaseSensitive: true,                      // Case-sensitive paths
        stripTrailingSlash: false                   // Remove trailing slash from incoming paths
    },

    // State

    state: {
        cookies: {
            parse: true,                            // Parse content of req.headers.cookie
            failAction: 'error',                    // Action on bad cookie - 'error': return 400, 'log': log and continue, 'ignore': continue
            clearInvalid: false,                    // Automatically instruct the client to remove the invalid cookie
            strictHeader: true                      // Require an RFC 6265 compliant header format
        }
    },

    // Location

    location: '',                                   // Base uri used to prefix non-absolute outgoing Location headers ('http://example.com:8080'). Must not contain trailing '/'.

    // Cache header

    cacheControlStatus: [200],                      // Array of HTTP statuc codes for which cache-control header is set

    // Payload

    payload: {
        maxBytes: 1024 * 1024,
        uploads: Os.tmpDir()
    },

    // Validation

    validation: null,                               // Joi validation options

    // JSON

    json: {
        replacer: null,
        space: null,
        suffix: null
    },

    // Files path

    files: {
        relativeTo: '.',                            // Determines what file and directory handlers use to base relative paths off
        etagsCacheMaxSize: 10000                    // Maximum number of etags in the cache
    },

    // timeout limits

    timeout: {
        socket: undefined,                          // Determines how long before closing request socket. Defaults to node (2 minutes)
        client: 10 * 1000,                          // Determines how long to wait for receiving client payload. Defaults to 10 seconds
        server: false                               // Determines how long to wait for server request processing. Disabled by default
    },

    // Debug

    debug: {
        request: ['implementation']
    },

    // Pack

    labels: [],                                     // Server pack labels

    // Optional components

    cors: false,                                    // CORS headers on responses and OPTIONS requests (defaults: exports.cors): false -> null, true -> defaults, {} -> override defaults
    security: false                                 // Security headers on responses (defaults exports.security): false -> null, true -> defaults, {} -> override defaults
};


// CORS

exports.cors = {
    origin: ['*'],
    isOriginExposed: true,                          // Return the list of supported origins if incoming origin does not match
    matchOrigin: true,                              // Attempt to match incoming origin against allowed values and return narrow response
    maxAge: 86400,                                  // One day
    headers: [
        'Authorization',
        'Content-Type',
        'If-None-Match'
    ],
    additionalHeaders: [],
    methods: [
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],
    additionalMethods: [],
    exposedHeaders: [
        'WWW-Authenticate',
        'Server-Authorization'
    ],
    additionalExposedHeaders: [],
    credentials: false
};


// Security headers

exports.security = {
    hsts: 15768000,
    xframe: 'deny',
    xss: true,
    noOpen: true,
    noSniff: true
};
