exports.settings = {
    router: {
        isTrailingSlashSensitive: false,
        isCaseSensitive: true
    },
    payload: {
        maxBytes: 1024 * 1024
    },
    cors: {
        origin: ['*'],
        maxAge: 86400,
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
    ext: {
        onRequest: null,
        onPreHandler: null,
        onPostHandler: null,
        onPostRoute: null,
        onUnknownRoute: null
    },
    errors: {
        format: null
    },
    monitor: false,
    authentication: false,
    cache: false,
    debug: false,
    docs: false
};