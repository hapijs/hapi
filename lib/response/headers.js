// Load modules

var State = require('../state');
var Utils = require('../utils');
var Auth = null;                        // Delay load due to circular dependencies


// Declare internals

var internals = {};


exports.location = function (uri, request) {

    var isAbsolute = (uri.match(/^\w+\:\/\//));
    var baseUri = request.server.settings.location || (request.server.info.protocol + '://' + (request.info.host || (request.server.info.host + ':' + request.server.info.port)));
    return (isAbsolute || !baseUri ? uri : baseUri + (uri.charAt(0) === '/' ? '' : '/') + uri);
};


exports.cache = function (response, request, passThrough) {

    var ttl = response.getTtl();

    // Check policy

    if (request.route.cache.mode.client) {
        if (ttl === null ||
            ttl === undefined) {

            ttl = request._route.cache.ttl();
        }
    }
    else {
        ttl = 0;
    }

    // Set header

    if (ttl) {
        var privacy = request.route.cache.privacy;
        response.header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
    }
    else if (!passThrough) {
        response.header('cache-control', 'no-cache');
    }
};


exports.cors = function (response, request) {

    var cors = request.server.settings.cors;
    if (!cors ||
        request.route.cors === false) {     // Defaults to true (when null)

        return;
    }

    if (cors._origin) {
        if (cors._origin.any) {
            response.header('access-control-allow-origin', '*');
        }
        else if (cors.matchOrigin) {
            response.header('vary', 'origin', true);
            if (internals.matchOrigin(request.headers.origin, cors)) {
                response.header('access-control-allow-origin', request.headers.origin);
            }
            else if (cors._origin.qualifiedString && cors.isOriginExposed) {
                response.header('access-control-allow-origin', cors._origin.qualifiedString);
            }
        }
        else {
            response.header('access-control-allow-origin', cors._origin.qualifiedString);
        }
    }

    response.header('access-control-max-age', cors.maxAge);
    response.header('access-control-allow-methods', cors._methods);
    response.header('access-control-allow-headers', cors._headers);
    response.header('access-control-expose-headers', cors._exposedHeaders);

    if (cors.credentials) {
        response.header('access-control-allow-credentials', 'true');
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


exports.content = function (response, request) {

    var type = response._headers['content-type'];
    if (!type) {
        return;
    }

    var hasParams = (type.indexOf(';') !== -1);
    if (hasParams &&
        type.match(/[; ]charset=/)) {

        return;
    }

    response._headers['content-type'] = type + (hasParams ? ', ' : '; ') + 'charset=' + (response._flags.charset || 'utf-8');
};


exports.state = function (response, request, callback) {

    // Merge response cookies with request cookies (set while response wasn't ready)

    var names = {};
    var states = [];

    var keys = Object.keys(response._states);
    for (var i = 0, il = keys.length; i < il; ++i) {
        var name = keys[i];
        names[name] = true;
        states.push(response._states[name]);
    }

    keys = Object.keys(request._states);
    for (i = 0, il = keys.length; i < il; ++i) {
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
        return Utils.nextTick(callback)();
    }

    State.generateSetCookieHeader(states, request.server._stateDefinitions, function (err, header) {

        if (err) {
            return callback(err);
        }

        response.header('set-cookie', header);
        return callback();
    });
};


exports.auth = function (response, request, callback) {

    Auth = Auth || require('../auth');
    Auth.responseHeader(request, response, callback);
};

