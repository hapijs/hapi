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
        maxAge: 86400                               // One day
    },

    // Extensions

    ext: {

        // All extension functions use the following signature:
        // function (request, next) { next(); }

        onRequest: null,               // New request, before handing over to the router (allows changes to the request method, url, etc.)
        onPreHandler: null,            // After validation and body parsing, before route handler
        onPostHandler: null,           // After route handler returns, before setting response
        onPostRoute: null,             // After response sent

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
    opsInterval: 15000,
    ops: [],                                    // ['http://localhost/hapi'],
    requests: [],                               // ['http://localhost/hapi'],
    log: []                                     // ['http://localhost/hapi']
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

