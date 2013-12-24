// Load modules

var State = require('../state');
var Utils = require('../utils');
var Auth = null;                        // Delay load due to circular dependencies


// Declare internals

var internals = {};


exports.apply = function (request, next) {

    var response = request.response;
    if (response._payload.size &&
        typeof response._payload.size === 'function') {

        response._header('content-length', response._payload.size(), { override: false });
    }

    if (response.settings.location) {
        response._header('location', internals.location(response.settings.location, request));
    }
    
    internals.cors(response, request);
    internals.content(response, request);
    internals.state(response, request, function (err) {

        if (err) {
            return next(err);
        }

        internals.cache(response, request);
        internals.auth(request, next);              // Must be last in case requires access to headers
    });
};


internals.location = function (uri, request) {

    var isAbsolute = (uri.match(/^\w+\:\/\//));
    var baseUri = request.server.settings.location || (request.server.info.protocol + '://' + (request.info.host || (request.server.info.host + ':' + request.server.info.port)));
    return (isAbsolute || !baseUri ? uri : baseUri + (uri.charAt(0) === '/' ? '' : '/') + uri);
};


internals.cache = function (response, request) {

    if (response.statusCode !== 200) {
        response._header('cache-control', 'no-cache');
    }
    else if (!response.headers['cache-control'] ||
        response.settings.ttl !== null) {

        var ttl = (response.settings.ttl !== null ? response.settings.ttl
                                                  : (request.route.cache ? request._route.cache.ttl() : 0));
        if (ttl) {
            var privacy = (request.auth.isAuthenticated || response.headers['set-cookie'] ? 'private' : (request.route.cache && request.route.cache.privacy) || 'default');
            response._header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
        }
        else if (!response._payload.headers ||                 // Pass-through
            !response._payload.headers['cache-control']) {

            response._header('cache-control', 'no-cache');
        }
    }
};


internals.cors = function (response, request) {

    var cors = request.server.settings.cors;
    if (cors &&
        request.route.cors !== false) {     // Defaults to true (when null)

        if (cors._origin &&
            !response.headers['access-control-allow-origin']) {

            if (cors._origin.any) {
                response._header('access-control-allow-origin', '*');
            }
            else if (cors.matchOrigin) {
                response.vary('origin');
                if (internals.matchOrigin(request.headers.origin, cors)) {
                    response._header('access-control-allow-origin', request.headers.origin);
                }
                else if (cors._origin.qualifiedString && cors.isOriginExposed) {
                    response._header('access-control-allow-origin', cors._origin.qualifiedString);
                }
            }
            else {
                response._header('access-control-allow-origin', cors._origin.qualifiedString);
            }
        }

        response._header('access-control-max-age', cors.maxAge, { override: false });
        response._header('access-control-allow-methods', cors._methods, { override: false });
        response._header('access-control-allow-headers', cors._headers, { override: false });
        response._header('access-control-expose-headers', cors._exposedHeaders, { override: false });

        if (cors.credentials) {
            response._header('access-control-allow-credentials', 'true', { override: false });
        }
    }
};


internals.matchOrigin = function (origin, cors) {

    if (!origin) {
        return false;
    }

    if (cors._origin.qualified.indexOf(origin) !== -1) {
        return true;
    }

    for (var i = 0, il = cors._origin.wildcards.length; i < il; ++i) {
        if (origin.match(cors._origin.wildcards[i])) {
            return true;
        }
    }

    return false;
};


internals.content = function (response, request) {

    var type = response.headers['content-type'];
    if (type &&
        type.match(/^(?:text\/)|(?:application\/(?:json)|(?:javascript))/)) {

        var hasParams = (type.indexOf(';') !== -1);
        if (!hasParams ||
            !type.match(/[; ]charset=/)) {

            response.type(type + (hasParams ? ', ' : '; ') + 'charset=' + (response.settings.charset));
        }
    }
};


internals.state = function (response, request, next) {

    var names = {};
    var states = [];

    var keys = Object.keys(request._states);
    for (var i = 0, il = keys.length; i < il; ++i) {
        var name = keys[i];
        if (!names[name]) {
            names[name] = true;
            states.push(request._states[name]);
        }
    }

    keys = Object.keys(request.server._stateDefinitions);
    for (i = 0, il = keys.length; i < il; ++i) {
        var name = keys[i];
        if (request.server._stateDefinitions[name].autoValue &&
            !names[name]) {

            names[name] = true;
            states.push({ name: name, value: request.server._stateDefinitions[name].autoValue });
        }
    }

    if (!states.length) {
        return next();
    }

    State.generateSetCookieHeader(states, request.server._stateDefinitions, function (err, header) {

        if (err) {
            return next(err);
        }

        var existing = response.headers['set-cookie'];
        if (existing) {
            header = (Array.isArray(existing) ? existing : [existing]).concat(header);
        }

        response._header('set-cookie', header);
        return next();
    });
};


internals.auth = function (request, next) {

    Auth = Auth || require('../auth');
    Auth.response(request, next);
};

