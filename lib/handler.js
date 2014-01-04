// Load modules

var Stream = require('stream');
var Async = require('async');
var Boom = require('boom');
var Utils = require('./utils');
var Response = require('./response');
var Ext = require('./ext');
var File = require('./file');
var Directory = require('./directory');
var Proxy = require('./proxy');
var Views = require('./views');


// Declare internals

var internals = {};

exports.execute = function (request, next) {

    var finalize = function (err, result) {

        request._setResponse(err || result);
        return next();                              // Must not include an argument
    };

    if (request._route.prerequisites) {
        internals.prerequisites(request, Utils.once(finalize));
    }
    else {
        internals.handler(request, finalize);
    }
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

    Ext.runProtected(callback, function (enter, exit) {

        var timer = new Utils.Bench();
        var finalize = function (response) {

            // Check for Error result

            if (response.isBoom) {
                request.log(['hapi', 'handler', 'error'], { msec: timer.elapsed() });
                return exit(response);
            }

            request.log(['hapi', 'handler'], { msec: timer.elapsed() });
            return exit(null, response);
        };

        // Decorate request

        var reply = exports.replyInterface(request, finalize);
        var bind = (request.route.bind || request._route.env.bind);

        // Execute handler

        enter(function () {

            request.server._dtrace.report('request.handler', request);
            request.route.handler.call(bind, request, reply);
        });
    });
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
        finalize(response)
    }
    else {
        response.hold = function () {

            response.hold = undefined;

            response.send = function () {

                response.send = undefined;
                finalize(response);
            };

            return response;
        };

        process.nextTick(function () {

            response.hold = undefined;

            if (!response.send) {
                finalize(response);
            }
        });
    }

    return response;
};


exports.configure = function (handler, route) {

    if (typeof handler === 'object') {
        if (handler.proxy) {
            return Proxy.handler(route, handler.proxy);
        }

        if (handler.file) {
            return File.handler(route, handler.file);
        }

        if (handler.directory) {
            return Directory.handler(route, handler.directory);
        }

        if (handler.view) {
            return Views.handler(route, handler.view);
        }
    }

    return handler;
};


exports.prerequisites = function (config, server) {

    if (!config) {
        return null;
    }

    /*
        [
            [
                function (request, next) { },
                {
                    method: function (request, next) { }
                    assign: key1
                },
                {
                    method: function (request, next) { },
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
            }

            if (typeof item.method === 'string') {
                internals.preString(item, server);
            }

            set.push(internals.pre(item));
        }

        if (set.length) {
            prerequisites.push(set);
        }
    }

    return prerequisites.length ? prerequisites : null;
};


internals.preString = function (pre, server) {

    var preMethodParts = pre.method.match(/^(\w+)(?:\s*)\((\s*\w+(?:\.\w+)*\s*(?:\,\s*\w+(?:\.\w+)*\s*)*)?\)$/);
    Utils.assert(preMethodParts, 'Invalid prerequisite string method syntax:', pre.method);
    var helper = preMethodParts[1];
    Utils.assert(preMethodParts && server.helpers[helper], 'Unknown server helper method in prerequisite string:', pre.method);
    pre.assign = pre.assign || helper;
    var helperArgs = preMethodParts[2].split(/\s*\,\s*/);

    pre.method = function (request, next) {

        var args = [];
        for (var i = 0, il = helperArgs.length; i < il; ++i) {
            var arg = helperArgs[i];
            args.push(Utils.reach(request, arg));
        }

        args.push(next);
        request.server.helpers[helper].apply(null, args);
    };
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

            request.server._dtrace.report('pre.end', pre.assign, result);

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

        Ext.runProtected(finalize, function (enter, exit) {

            // Setup environment

            var reply = exports.replyInterface(request, exit);
            var bind = (request.route.bind || request._route.env.bind);

            // Execute handler

            enter(function () {

                request.server._dtrace.report('pre.start', pre.assign);
                pre.method.call(bind, request, reply);
            });
        });
    };
};


exports.invoke = function (request, event, callback) {

    var handlers = this._events[event];
    if (!handlers) {
        return Utils.nextTick(callback)();
    }

    Async.forEachSeries(handlers, function (ext, next) {

        Ext.runProtected(next, function (enter, exit) {

            var finalize = function (err, result) {

                result = err || result;
                return (result === undefined ? exit() : reply._root(result));
            };

            finalize.env = ext.env;

            var reply = exports.replyInterface(request, exit, finalize);
            var bind = (ext.bind || (ext.env && ext.env.bind));

            enter(function () {

                ext.func.call(bind, request, reply);
            });
        });
    },
    function (err) {

        request._pluginEnv = undefined;
        return callback(err);
    });
};

