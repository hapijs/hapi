// Load modules

var State = require('../state');


// Declare internals

var internals = {};


exports.cache = function (response, request) {

    var ttl = response.getTtl();

    // Check policy

    if (request._route) {
        if (request._route.cache.isMode('client')) {
            if (ttl === null || ttl === undefined) {
                ttl = request._route.cache.ttl();
            }
        }
        else {
            ttl = 0;
        }
    }

    // Set header

    if (ttl) {
        response.header('Cache-Control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate');
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


exports.state = function (response, request) {

    if (!response._states.length) {
        return;
    }

    var setCookie = State.generateSetCookieHeader(response._states, request.server._stateDefinitions);
    if (setCookie instanceof Error) {
        return setCookie;
    }

    response.header('Set-Cookie', setCookie);
};