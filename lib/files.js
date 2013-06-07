// Load modules

var Boom = require('boom');
var Path = require('path');
var Utils = require('./utils');
var Response = require('./response');
var Directory = require('./response/directory');

// Declare internals

var internals = {};


exports.fileHandler = function (route, options) {

    var filePath = (typeof options === 'object') ? options.path : options;
    var mode = (typeof options === 'object') ? options.mode : false;
    Utils.assert(filePath && (typeof filePath === 'function' || typeof filePath === 'string'), 'Invalid file path');
    Utils.assert(typeof filePath !== 'string' || filePath[filePath.length - 1] !== '/', 'File path cannot end with a \'/\'');

    var absolutePath = internals.absolutePath(route);

    // Normalize static string path

    if (typeof filePath === 'string') {
        var staticPath = filePath;
        if (staticPath[0] !== '/') {
            staticPath = Path.join(absolutePath, staticPath);
        }
    }

    var handler = function (request) {

        var path = null;

        if (typeof filePath === 'function') {
            path = filePath(request);

            // Normalize function string path

            if (path[0] !== '/') {
                path = Path.join(absolutePath, path);
            }
        }
        else {
            path = staticPath;
        }

        return request.reply(new Response.File(path, { mode: mode }));
    };

    return handler;
};


exports.directoryHandler = function (route, options) {

    Utils.assert(options, 'Options must exist');
    Utils.assert(typeof options === 'object' && options.path, 'Options must be an object with a path');
    Utils.assert(typeof options.path === 'function' || typeof options.path === 'string' || options.path instanceof Array, 'options.path must be a function, a string, or an array of strings');
    Utils.assert(route.path[route.path.length - 1] === '}', 'The route path must end with a parameter');
    Utils.assert(route.params.length === 1, 'The route path must include one and only one parameter');

    var settings = Utils.clone(options);                                // options can be reused
    var absolutePath = internals.absolutePath(route);

    // Normalize static string path

    if (typeof settings.path === 'string') {
        settings.path = [settings.path];
    }

    var normalize = function (path) {

        if (path[path.length - 1] !== '/') {
            path += '/';
        }

        if (path[0] !== '/') {
            path = Path.join(absolutePath, path);
        }

        return path;
    };

    var normalized = [];
    if (settings.path instanceof Array) {
        settings.path.forEach(function (path) {

            Utils.assert(path && typeof path === 'string', 'Directory path array must only contain strings');
            normalized.push(normalize(path));
        });
    }

    var handler = function (request) {

        var paths = normalized;
        if (typeof settings.path === 'function') {
            paths = [normalize(settings.path(request))];
        }

        // Append parameter

        var selection = null;
        if (request._paramsArray[0]) {
            if (request._paramsArray[0].indexOf('..') !== -1) {
                return request.reply(Boom.forbidden());
            }

            selection = request._paramsArray[0];
        }

        // Generate response

        var response = new Directory(paths, {

            resource: request.path,
            selection: selection,
            index: settings.index,
            listing: settings.listing,
            showHidden: settings.showHidden,
            redirectToSlash: settings.redirectToSlash
        });

        return request.reply(response);
    };

    return handler;
};


internals.absolutePath = function (route) {

    var relativeTo = route.server.settings.files && route.server.settings.files.relativeTo;
    Utils.assert(relativeTo && (relativeTo[0] === '/' || ['cwd', 'routes'].indexOf(relativeTo) !== -1), 'Invalid server files.relativeTo configuration');

    // Plugin

    if (route.env.path) {
        return route.env.path;
    }

    // 'cwd'

    if (relativeTo === 'cwd') {
        return '.';
    }

    // 'routes'

    if (relativeTo === 'routes') {
        return internals.getRouteSourceFilePath();
    }

    // '/path'

    return relativeTo;
};


internals.getRouteSourceFilePath = function () {

    var stack = Utils.callStack();
    var callerPos = 0;

    for (var i = 0, il = stack.length; i < il; ++i) {
        var stackLine = stack[i];
        if (stackLine[3] &&
            stackLine[3].indexOf('internals.Server.route') !== -1) {    // The file that added the route will appear after the call to route

            callerPos = i + 1;
            break;
        }
    }

    return Path.dirname(stack[callerPos][0]);
};

