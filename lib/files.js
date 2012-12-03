// Load modules

var Response = require('./response');
var Err = require('./error');
var Utils = require('./utils');

// Declare internals

var internals = {};


exports.fileHandler = function (route, filePath) {

    Utils.assert(typeof filePath === 'function' || route.params.length === 0, 'Route path cannot contain a parameter');         // String paths cannot contain parameters in route

    if (typeof filePath === 'function') {
        var dynamicHandler = function (request) {

            return request.reply(new Response.File(filePath(request)));
        };

        return dynamicHandler;
    }

    var fileResponse = new Response.File(filePath);
    var staticHandler = function (request) {

        return request.reply(fileResponse);
    };

    return staticHandler;
};


exports.directoryHandler = function (route, options) {

    Utils.assert(options, 'Options must exist');
    Utils.assert(typeof options === 'object' && options.path, 'Options must be an object with a path');
    Utils.assert(typeof options.path === 'function' || typeof options.path === 'string', 'options.path must be a function or a string');
    Utils.assert(route.path[route.path.length - 1] === '}', 'The route path must end with a parameter');
    Utils.assert(route.params.length === 1, 'The route path must include one and only one parameter');

    var settings = Utils.clone(options);                                // options can be reused
    var absolutePath = exports.getRouteFilePath();

    // Normalize string path

    if (typeof settings.path === 'string') {
        if (settings.path[settings.path.length - 1] !== '/') {
            settings.path += '/';
        }
        if (settings.path[0] !== '/') {
            settings.path = absolutePath + '/' + settings.path;
        }
    }

    var handler = function (request) {

        // Calculate path

        var path = null;

        if (typeof settings.path === 'function') {
            path = settings.path(request);

            // Normalize function result

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

        console.log(path);
        // Generate response

        var response = new Response.Directory(path, {
            resource: request.path,
            isRoot: isRoot,
            index: settings.index,
            listing: settings.listing
        });

        return request.reply(response);
    };

    return handler;
};


exports.getRouteFilePath = function () {

    // 0 - Files.getRouteFilePath
    // 1 - Files.directoryHandler
    // 2 - new Route
    // 3 - Server.addRoute
    // [4 - Server.addRoutes]
    // 5 - Caller

    var stack = Utils.callStack();
    var pos = (stack[4][3] === 'internals.Server.addRoutes' ? 5 : 4);
    return stack[pos][0].substring(0, stack[pos][0].lastIndexOf('/'));
};

