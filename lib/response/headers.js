// Load modules

var Boom = require('boom');
var Items = require('items');
var Statehood = require('statehood');
var Auth = null;                        // Delay load due to circular dependencies


// Declare internals

var internals = {};


exports.set = function (request, next) {

    var response = request.response;
    if (response._payload.size &&
        typeof response._payload.size === 'function') {

        response._header('content-length', response._payload.size(), { override: false });
    }

    if (response.settings.location) {
        response._header('location', exports.location(response.settings.location, request.server, request));
    }

    internals.cors(response, request);
    internals.security(response, request);
    internals.content(response);
    internals.state(response, request, function (err) {

        if (err) {
            return next(err);
        }

        internals.cache(response, request);
        internals.auth(request, next);              // Must be last in case requires access to headers
    });
};


exports.location = function (uri, server, request) {

    var isAbsolute = (uri.match(/^\w+\:\/\//));
    if (isAbsolute) {
        return uri;
    }

    var baseUri = server.settings.location || (server.info.protocol + '://' + ((request && request.info.host) || (server.info.host + ':' + server.info.port)));
    return baseUri + (uri.charAt(0) === '/' ? '' : '/') + uri;
};


internals.cache = function (response, request) {

    if (response.headers['cache-control']) {
        return;
    }

    if (request.server.settings._cacheControlStatus[response.statusCode] ||
        response.settings.ttl) {

        var ttl = (response.settings.ttl !== null ? response.settings.ttl
                                                  : (request.route.cache ? request._route._cache.ttl() : 0));
        if (ttl) {
            var privacy = (request.auth.isAuthenticated || response.headers['set-cookie'] ? 'private' : (request.route.cache && request.route.cache.privacy) || 'default');
            response._header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
        }
        else if (!response.settings.passThrough ||
            !response._payload.headers ||
            !response._payload.headers['cache-control']) {

            response._header('cache-control', 'no-cache');
        }
    }
    else {
        response._header('cache-control', 'no-cache');
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
                else if (cors.isOriginExposed) {
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

        if (cors._exposedHeaders.length !== 0) {
            response._header('access-control-expose-headers', cors._exposedHeaders, { override: false });
        }

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


internals.security = function (response, request) {

    var security = request.route.security === undefined ? request.server.settings.security : request.route.security;

    if (security) {
        if (security._hsts) {
            response._header('strict-transport-security', security._hsts, { override: false });
        }

        if (security._xframe) {
            response._header('x-frame-options', security._xframe, { override: false });
        }

        if (security.xss) {
            response._header('x-xss-protection', '1; mode=block', { override: false });
        }

        if (security.noOpen) {
            response._header('x-download-options', 'noopen', { override: false });
        }

        if (security.noSniff) {
            response._header('x-content-type-options', 'nosniff', { override: false });
        }
    }
};


internals.content = function (response) {

    var type = response.headers['content-type'];
    if (type &&
        response.settings.charset &&
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
        names[name] = true;
        states.push(request._states[name]);
    }

    keys = Object.keys(request.server._stateDefinitions.cookies);
    Items.parallel(keys, function (name, nextKey) {

        var autoValue = request.server._stateDefinitions.cookies[name].autoValue;
        if (!autoValue || names[name]) {
            return nextKey();
        }

        names[name] = true;

        if (typeof autoValue !== 'function') {
            states.push({ name: name, value: autoValue });
            return nextKey();
        }

        autoValue.call(null, request, function (err, value) {

            if (err) {
                return nextKey(Boom.wrap(err));
            }

            states.push({ name: name, value: value });
            return nextKey();
        });
    },
    function (err) {

        if (err) {
            return next(err);
        }

        if (!states.length) {
            return next();
        }

        Statehood.format(states, request.server._stateDefinitions, function (err, header) {

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
    });
};


internals.auth = function (request, next) {

    Auth = Auth || require('../auth');
    Auth.response(request, next);
};
