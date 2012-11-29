// Load modules

//var Cacheable = require('./cacheable');

// Declare internals

var internals = {};


exports.cache = function (response, request) {

    // Caching headers

    if ((!request._route && response._flags.ttl) ||                                                    // No policy, manually set
        (request._route && request._route.cache.isMode('client') && response._flags.ttl !== 0) &&      // Policy, not manually off
        (/*response instanceof Cacheable &&*/ response._code === 200)) {                                    // Only cache responses that are cacheable

        if (!response._flags.ttl) {
            response._flags.ttl = request._route.cache.ttl();
        }

        response.header('Cache-Control', 'max-age=' + Math.floor(response._flags.ttl / 1000) + ', must-revalidate');
    }
    else {
        response.header('Cache-Control', 'no-cache');
    }
};


exports.cors = function (response, request) {

    if (request.server.settings.cors &&
        (!request._route || request._route.config.cors !== false)) {

        response.header('Access-Control-Allow-Origin', request.server.settings.cors._origin);
        response.header('Access-Control-Max-Age', request.server.settings.cors.maxAge);
        response.header('Access-Control-Allow-Methods', request.server.settings.cors._methods);
        response.header('Access-Control-Allow-Headers', request.server.settings.cors._headers);
    }
};


exports.location = function (uri, request) {

    var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
    return (isAbsolute ? uri : request.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
};


