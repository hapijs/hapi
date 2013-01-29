// Load modules

var State = require('../state');


// Declare internals

var internals = {};


exports.cache = function (response, request) {

    var ttl = response.getTtl();

    // Check policy

    if (request._route.cache.isMode('client')) {
        if (ttl === null || ttl === undefined) {
            ttl = request._route.cache.ttl();
        }
    }
    else {
        ttl = 0;
    }

    // Set header

    if (ttl) {
        var privacy = request._route.cache.rule.privacy;
        response.header('Cache-Control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
    }
    else {
        response.header('Cache-Control', 'no-cache');
    }
};


exports.cors = function (response, request) {

    if (request.server.settings.cors) {
        response.header('Access-Control-Allow-Origin', request.server.settings.cors._origin);
        response.header('Access-Control-Max-Age', request.server.settings.cors.maxAge);
        response.header('Access-Control-Allow-Methods', request.server.settings.cors._methods);
        response.header('Access-Control-Allow-Headers', request.server.settings.cors._headers);

        if (request.server.settings.cors.credentials) {
            response.header('Access-Control-Allow-Credentials', 'true');
        }
    }
};


exports.location = function (uri, request) {

    var isAbsolute = (uri.indexOf('http://') === 0 || uri.indexOf('https://') === 0);
    return (isAbsolute ? uri : request.server.settings.uri + (uri.charAt(0) === '/' ? '' : '/') + uri);
};


exports.state = function (response, request, callback) {

    if (!response._states.length) {
        return callback();
    }

    State.generateSetCookieHeader(response._states, request.server._stateDefinitions, function (err, header) {

        if (err) {
            return callback(err);
        }

        response.header('Set-Cookie', header);
        return callback();
    });
};

