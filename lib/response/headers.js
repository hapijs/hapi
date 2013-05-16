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


exports.cache = function (response, request) {

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
        response.header('Cache-Control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
    }
    else {
        response.header('Cache-Control', 'no-cache');
    }
};


exports.cors = function (response, request) {

    if (!request.server.settings.cors) {
        return;
    }

    if (request.server.settings.cors.origin &&
        request.server.settings.cors.origin.length) {

        var allowOrigin = request.server.settings.cors.origin;
        var origin = request.raw.req.headers.origin;
        if (origin &&
            (allowOrigin.indexOf(origin) !== -1 || allowOrigin.indexOf('*') !== -1)) {

            allowOrigin = origin;
        }
        else {
            allowOrigin = allowOrigin.join(' ');
        }

        response.header('Access-Control-Allow-Origin', allowOrigin);
    }

    response.header('Access-Control-Max-Age', request.server.settings.cors.maxAge);
    response.header('Access-Control-Allow-Methods', request.server.settings.cors._methods);
    response.header('Access-Control-Allow-Headers', request.server.settings.cors._headers);
    response.header('Access-Control-Expose-Headers', request.server.settings.cors._exposedHeaders);

    if (request.server.settings.cors.credentials) {
        response.header('Access-Control-Allow-Credentials', 'true');
    }
};


exports.content = function (response, request) {

    var type = response._headers['Content-Type'];
    if (!type) {
        return;
    }

    var hasParams = (type.indexOf(';') !== -1);
    if (hasParams &&
        type.match(/[; ]charset=/)) {

        return;
    }

    response._headers['Content-Type'] = type + (hasParams ? ', ' : '; ') + 'charset=' + response._flags.encoding;
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

        response.header('Set-Cookie', header);
        return callback();
    });
};


exports.auth = function (response, request, callback) {

    Auth = Auth || require('../auth');
    Auth.responseHeader(request, response, callback);
};

