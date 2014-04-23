// Load modules

var Fs = require('fs');
var Path = require('path');
var Boom = require('boom');
var Async = require('async');
var Response = require('./response');
var File = require('./file');
var Utils = require('./utils');
var Schema = require('./schema');


// Declare internals

var internals = {};


exports.handler = function (route, options) {

    Schema.assert('directory handler', options, route.path);
    Utils.assert(route.path[route.path.length - 1] === '}', 'The route path must end with a parameter:', route.path);
    Utils.assert(route.params.length >= 1, 'The route path must include at least one parameter:', route.path);

    var settings = Utils.clone(options);                                // options can be reused
    var relativeTo = (route.env.path || route.server.settings.files.relativeTo);

    // Normalize static string path

    if (typeof settings.path === 'string') {
        settings.path = [settings.path];
    }

    var normalize = function (path) {

        if (path[path.length - 1] !== Path.sep) {
            path += Path.sep;
        }

        if (!Utils.isAbsolutePath(path)) {
            path = Path.join(relativeTo, path);
        }

        return path;
    };

    var normalized = (Array.isArray(settings.path) ? settings.path.map(normalize) : []);

    // Declare handler

    var handler = function (request, reply) {

        var paths = normalized;
        if (typeof settings.path === 'function') {
            paths = [normalize(settings.path.call(null, request))];
        }

        // Append parameter

        var selection = null;
        var lastParam = request._paramsArray[request._paramsArray.length - 1];
        if (lastParam) {
            if (lastParam.indexOf('..') !== -1) {
                return reply(Boom.forbidden());
            }

            selection = lastParam;
        }

        if (selection &&
            !settings.showHidden &&
            internals.isFileHidden(selection)) {

            return reply(Boom.notFound());
        }

        // Generate response

        var resource = request.path;
        var hasTrailingSlash = (resource[resource.length - 1] === '/');

        Async.forEachSeries(paths, function (path, next) {

            path = Path.join(path, selection || '');

            File.load(path, request, function (response) {

                // File loaded successfully

                if (!response.isBoom) {
                    return reply(response);
                }

                // Not found

                var err = response;
                if (err.output.statusCode === 404) {
                    if (!settings.defaultExtension) {
                        return next();
                    }

                    if (hasTrailingSlash) {
                        path = path.slice(0, -1);
                    }

                    File.load(path + '.' + settings.defaultExtension, request, function (extResponse) {

                        if (!extResponse.isBoom) {
                            return reply(extResponse);
                        }

                        return next();
                    });

                    return;
                }

                // Directory

                var index = (settings.index !== false);                         // Defaults to true
                if (!index &&
                    !settings.listing) {

                    return reply(Boom.forbidden());
                }

                if (settings.redirectToSlash !== false &&                       // Defaults to true
                    !hasTrailingSlash) {

                    return reply().redirect(resource + '/');
                }

                if (!index) {
                    return internals.generateListing(path, resource, selection, hasTrailingSlash, settings, request, reply);
                }

                var indexFile = Path.join(path, 'index.html');
                File.load(indexFile, request, function (indexResponse) {

                    // File loaded successfully

                    if (!indexResponse.isBoom) {
                        return reply(indexResponse);
                    }

                    // Directory

                    var err = indexResponse;
                    if (err.output.statusCode !== 404) {
                        return reply(Boom.badImplementation('index.html is a directory'));
                    }

                    // Not found

                    if (!settings.listing) {
                        return reply(Boom.forbidden());
                    }

                    return internals.generateListing(path, resource, selection, hasTrailingSlash, settings, request, reply);
                });
            });
        },
        function (/* err */) {

            return reply(Boom.notFound());
        });
    };

    return handler;
};


internals.generateListing = function (path, resource, selection, hasTrailingSlash, settings, request, reply) {

    Fs.readdir(path, function (err, files) {

        if (err) {
            return reply(Boom.internal('Error accessing directory', err));
        }

        resource = decodeURIComponent(resource);
        var display = Utils.escapeHtml(resource);
        var html = '<html><head><title>' + display + '</title></head><body><h1>Directory: ' + display + '</h1><ul>';

        if (selection) {
            var parent = resource.substring(0, resource.lastIndexOf('/', resource.length - (hasTrailingSlash ? 2 : 1))) + '/';
            html += '<li><a href="' + internals.pathEncode(parent) + '">Parent Directory</a></li>';
        }

        for (var i = 0, il = files.length; i < il; ++i) {
            if (settings.showHidden ||
                !internals.isFileHidden(files[i])) {

                html += '<li><a href="' + internals.pathEncode(resource + (selection && !hasTrailingSlash ? '/' : '') + files[i]) + '">' + Utils.escapeHtml(files[i]) + '</a></li>';
            }
        }

        html += '</ul></body></html>';

        return reply(new Response.Plain(html, request));
    });
};


internals.isFileHidden = function (path) {

    return /^\./.test(Path.basename(path));
};


internals.pathEncode = function (path) {

    return encodeURIComponent(path).replace(/%2F/g, '/').replace(/%5C/g, '\\');
};

