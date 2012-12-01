// Load modules

var Response = require('./response');
var Utils = require('./utils');

// Declare internals

var internals = {};


exports.fileHandler = function (routePath, filePath) {

    Utils.assert((typeof filePath === 'function') || (routePath.indexOf('{') === -1), 'Route path cannot contain a parameter');         // String paths cannot contain parameters in route

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


exports.directoryHandler = function (routePath, options) {

    Utils.assert(options, 'Options must exist');
    Utils.assert(typeof options === 'object' && options.path, 'Options must be an object with a path');
    Utils.assert(typeof options.path === 'function' || (typeof options.path === 'string' && options.path[options.path.length - 1] !== '/'), 'options.path must be a function or a string that does not end with a "/"');
    Utils.assert(routePath[routePath.length - 1] === '}', 'The route path must end with a parameter');

    var settings = Utils.clone(options);                                // options can be reused

    var handler = function (request) {

        // Calculate path

        var path = null;
        var isRoot = true;

        if (typeof settings.path === 'function') {
            path = settings.path(request);
        }
        else {
            path = settings.path;
            if (request._paramsArray[0]) {
                path += '/' + request._paramsArray[0];
                isRoot = false;
            }
        }

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

