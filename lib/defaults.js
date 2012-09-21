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

    // Errors

    errors: {
        format: null            // function (result, callback) { callback(formatted_error); } - Overrides the built-in error response format (object or html string)
    },

    // Optional components
    // false -> null, true -> defaults, {} -> override defaults

    monitor: false,             // Process monitoring (defaults: exports.monitor)
    authentication: false,      // Authentication (defaults: exports.authentication)
    cache: false,               // Caching (defaults: exports.cache)
    debug: false,               // Debugging interface (defaults: exports.debug)
    docs: false                 // Documentation generator (defaults: exports.docs)
};


// Process monitoring

exports.monitor = {
    broadcastInterval: 0,                       // MSec, 0 for immediately
    opsInterval: 15000,                         // MSec, equalt to or greater than 100
    extendedRequests: false,
    requestsEvent: 'tail',                      // Sets the event used by the monitor to listen to finished requests. Other options: 'response'.
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


// Documentation interface

exports.docs = {
    docsEndpoint: '/docs',
    indexTemplatePath: __dirname + '/templates/index.html',
    routeTemplatePath: __dirname + '/templates/route.html'
};
