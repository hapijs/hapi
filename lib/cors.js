// Load modules

var Hoek = require('hoek');
var Defaults = require('./defaults');


// Declare internals

var internals = {};


exports.route = function (options) {

    var settings = Hoek.applyToDefaults(Defaults.cors, options);
    if (!settings) {
        return false;
    }

    settings._headers = settings.headers.concat(settings.additionalHeaders).join(',');
    settings._methods = settings.methods.concat(settings.additionalMethods).join(',');
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


exports.headers = function (response) {

    var request = response.request;
    var settings = request.route.settings.cors;
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
    response._header('access-control-max-age', settings.maxAge, { override: settings.override });

    if (settings.credentials) {
        response._header('access-control-allow-credentials', 'true', { override: settings.override });
    }

    // Appended headers

    if (settings.override === 'merge') {
        config.append = true;
    }

    response._header('access-control-allow-methods', settings._methods, config);
    response._header('access-control-allow-headers', settings._headers, config);

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


exports.options = function (route, connection, plugin) {

    var settings = Hoek.clone(route.settings.cors);

    if (settings) {
        delete settings._origin;
        delete settings._exposedHeaders;
        delete settings._headers;
        delete settings._methods;
    }

    if (route.method === 'options' ||
        Hoek.deepEqual(connection.settings.routes.cors, settings)) {

        return;
    }

    if (!settings) {
        return;
    }

    var path = route.path;
    if (connection._corsPaths[path]) {
        Hoek.assert(Hoek.deepEqual(connection._corsPaths[path], settings), 'Cannot add multiple routes with different CORS options on different methods:', route.method.toUpperCase(), path);
        return;
    }

    connection._corsPaths[path] = settings;

    connection._route({
        path: path,
        method: 'options',
        config: {
            auth: false,                         // Override any defaults
            cors: settings,
            handler: function (request, reply) {

                return reply();
            }
        }
    }, plugin);
};
