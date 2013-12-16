// Load modules

var Boom = require('boom');
var Path = require('path');
var Utils = require('./utils');
var Response = require('./response');

// Declare internals

var internals = {};


exports.handler = function (route, options) {

    var settings = (typeof options !== 'object' ? { path: options } : Utils.clone(options));                        // options can be reused
    Utils.assert(typeof settings.path !== 'string' || settings.path[settings.path.length - 1] !== '/', 'File path cannot end with a \'/\':', route.path);

    var absolutePath = exports.absolutePath(route);

    // Normalize static string path

    if (typeof settings.path === 'string') {
        var staticPath = settings.path;
        if (staticPath[0] !== '/') {
            staticPath = Path.join(absolutePath, staticPath);
        }
    }

    var handler = function (request, reply) {

        var path = null;

        if (typeof settings.path === 'function') {
            path = settings.path(request);

            // Normalize function string path

            if (path[0] !== '/') {
                path = Path.join(absolutePath, path);
            }
        }
        else {
            path = staticPath;
        }

        return reply(new Response.File(path, settings));
    };

    return handler;
};


exports.absolutePath = function (route) {


    // Plugin

    if (route.env.path) {
        return route.env.path;
    }

    // 'cwd'

    var relativeTo = route.server.settings.files.relativeTo;
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

