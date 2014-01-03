// Load modules

var State = require('../state');
var Utils = require('../utils');
var Auth = null;                        // Delay load due to circular dependencies


// Declare internals

var internals = {};


exports.apply = function (response, request, next) {

    if (response._payload.size &&
        typeof response._payload.size === 'function') {

        response._header('content-length', response._payload.size());
    }

    if (response.settings.location) {
        response._header('location', internals.location(response.settings.location, request));
    }
    
    internals.cache(response, request);
    internals.cors(response, request);
    internals.content(response, request);
    internals.state(response, request, function (err) {

        if (err) {
            return next(err);
        }

        internals.auth(response, request, next);
    });
};


internals.location = function (uri, request) {

    var isAbsolute = (uri.match(/^\w+\:\/\//));
    var baseUri = request.server.settings.location || (request.server.info.protocol + '://' + (request.info.host || (request.server.info.host + ':' + request.server.info.port)));
    return (isAbsolute || !baseUri ? uri : baseUri + (uri.charAt(0) === '/' ? '' : '/') + uri);
};


internals.cache = function (response, request) {

    // Check policy

    var ttl = response.statusCode === 200 ? response.settings.ttl : 0;
    if (request.route.cache &&
        ttl === null) {

        ttl = request._route.cache.ttl();
    }

    // Set header

    if (ttl) {
        var privacy = (request.route.cache && request.route.cache.privacy) || 'default';
        response._header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
    }
    else if ((!response._payload.headers ||                 // Pass-through
        !response._payload.headers['cache-control'])) {

        response._header('cache-control', 'no-cache');
    }
};


internals.cors = function (response, request) {

    var cors = request.server.settings.cors;
    if (cors &&
        request.route.cors !== false) {     // Defaults to true (when null)

        if (cors._origin) {
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

        response._header('access-control-max-age', cors.maxAge);
        response._header('access-control-allow-methods', cors._methods);
        response._header('access-control-allow-headers', cors._headers);
        response._header('access-control-expose-headers', cors._exposedHeaders);

        if (cors.credentials) {
            response._header('access-control-allow-credentials', 'true');
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

    // Merge response cookies with request cookies (set while response wasn't ready)

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

        response._header('set-cookie', header);
        return next();
    });
};


internals.auth = function (response, request, next) {

    Auth = Auth || require('../auth');
    Auth.response(request, response, next);
};

