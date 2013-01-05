// Load modules

var Utils = require('./utils');


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

    // Router

    router: {
        isTrailingSlashSensitive: false,            // Treat trailing '/' in path as different resources
        isCaseSensitive: true,                      // Case-seinsitive paths
        normalizeRequestPath: false                 // Normalize incoming request path (Uppercase % encoding and decode non-reserved encoded characters)
    },

    // State

    state: {
        cookies: {
            parse: true,                            // Parse content of req.headers.cookie
            parseValues: true,                      // Attempt to parse cookie-pairs values (percent-decode and JSON parse)
            failAction: 'error'                     // Action on bad cookie - 'error': return 400, 'log': log and continue, 'ignore': continue
        }
    },

    // Payload

    payload: {
        maxBytes: 1024 * 1024
    },

    // CORS

    cors: {
        origin: ['*'],
        maxAge: 86400,                              // One day
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
            'DELETE',
            'OPTIONS'
        ],
        additionalMethods: []
    },

    // Extensions

    ext: {

        // The following extension functions use the following signature:
        // function (request, next) { next(); }

        onRequest: null,                            // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreHandler: null,                         // After validation and body parsing, before route handler
        onPostHandler: null,                        // After route handler returns, before sending response
        onPostRoute: null,                          // After response sent

        // function (request) { request.reply(result); OR request.reply.close(); }
        onUnknownRoute: null                        // Overrides hapi's default handler for unknown route. Cannot be an array!
    },

    // Response formatter

    format: {
        error: null,                                // function (error) { return { code, payload, type, headers }; }
        payload: null                               // function (payload) { return formattedPayload; }
    },

    // Files path

    files: {
        relativeTo: 'routes'                        // Determines what file and directorie handlers use to base relative paths off: 'routes', 'process'
    },

    // Optional components
    // false -> null, true -> defaults, {} -> override defaults

    monitor: false,                                 // Process monitoring (defaults: exports.monitor)
    cache: false,                                   // Caching (defaults: exports.cache)
    debug: false,                                   // Debugging interface (defaults: exports.debug)
    docs: false,                                    // Documentation generator (defaults: exports.docs)
    batch: false,                                   // Batch interface (defaults: exports.batch)

    auth: null                                      // Authentication
};


// Process monitoring

exports.monitor = {
    broadcastInterval: 0,                           // MSec, 0 for immediately
    opsInterval: 15000,                             // MSec, equalt to or greater than 100
    extendedRequests: false,
    requestsEvent: 'tail',                          // Sets the event used by the monitor to listen to finished requests. Other options: 'response'.
    subscribers: {
        console: ['ops', 'request', 'log']
    }
};


// Debug interface

exports.debug = {
    debugEndpoint: '/debug/console',
    queryKey: 'debug'
};


// Batch interface

exports.batch = {
    batchEndpoint: '/batch'
};