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

        onRequest: null,               // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreHandler: null,            // After validation and body parsing, before route handler
        onPostHandler: null,           // After route handler returns, before sending response
        onPostRoute: null,             // After response sent

        // function (request) { request.reply(result); OR request.close(); }
        onUnknownRoute: null           // Overrides hapi's default handler for unknown route. Cannot be an array!
    },

    // Optional components
    // false -> null, true -> defaults, {} -> override defaults

    monitor: false,             // Process monitoring (defaults: exports.monitor)
    authentication: false,      // Authentication (defaults: exports.authentication)
    cache: false,               // Caching (defaults: exports.cache)
    debug: false                // Debugging interface (defaults: exports.debug)
};


// Process monitoring

exports.monitor = {
    broadcastInterval: 0,                       // MSec, 0 for immediately
    opsInterval: 15000,                         // MSec, equalt to or greater than 100
    extendedRequests: false,
    subscribers: {
        console: ['ops', 'request', 'log']
    }
};


// Authentication configuration

exports.authentication = {
    loadClientFunc: null,
    loadUserFunc: null,
    extensionFunc: null,
    checkAuthorizationFunc: null,

    tokenEndpoint: '/oauth/token',
    defaultAlgorithm: 'hmac-sha-1',
    tokenLifetimeSec: 1209600,                  // Two weeks

    aes256Keys: {
        oauthRefresh: null,
        oauthToken: null
    },
    tos: {
        min: 'none'         // Format: YYYYMMDD (e.g. '19700101')
    }
};


// Cache configuration

exports.cache = {
    engine: 'redis',
    host: '127.0.0.1',
    port: 6379
};


// Debug interface

exports.debug = {
    websocketPort: 3000,
    debugEndpoint: '/debug/console',
    queryKey: 'debug'
};

