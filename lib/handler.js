// Load modules

var Async = require('async');
var Utils = require('./utils');
var Cached = require('./response/cached');
var Ext = require('./ext');


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

    if (request.route.cache.mode.server) {

        // Cached
        
        var generate = function (callback) { self.generate(callback); };
        request._route.cache.getOrGenerate(request.url.path, generate, function (err, value, cached, report) {  // request.url.path contains query

            request.log(['hapi', 'cache', 'get'], report);

            if (err) {
                return self.store(err);
            }

            if (cached) {
                return self.store(new Cached(value, cached.ttl));
            }

            return self.store(value);
        });
    }
    else {

        // Not cached

        return this.generate();
    }
};


internals.Handler.prototype.generate = function (callback) {

    var self = this;

    var request = this.request;

    callback = callback || function (err, result) { self.store(err || result); };

    if (!request._route.prerequisites) {
        return process.nextTick(function () {
            
            self.after(callback);
        });
    }

    Async.forEachSeries(request._route.prerequisites, function (set, nextSet) {

        Async.forEach(set, function (pre, next) {

            pre(request, next);
        }, nextSet);
    },
    function (err) {

        return self.after(callback, err);
    });
};


internals.Handler.prototype.after = function (callback, err) {

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

            request._undecorateReply();

            // Check for Error result

            if (response &&
                (response.isBoom || response.varieties.error)) {

                request.log(['hapi', 'handler', 'error'], { msec: timer.elapsed() });
                return exit(response);
            }

            request.log(['hapi', 'handler'], { msec: timer.elapsed() });
            return exit(null, response, !response.varieties.cacheable);
        };

        // Decorate request

        request._decorateReply(finalize);

        // Execute handler

        enter(function () {

            request.server._dtrace.report('request.handler', request);
            request.route.handler.call(request, request, request.reply);
        });
    });
};


internals.Handler.prototype.store = function (response) {

    this.request._setResponse(response);
    return this.next();                                 // Must not include an argument
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
                output: pre.output,
                failAction: pre.failAction || 'error',
            }

            if (typeof item.method === 'string') {
                internals.preString(item, server);
            }

            set.push(internals.bindPre(item));
        }

        if (set.length) {
            prerequisites.push(set);
        }
    }

    return prerequisites.length ? prerequisites : null;
};


internals.preString = function (pre, server) {

    var preMethodParts = pre.method.match(/^(\w+)(?:\s*)\((\s*\w+(?:\.\w+)*\s*(?:\,\s*\w+(?:\.\w+)*\s*)*)?\)$/);
    Utils.assert(preMethodParts, 'Invalid prerequisite string method syntax');
    var helper = preMethodParts[1];
    Utils.assert(preMethodParts && server.helpers[helper], 'Unknown server helper method in prerequisite string');
    pre.assign = pre.assign || helper;
    var helperArgs = preMethodParts[2].split(/\s*\,\s*/);

    pre.method = function (helper, helperArgs, request, next) {

        var args = [];
        for (var i = 0, il = helperArgs.length; i < il; ++i) {
            var arg = helperArgs[i];
            args.push(Utils.reach(request, arg));
        }

        args.push(next);
        request.server.helpers[helper].apply(null, args);
    }.bind(null, helper, helperArgs);
};


internals.bindPre = function (pre) {

    /*
        {
            method: function (request, next) { }
            assign:     'key'
            output:     'raw'*      | 'response'
            failAction: 'error'*    | 'log'         | 'ignore'
        }
    */

    return function (request, next) {

        Ext.runProtected(request, 'pre', next, function (enter, exit) {

            var timer = new Utils.Bench();
            var finalize = function (result) {

                request._undecorateReply();

                if (result instanceof Error) {
                    if (pre.failAction !== 'ignore') {
                        request.log(['hapi', 'pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode, error: result });
                    }

                    if (pre.failAction === 'error') {
                        return exit(result);
                    }
                }
                else {
                    request.log(['hapi', 'pre'], { msec: timer.elapsed(), assign: pre.assign, mode: pre.mode });
                }

                var output = (!result.hasOwnProperty('_rawResult') || pre.output === 'response' ? result : result._rawResult);
                if (pre.assign) {
                    request.pre[pre.assign] = output;
                }

                request.server._dtrace.report('pre.end', pre.assign, output);
                return exit();
            };

            enter(function () {

                request.server._dtrace.report('pre.start', pre.assign);
                request._decorateReply(finalize);
                pre.method.call(request, request, request.reply);
            });
        });
    };
};
