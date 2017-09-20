'use strict';

// Load modules

const Hoek = require('hoek');
const Boom = require('boom');

const Response = require('./response');


// Declare internals

const internals = {};


exports.execute = async function (request) {

    try {
        // Prerequisites

        if (request._route._prerequisites) {
            for (let i = 0; i < request._route._prerequisites.length; ++i) {        // Serial execution of each set
                const set = request._route._prerequisites[i];
                const pres = [];
                for (let j = 0; j < set.length; ++j) {
                    pres.push(set[j](request));
                }

                const responses = await Promise.all(pres);                          // Parallel execution within sets

                for (let j = 0; j < responses.length; ++j) {
                    if (responses[j] !== undefined) {
                        request._setResponse(responses[j]);
                        return;
                    }
                }
            }
        }

        // Handler

        const result = await internals.handler(request);
        request._setResponse(result);
    }
    catch (err) {
        request._setResponse(err);
    }
};


internals.handler = async function (request) {

    // Setup environment

    const reply = request.server._blah.interface(request, request.route.realm);
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

    let signal = request.server._blah.signal(response);
    if (signal === 'continue') {
        response = null;
        signal = null;
    }

    if (!signal) {
        response = Response.wrap(response, request);

        if (!response.isBoom) {
            response = await response._prepare();
        }

        // <-> Cannot use an else here because response can chance in between _prepare and isBoom

        if (response.isBoom) {
            request._log(['handler', 'error'], { msec: timer.elapsed(), error: response.message, data: response });
            throw response;
        }
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
            {
                method: function (request, reply) { },
                assign: key3
            }
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

            set.push(internals.pre(item));
        }

        prerequisites.push(set);
    }

    return prerequisites.length ? prerequisites : null;
};


internals.pre = function (pre) {

    /*
        {
            method: function (request, reply) { }
            assign:     'key'
            failAction: 'error'* | 'log' | 'ignore'
        }
    */

    return async function (request) {

        // Setup environment

        const reply = request.server._blah.interface(request, request.route.realm);
        const bind = request.route.settings.bind;

        // Execute handler

        const timer = new Hoek.Bench();

        let response;
        try {
            response = await pre.method.call(bind, request, reply);
        }
        catch (err) {
            response = err instanceof Error ? Boom.boomify(err) : Boom.badImplementation('Unhandled rejected promise', err);
        }

        // Process response

        if (response === undefined) {
            response = Boom.badImplementation('Pre method did not return a value or a promise');
        }

        let signal = request.server._blah.signal(response);
        if (signal === 'continue') {
            response = null;
            signal = null;
        }

        if (!signal) {
            response = Response.wrap(response, request);

            if (!response.isBoom) {
                response = await response._prepare();
            }

            // <-> Cannot use an else here because response can chance in between _prepare and isBoom

            if (response.isBoom) {
                if (pre.failAction !== 'ignore') {
                    request._log(['pre', 'error'], { msec: timer.elapsed(), assign: pre.assign, error: response });
                }

                if (pre.failAction === 'error') {
                    throw response;
                }
            }
        }

        request._log(['pre'], { msec: timer.elapsed(), assign: pre.assign });

        if (signal === 'close') {
            return response;
        }

        if (pre.assign) {
            request.pre[pre.assign] = (response instanceof Error ? response : response.source);
            request.preResponses[pre.assign] = response;
        }

        if (response._takeover) {
            return response;
        }
    };
};
