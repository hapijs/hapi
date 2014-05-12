// Load modules

var Async = require('async');
var Utils = require('./utils');
var Response = require('./response');
var File = require('./file');
var Directory = require('./directory');
var Proxy = require('./proxy');
var Views = require('./views');
var Methods = require('./methods');


// Declare internals

var internals = {};

exports.execute = function (request, next) {

    var finalize = function (err, result) {

        request._setResponse(err || result);
        return next();                              // Must not include an argument
    };

    request._protect.run(finalize, function (exit) {

        if (request._route.prerequisites) {
            internals.prerequisites(request, Utils.once(exit));
        }
        else {
            internals.handler(request, exit);
        }
    });
};


internals.prerequisites = function (request, callback) {

    Async.forEachSeries(request._route.prerequisites, function (set, nextSet) {

        Async.forEach(set, function (pre, next) {

            pre(request, function (err, result) {

                if (err ||
                    !result._takeover) {

                    next(err);
                }
                else {
                    callback(null, result);
                }
            });
        }, nextSet);
    },
    function (err) {

        if (err) {
            callback(err);
        }
        else {
            return internals.handler(request, callback);
        }
    });
};


internals.handler = function (request, callback) {

    var timer = new Utils.Bench();
    var finalize = function (response) {

        // Check for Error result

        if (response.isBoom) {
            request.log(['hapi', 'handler', 'error'], { msec: timer.elapsed() });
            return callback(response);
        }

        request.log(['hapi', 'handler'], { msec: timer.elapsed() });
        return callback(null, response);
    };

    // Decorate request

    var reply = exports.replyInterface(request, finalize);
    var bind = (request.route.bind || request._route.env.bind);

    // Execute handler

    request.route.handler.call(bind, request, reply);
};


exports.replyInterface = function (request, finalize, base) {

    finalize = Utils.once(finalize);

    var root = function (err, result) {

        return internals.wrap((err !== null && err !== undefined ? err : result), request, finalize);
    };

    var reply = base || root;
    if (base) {
        base._root = root;
    }

    var viewsManager = (base && base.env && base.env.views) || request._route.env.views || request.server._views;
    if (viewsManager) {
        reply.view = function (template, context, options) {

            return internals.wrap(new Views.Response(viewsManager, template, context, options, request), request, finalize);
        };
    }

    reply.file = function (path, options) {

        return internals.wrap(new File.Response(path, options, request), request, finalize);
    };

    reply.proxy = function (options) {

        var handler = Proxy.handler(request._route, options);
        handler.call(null, request, reply);                     // Internal handler not using bind
    };

    reply.close = function (options) {

        options = options || {};
        finalize({ closed: true, end: options.end !== false });
    };

    reply.state = function (name, value, options) {

        request._setState(name, value, options);
    };

    reply.unstate = function (name) {

        request._clearState(name);
    };

    return reply;
};


internals.wrap = function (result, request, finalize) {

    var response = Response.wrap(result, request);

    if (response.isBoom) {
        return finalize(response);
    }

    var prepare = function () {

        if (response._prepare) {
            return response._prepare(request, finalize);
        }

        return finalize(response);
    };

    response.hold = function () {

        response.hold = undefined;

        response.send = function () {

            response.send = undefined;
            prepare();
        };

        return response;
    };

    process.nextTick(function () {

        response.hold = undefined;

        if (!response.send) {
            prepare();
        }
    });

    return response;
};


exports.configure = function (handler, route) {

    if (typeof handler === 'object') {
        var type = Object.keys(handler)[0];
        var serverHandler = route.server.pack._handlers[type];

        Utils.assert(serverHandler, 'Unknown handler:', type);

        return serverHandler(route, handler[type]);
    }

    if (typeof handler === 'string') {
        var parsed = internals.fromString(handler, route.server);
        return parsed.method;
    }

    return handler;
};


exports.register = function (pack) {

    pack._handler('proxy', Proxy.handler);
    pack._handler('file', File.handler);
    pack._handler('directory', Directory.handler);
    pack._handler('view', Views.handler);
};


exports.prerequisites = function (config, server) {

    if (!config) {
        return null;
    }

    /*
        [
            [
                function (request, reply) { },
                {
                    method: function (request, reply) { }
                    assign: key1
                },
                {
                    method: function (request, reply) { },
                    assign: key2
                }
            ],
            'user(params.id)'
        ]
    */

    var prerequisites = [];

    for (var i = 0, il = config.length; i < il; ++i) {
        var pres = [].concat(config[i]);

        var set = [];
        for (var p = 0, pl = pres.length; p < pl; ++p) {
            var pre = pres[p];
            if (typeof pre !== 'object') {
                pre = { method: pre };
            }

            var item = {
                method: pre.method,
                assign: pre.assign,
                failAction: pre.failAction || 'error',
            };

            if (typeof item.method === 'string') {
                var parsed = internals.fromString(item.method, server);
                item.method = parsed.method;
                item.assign = item.assign || parsed.name;
            }

            set.push(internals.pre(item));
        }

        prerequisites.push(set);
    }

    return prerequisites.length ? prerequisites : null;
};


internals.fromString = function (notation, server) {

    //                                  1:name            2:(        3:arguments
    var methodParts = notation.match(/^([\w\.]+)(?:\s*)(?:(\()(?:\s*)(\w+(?:\.\w+)*(?:\s*\,\s*\w+(?:\.\w+)*)*)?(?:\s*)\))?$/);
    Utils.assert(methodParts, 'Invalid server method string notation:', notation);

    var name = methodParts[1];
    Utils.assert(name.match(Methods.methodNameRx), 'Invalid server method name:', name);

    var method = Utils.reach(server.methods, name, { functions: false });
    Utils.assert(method, 'Unknown server method in string notation:', notation);

    var result = { name: name };
    var argsNotation = !!methodParts[2];
    var methodArgs = (argsNotation ? (methodParts[3] || '').split(/\s*\,\s*/) : null);

    result.method = function (request, reply) {

        if (!argsNotation) {
            return method.call(null, request, reply);
        }

        var args = [];
        for (var i = 0, il = methodArgs.length; i < il; ++i) {
            var arg = methodArgs[i];
            if (arg) {
                args.push(Utils.reach(request, arg));
            }
        }

        args.push(reply);
        method.apply(null, args);
    };

    return result;
};


internals.pre = function (pre) {

    /*
        {
            method: function (request, next) { }
            assign:     'key'
            failAction: 'error'* | 'log' | 'ignore'
        }
    */

    return function (request, next) {

        var timer = new Utils.Bench();
        var finalize = function (result) {

            if (result instanceof Error) {
                if (pre.failAction !== 'ignore') {
                    request.log(['hapi', 'pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, error: result });
                }

                if (pre.failAction === 'error') {
                    return next(result);
                }
            }
            else {
                request.log(['hapi', 'pre'], { msec: timer.elapsed(), assign: pre.assign });
            }

            if (pre.assign) {
                request.pre[pre.assign] = result.source;
                request.responses[pre.assign] = result;
            }

            return next(null, result);
        };

        // Setup environment

        var reply = exports.replyInterface(request, finalize);
        var bind = (request.route.bind || request._route.env.bind);

        // Execute handler

        pre.method.call(bind, request, reply);
    };
};


exports.invoke = function (request, event, callback) {

    var exts = request.server._ext._events[event];
    if (!exts) {
        return Utils.nextTick(callback)();
    }

    request._protect.run(callback, function (exit) {

        Async.forEachSeries(exts.nodes, function (ext, next) {

            var finalize = function (err, result) {

                return (err === undefined && result === undefined ? next() : reply._root(err || result));
            };

            finalize.env = ext.env;

            var filter = function (result) {

                return next(result.source !== null ? result : null);
            };

            var reply = exports.replyInterface(request, filter, finalize);
            var bind = (ext.bind || (ext.env && ext.env.bind));

            ext.func.call(bind, request, reply);
        }, exit);
    });
};
