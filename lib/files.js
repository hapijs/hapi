// Load modules

var Response = require('./response');
var Err = require('./error');
var Utils = require('./utils');

// Declare internals

var internals = {};


exports.fileHandler = function (route, filePath) {

    Utils.assert(filePath && (typeof filePath === 'function' || typeof filePath === 'string'), 'Invalid file path');
    Utils.assert(typeof filePath !== 'string' || route.params.length === 0, 'Route path with static file path cannot contain a parameter');
    Utils.assert(typeof filePath !== 'string' || filePath[filePath.length - 1] !== '/', 'File path cannot end with a \'/\'');

    var absolutePath = internals.absolutePath(route);

    // Normalize static string path

    if (typeof filePath === 'string') {
        var staticPath = filePath;
        if (staticPath[0] !== '/') {
            staticPath = absolutePath + '/' + staticPath;
        }
    }

    var handler = function (request) {

        var path = null;

        if (typeof filePath === 'function') {
            path = filePath(request);

            // Normalize function string path

            if (path[0] !== '/') {
                path = absolutePath + '/' + path;
            }
        }
        else {
            path = staticPath;
        }

        return request.reply(new Response.File(path));
    }

    return handler;
};


exports.directoryHandler = function (route, options) {

    Utils.assert(options, 'Options must exist');
    Utils.assert(typeof options === 'object' && options.path, 'Options must be an object with a path');
    Utils.assert(typeof options.path === 'function' || typeof options.path === 'string', 'options.path must be a function or a string');
    Utils.assert(route.path[route.path.length - 1] === '}', 'The route path must end with a parameter');
    Utils.assert(route.params.length === 1, 'The route path must include one and only one parameter');

    var settings = Utils.clone(options);                                // options can be reused
    var absolutePath = internals.absolutePath(route);

    // Normalize static string path

    if (typeof settings.path === 'string') {
        if (settings.path[settings.path.length - 1] !== '/') {
            settings.path += '/';
        }

        if (settings.path[0] !== '/') {
            settings.path = absolutePath + '/' + settings.path;
        }
    }

    var handler = function (request) {

        var path = null;

        if (typeof settings.path === 'function') {
            path = settings.path(request);

            // Normalize function string path

            if (path[path.length - 1] !== '/') {
                path += '/';
            }

            if (path[0] !== '/') {
                path = absolutePath + '/' + path;
            }
        }
        else {
            path = settings.path;
        }

        // Append parameter

        var isRoot = true;
        if (request._paramsArray[0]) {

            if (request._paramsArray[0].indexOf('..') !== -1) {
                return request.reply(Err.forbidden());
            }

            path += request._paramsArray[0];
            isRoot = false;
        }

        // Generate response

        var response = new Response.Directory(path, {
            resource: request.path,
            isRoot: isRoot,
            index: settings.index,
            listing: settings.listing,
            showHidden: settings.showHidden
        });

        return request.reply(response);
    };

    return handler;
};


internals.absolutePath = function (route) {

    Utils.assert(route.server.settings.files && route.server.settings.files.relativeTo && ['routes', 'process'].indexOf(route.server.settings.files.relativeTo) !== -1, 'Invalid server files.relativeTo configuration');

    // 'routes'

    if (route.server.settings.files.relativeTo === 'routes') {
        return internals.getRouteSourceFilePath();
    }

    // 'process'

    return process.cwd();
};


internals.getRouteSourceFilePath = function () {

    // 0 - Files.getRouteSourceFilePath
    // 1 - Files.absolutePath
    // 2 - Files.directoryHandler / Files.fileHandler
    // 3 - new Route
    // 4 - Server.addRoute
    // 5 - Server.addRoutes / **Caller
    // 6 - **Caller

    var stack = Utils.callStack();
    var pos = (stack[5][3] === 'internals.Server.addRoutes' ? 6 : 5);
    return stack[pos][0].substring(0, stack[pos][0].lastIndexOf('/'));
};

