'use strict';

// Load modules

const Hoek = require('hoek');
const Boom = require('boom');
const Items = require('items');
const Methods = require('./methods');
const Response = require('./response');


// Declare internals

const internals = {};


exports.execute = function (request, next) {

    const finalize = (err, result) => {

        request._setResponse(err || result);
        return next();                              // Must not include an argument
    };

    if (request._route._prerequisites) {
        return internals.prerequisites(request, Hoek.once(finalize));
    }

    return internals.handler(request).then((result) => finalize(null, result)).catch(finalize);
};


internals.prerequisites = function (request, callback) {

    const each = (set, nextSet) => {

        Items.parallel(set, (pre, next) => {

            pre(request, (err, result) => {

                if (err) {
                    return next(err);
                }

                if (result._takeover) {
                    return callback(null, result);
                }

                return next();
            });
        }, nextSet);
    };

    Items.serial(request._route._prerequisites, each, (err) => {

        if (err) {
            return callback(err);
        }

        return internals.handler(request).then((result) => callback(null, result)).catch(callback);
    });
};


internals.handler = async function (request) {

    // Decorate request

    const reply = request.server._blah.interface(request, request.route.realm, {});
    const bind = request.route.settings.bind;

    // Execute handler

    const timer = new Hoek.Bench();

    let response;
    try {
        response = await request.route.settings.handler.call(bind, request, reply);
    }
    catch (err) {
        response = err instanceof Error ? Boom.boomify(err) : Boom.badImplementation('Unhandled rejected promise', err);
    }

    // Process response

    if (response === undefined) {
        response = Boom.badImplementation('Route handler did not return a value or a promise');
    }

    if (!request.server._blah.signal(response)) {
        response = Response.wrap(response, request);

        if (response.isBoom) {
            request._log(['handler', 'error'], { msec: timer.elapsed(), error: response.message, data: response });
            throw response;
        }

        await response._prepare();
    }

    request._log(['handler'], { msec: timer.elapsed() });
    return response;
};


exports.defaults = function (method, handler, server) {

    let defaults = null;

    if (typeof handler === 'object') {
        const type = Object.keys(handler)[0];
        const serverHandler = server._handlers[type];

        Hoek.assert(serverHandler, 'Unknown handler:', type);

        if (serverHandler.defaults) {
            defaults = (typeof serverHandler.defaults === 'function' ? serverHandler.defaults(method) : serverHandler.defaults);
        }
    }

    return defaults || {};
};


exports.configure = function (handler, route) {

    if (typeof handler === 'object') {
        const type = Object.keys(handler)[0];
        const serverHandler = route.server._handlers[type];

        Hoek.assert(serverHandler, 'Unknown handler:', type);

        return serverHandler(route.public, handler[type]);
    }

    if (typeof handler === 'string') {
        const parsed = internals.fromString('handler', handler, route.server);
        return parsed.method;
    }

    return handler;
};


exports.prerequisitesConfig = function (config, server) {

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

    const prerequisites = [];

    for (let i = 0; i < config.length; ++i) {
        const pres = [].concat(config[i]);

        const set = [];
        for (let j = 0; j < pres.length; ++j) {
            let pre = pres[j];
            if (typeof pre !== 'object') {
                pre = { method: pre };
            }

            const item = {
                method: pre.method,
                assign: pre.assign,
                failAction: pre.failAction || 'error'
            };

            if (typeof item.method === 'string') {
                const parsed = internals.fromString('pre', item.method, server);
                item.method = parsed.method;
                item.assign = item.assign || parsed.name;
            }

            set.push(internals.pre(item));
        }

        prerequisites.push(set);
    }

    return prerequisites.length ? prerequisites : null;
};


internals.fromString = function (type, notation, server) {

    //                                  1:name            2:(        3:arguments
    const methodParts = notation.match(/^([\w\.]+)(?:\s*)(?:(\()(?:\s*)(\w+(?:\.\w+)*(?:\s*\,\s*\w+(?:\.\w+)*)*)?(?:\s*)\))?$/);
    Hoek.assert(methodParts, 'Invalid server method string notation:', notation);

    const name = methodParts[1];
    Hoek.assert(name.match(Methods.methodNameRx), 'Invalid server method name:', name);

    const method = server._methods._normalized[name];
    Hoek.assert(method, 'Unknown server method in string notation:', notation);

    const result = { name };
    const argsNotation = !!methodParts[2];
    const methodArgs = (argsNotation ? (methodParts[3] || '').split(/\s*\,\s*/) : null);

    result.method = (request, reply) => {

        if (!argsNotation) {
            return method(request, reply);                      // Method is already bound to context
        }

        const finalize = (err, value, cached, report) => {

            if (report) {
                request._log([type, 'method', name], report);
            }

            return reply(err, value);
        };

        const args = [];
        for (let i = 0; i < methodArgs.length; ++i) {
            const arg = methodArgs[i];
            if (arg) {
                args.push(Hoek.reach(request, arg));
            }
        }

        args.push(finalize);
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

    return (request, next) => {

        const timer = new Hoek.Bench();
        const finalize = (response) => {

            if (response === null) {                            // reply.continue()
                response = Response.wrap(null, request);
                return response._prepare(finalize);
            }

            if (response instanceof Error) {
                if (pre.failAction !== 'ignore') {
                    request._log(['pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, error: response });
                }

                if (pre.failAction === 'error') {
                    return next(response);
                }
            }
            else {
                request._log(['pre'], { msec: timer.elapsed(), assign: pre.assign });
            }

            if (pre.assign) {
                request.pre[pre.assign] = (response instanceof Error ? response : response.source);
                request.preResponses[pre.assign] = response;
            }

            return next(null, response);
        };

        // Setup environment

        const reply = request.server._replier.interface(request, request.route.realm, {}, finalize);
        const bind = request.route.settings.bind;

        // Execute handler

        pre.method.call(bind, request, reply);
    };
};
