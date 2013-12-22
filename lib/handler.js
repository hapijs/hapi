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
    
    var handler = new internals.Handler(request, next);
    handler.execute();
};


internals.Handler = function (request, next) {
    
    this.request = request;
    this.next = next;
};


internals.Handler.prototype.execute = function () {

    var self = this;

    var request = this.request;

    return this.prerequisites(function (err, result) {
        
        self.store(err || result);
    });
};


internals.Handler.prototype.prerequisites = function (callback) {

    var self = this;

    var request = this.request;

    if (!request._route.prerequisites) {
        return self.handler(callback);
    }

    Async.forEachSeries(request._route.prerequisites, function (set, nextSet) {

        Async.forEach(set, function (pre, next) {

            pre(request, next);
        }, nextSet);
    },
    function (err) {

        return self.handler(callback, err);
    });
};


internals.Handler.prototype.handler = function (callback, err) {

    var self = this;

    var request = this.request;

    if (err) {
        return callback(err);
    }

    Ext.runProtected(request, 'handler', callback, function (enter, exit) {

        var timer = new Utils.Bench();

        var isFinalized = false;
        var finalize = function (response) {

            if (isFinalized) {
                return;
            }

            isFinalized = true;

            // Check for Error result

            if (response &&
                response.isBoom) {

                request.log(['hapi', 'handler', 'error'], { msec: timer.elapsed() });
                return exit(response);
            }

            request.log(['hapi', 'handler'], { msec: timer.elapsed() });
            return exit(null, response, !response.toCache);
        };

        // Decorate request

        var reply = internals.decorateReply(request, finalize);
        var bind = (request.route.bind || request._route.env.bind);

        // Execute handler

        enter(function () {

            request.server._dtrace.report('request.handler', request);
            request.route.handler.call(bind, request, reply);
        });
    });
};


internals.Handler.prototype.store = function (response) {

    this.request._setResponse(response);
    return this.next();                                 // Must not include an argument
};


internals.decorateReply = function (request, finalize) {

    var reply = function (result) {

        return exports.response(result, request, finalize);
    };

    reply.close = function () {

        finalize({ closed: true });
    };

    var viewsManager = request._route.env.views || request.server._views;
    if (viewsManager) {
        reply.view = function (template, context, options) {

            return exports.response(new Response.View(viewsManager, template, context, options), request, finalize);
        };
    }

    reply.proxy = function (options) {

        var handler = Proxy.handler(request._route, options);
        handler.call(null, request, reply);                     // Internal handler not using bind
    };
    
    reply.file = function (path, options) {

        File.load(path, options, reply);
    };

    return reply;
};


exports.response = function (result, request, onSend) {

    var response = null;

    if (result === null ||
        result === undefined ||
        result === '') {

        response = new Response.Generic();
    }
    else if (typeof result === 'string') {
        response = new Response.Generic(result);
    }
    else if (typeof result === 'object') {
        if (Buffer.isBuffer(result)) {
            response = new Response.Generic(result);
        }
        else if (result instanceof Response.Generic ||
            (result.isBoom && result instanceof Error)) {      // Checking 'instanceof Boom' is unreliable
            
            response = result;
        }
        else if (result instanceof Error) {
            response = new Boom(result);
        }
        else if (result instanceof Stream) {
            response = new Response.Generic(result);
        }
    }

    if (!response) {
        response = new Response.Generic(result);
    }

    if (!response.isBoom) {
        response._rawResult = result;
    }

    if (request &&
        request.method !== 'post' &&
        request.method !== 'put') {

        response.created = undefined;                               // Can't delete off prototype
    }

    if (!onSend) {
        return response;
    }

    response.hold = function () {

        delete response.hold;

        response.send = function () {

            delete response.send;
            onSend(response);
        };

        return response;
    };

    process.nextTick(function () {

        delete response.hold;

        if (!response.send) {
            onSend(response);
        }
    });

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

        Ext.runProtected(request, 'pre', next, function (enter, exit) {

            var timer = new Utils.Bench();
            var isFinalized = false;
            var finalize = function (result) {

                if (isFinalized) {
                    return;
                }

                isFinalized = true;

                if (result instanceof Error) {
                    if (pre.failAction !== 'ignore') {
                        request.log(['hapi', 'pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, error: result });
                    }

                    if (pre.failAction === 'error') {
                        return exit(result);
                    }
                }
                else {
                    request.log(['hapi', 'pre'], { msec: timer.elapsed(), assign: pre.assign });
                }

                if (pre.assign) {
                    request.pre[pre.assign] = result.hasOwnProperty('_rawResult') ? result._rawResult : result;
                    request.responses[pre.assign] = result;
                }

                request.server._dtrace.report('pre.end', pre.assign, result);
                return exit();
            };

            // Setup environment

            var reply = internals.decorateReply(request, finalize);
            var bind = (request.route.bind || request._route.env.bind);

            // Execute handler

            enter(function () {

                request.server._dtrace.report('pre.start', pre.assign);
                pre.method.call(bind, request, reply);
            });
        });
    };
};

