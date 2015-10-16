// Load modules

var Boom = require('boom');
var Hoek = require('hoek');
var Defaults = require('./defaults');
var Route = null;                           // Delayed load due to circular dependency


// Declare internals

var internals = {};


exports.route = function (options) {

    var settings = Hoek.applyToDefaults(Defaults.cors, options);
    if (!settings) {
        return false;
    }

    settings._headers = settings.headers.concat(settings.additionalHeaders);
    settings._headersString = settings._headers.join(',');
    settings._exposedHeaders = settings.exposedHeaders.concat(settings.additionalExposedHeaders).join(',');

    if (settings.origin.length) {
        settings._origin = {
            any: false,
            qualified: [],
            qualifiedString: '',
            wildcards: []
        };

        if (settings.origin.indexOf('*') !== -1) {
            Hoek.assert(settings.origin.length === 1, 'Cannot specify cors.origin * together with other values');
            settings._origin.any = true;
        }
        else {
            for (var c = 0, cl = settings.origin.length; c < cl; ++c) {
                var origin = settings.origin[c];
                if (origin.indexOf('*') !== -1) {
                    settings._origin.wildcards.push(new RegExp('^' + Hoek.escapeRegex(origin).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$'));
                }
                else {
                    settings._origin.qualified.push(origin);
                }
            }

            Hoek.assert(settings.matchOrigin || !settings._origin.wildcards.length, 'Cannot include wildcard origin values with matchOrigin disabled');
            settings._origin.qualifiedString = settings._origin.qualified.join(' ');
        }
    }

    return settings;
};


exports.headers = function (response, options) {

    var request = response.request;
    var settings = options || request.route.settings.cors;
    if (!settings) {
        return;
    }

    if (settings._origin &&
        (!response.headers['access-control-allow-origin'] || settings.override)) {

        if (settings.matchOrigin) {
            response.vary('origin');
            if (internals.matchOrigin(request.headers.origin, settings)) {
                response._header('access-control-allow-origin', request.headers.origin);
            }
            else if (settings.isOriginExposed) {
                response._header('access-control-allow-origin', settings._origin.any ? '*' : settings._origin.qualifiedString);
            }
        }
        else if (settings._origin.any) {
            response._header('access-control-allow-origin', '*');
        }
        else {
            response._header('access-control-allow-origin', settings._origin.qualifiedString);
        }
    }

    var config = { override: !!settings.override };                                                         // Value can be 'merge'

    if (settings.credentials) {
        response._header('access-control-allow-credentials', 'true', { override: settings.override });
    }

    // Appended headers

    if (settings.override === 'merge') {
        config.append = true;
    }

    if (settings._exposedHeaders.length !== 0) {
        response._header('access-control-expose-headers', settings._exposedHeaders, config);
    }
};


internals.matchOrigin = function (origin, settings) {

    if (!origin) {
        return false;
    }

    if (settings._origin.any) {
        return true;
    }

    if (settings._origin.qualified.indexOf(origin) !== -1) {
        return true;
    }

    for (var i = 0, il = settings._origin.wildcards.length; i < il; ++i) {
        if (origin.match(settings._origin.wildcards[i])) {
            return true;
        }
    }

    return false;
};


exports.options = function (route, connection, server) {

    if (route.method === 'options' ||
        !route.settings.cors) {

        return;
    }

    exports.handler(connection);
};


exports.handler = function (connection) {

    Route = Route || require('./route');

    if (connection._router.specials.options) {
        return;
    }

    var optionsRoute = new Route({
        path: '/{p*}',
        method: 'options',
        config: {
            auth: false,                            // Override any defaults
            cors: false,                            // CORS headers are set in handler()
            handler: internals.handler
        }
    }, connection, connection.server);

    connection._router.special('options', optionsRoute);
};


internals.handler = function (request, reply) {

    // Validate CORS preflight request

    var origin = request.headers.origin;
    if (!origin) {
        return reply(Boom.notFound());
    }

    var method = request.headers['access-control-request-method'];
    if (!method) {
        return reply(Boom.notFound());
    }

    // Lookup route

    var route = request.connection.match(method, request.path, request.headers.host);
    if (!route) {
        return reply(Boom.notFound());
    }

    var settings = route.settings.cors;
    if (!settings) {
        return reply(Boom.notFound());
    }

    // Validate allowed headers

    var headers = request.headers['access-control-request-headers'];
    if (headers) {
        headers = headers.split(/\s*,\s*/);
        if (Hoek.intersect(headers, settings._headers).length !== headers.length) {
            return reply(Boom.notFound());
        }
    }

    // Reply with the route CORS headers

    var response = reply();
    exports.headers(response, settings);
    response._header('access-control-allow-methods', method);
    response._header('access-control-allow-headers', settings._headersString);
    response._header('access-control-max-age', settings.maxAge);
};
