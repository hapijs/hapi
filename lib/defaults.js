// Load modules

var Utils = require('./utils');


// Declare internals

var internals = {};


// Server configuration

exports.server = {

    name: '',                                       // Defaults to 'host:port'

    // TLS

    // tls: {
    //
    //     key: '',
    //     cert: ''
    // },

    // Router

    router: {
        isTrailingSlashSensitive: false,            // Tread trailing '/' in path as different resources
        isCaseSensitive: true                       // Case-seinsitive paths
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

    // Errors

    errors: {
        format: null            // function (result, callback) { callback(formatted_error); } - Overrides the built-in error response format (object or html string)
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


// Cache configuration

exports.cache = function (engine) {

    if (engine !== null && typeof engine === 'object') {
        engine = engine.engine;
    }

    if (engine === false) {
        return null;
    }

    Utils.assert(engine === 'redis' || engine === 'mongodb' || engine === 'memory', 'Unknown cache engine type: ' + engine);

    var config = {
        engine: engine,
        partition: 'hapi-cache'
    };

    if (engine === 'redis') {
        config.host = '127.0.0.1';
        config.port = 6379;
    }
    else if (engine === 'mongodb') {
        config.host = '127.0.0.1';
        config.port = 27017;
        config.poolSize = 5;
    }

    return config;
};


// Debug interface

exports.debug = {
    debugEndpoint: '/debug/console',
    queryKey: 'debug'
};


// Documentation interface

exports.docs = {
    docsEndpoint: '/docs'
};


// Batch interface

exports.batch = {
    batchEndpoint: '/batch'
};