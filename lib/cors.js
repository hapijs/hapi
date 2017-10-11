'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');

let Route = null;                           // Delayed load due to circular dependency


// Declare internals

const internals = {};


exports.route = function (options) {

    if (!options) {
        return false;
    }

    const settings = Hoek.clone(options);
    settings._headers = settings.headers.concat(settings.additionalHeaders);
    settings._headersString = settings._headers.join(',');
    for (let i = 0; i < settings._headers.length; ++i) {
        settings._headers[i] = settings._headers[i].toLowerCase();
    }

    if (settings._headers.indexOf('origin') === -1) {
        settings._headers.push('origin');
    }

    settings._exposedHeaders = settings.exposedHeaders.concat(settings.additionalExposedHeaders).join(',');

    if (settings.origin.indexOf('*') !== -1) {
        Hoek.assert(settings.origin.length === 1, 'Cannot specify cors.origin * together with other values');
        settings._origin = true;
    }
    else {
        settings._origin = {
            qualified: [],
            wildcards: []
        };

        for (let i = 0; i < settings.origin.length; ++i) {
            const origin = settings.origin[i];
            if (origin.indexOf('*') !== -1) {
                settings._origin.wildcards.push(new RegExp('^' + Hoek.escapeRegex(origin).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$'));
            }
            else {
                settings._origin.qualified.push(origin);
            }
        }
    }

    return settings;
};


exports.options = function (route, server) {

    if (route.method === 'options' ||
        !route.settings.cors) {

        return;
    }

    exports.handler(server);
};


exports.handler = function (server) {

    Route = Route || require('./route');

    if (server._core.router.specials.options) {
        return;
    }

    const route = new Route({ method: '_special', path: '/{p*}', handler: internals.handler }, server, { special: true });
    server._core.router.special('options', route);
};


internals.handler = function (request, h) {

    // Validate CORS preflight request

    const origin = request.headers.origin;
    if (!origin) {
        throw Boom.notFound('CORS error: Missing Origin header');
    }

    const method = request.headers['access-control-request-method'];
    if (!method) {
        throw Boom.notFound('CORS error: Missing Access-Control-Request-Method header');
    }

    // Lookup route

    const route = request.server.match(method, request.path, request.info.hostname);
    if (!route) {
        throw Boom.notFound();
    }

    const settings = route.settings.cors;
    if (!settings) {
        return { message: 'CORS is disabled for this route' };
    }

    // Validate Origin header

    if (!exports.matchOrigin(origin, settings)) {
        return { message: 'CORS error: Origin not allowed' };
    }

    // Validate allowed headers

    let headers = request.headers['access-control-request-headers'];
    if (headers) {
        headers = headers.toLowerCase().split(/\s*,\s*/);
        if (Hoek.intersect(headers, settings._headers).length !== headers.length) {
            return { message: 'CORS error: Some headers are not allowed' };
        }
    }

    // Reply with the route CORS headers

    const response = h.response();
    response._header('access-control-allow-origin', request.headers.origin);
    response._header('access-control-allow-methods', method);
    response._header('access-control-allow-headers', settings._headersString);
    response._header('access-control-max-age', settings.maxAge);

    if (settings.credentials) {
        response._header('access-control-allow-credentials', 'true');
    }

    if (settings._exposedHeaders) {
        response._header('access-control-expose-headers', settings._exposedHeaders);
    }

    return response;
};


exports.headers = function (request) {

    const settings = request.route.settings.cors;
    const response = request.response;

    response.vary('origin');

    if (!request.info.cors.isOriginMatch) {
        return;
    }

    response._header('access-control-allow-origin', request.headers.origin);

    if (settings.credentials) {
        response._header('access-control-allow-credentials', 'true');
    }

    if (settings._exposedHeaders) {
        response._header('access-control-expose-headers', settings._exposedHeaders, { append: true });
    }
};


exports.matchOrigin = function (origin, settings) {

    if (!origin) {
        return false;
    }

    if (settings._origin === true) {
        return true;
    }

    if (settings._origin.qualified.indexOf(origin) !== -1) {
        return true;
    }

    for (let i = 0; i < settings._origin.wildcards.length; ++i) {
        if (origin.match(settings._origin.wildcards[i])) {
            return true;
        }
    }

    return false;
};
