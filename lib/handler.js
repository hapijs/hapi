'use strict';

// Load modules

const Hoek = require('hoek');


// Declare internals

const internals = {};


exports.execute = async function (request) {

    // Prerequisites

    if (request._route._prerequisites) {
        for (let i = 0; i < request._route._prerequisites.length; ++i) {        // Serial execution of each set
            const set = request._route._prerequisites[i];
            const pres = [];
            for (let j = 0; j < set.length; ++j) {
                pres.push(internals.handler(request, set[j].method, set[j]));
            }

            const responses = await Promise.all(pres);                          // Parallel execution within sets

            for (let j = 0; j < responses.length; ++j) {
                if (responses[j] !== undefined) {
                    return responses[j];
                }
            }
        }
    }

    // Handler

    const result = await internals.handler(request, request.route.settings.handler);
    if (result._takeover ||
        typeof result === 'symbol') {

        return result;
    }

    request._setResponse(result);
};


internals.handler = async function (request, method, pre) {

    const bind = request.route.settings.bind;
    const realm = request.route.realm;
    let response = await request._core.toolkit.execute(method, request, { bind, realm, continue: 'null' });

    // Handler

    if (!pre) {
        if (response.isBoom) {
            request._log(['handler', 'error'], response);
            throw response;
        }

        return response;
    }

    // Pre

    if (response.isBoom) {
        response.assign = pre.assign;
        response = await request._core.toolkit.failAction(request, pre.failAction, response, { tags: ['pre', 'error'], retain: true });
    }

    if (typeof response === 'symbol') {
        return response;
    }

    if (pre.assign) {
        request.pre[pre.assign] = (response.isBoom ? response : response.source);
        request.preResponses[pre.assign] = response;
    }

    if (response._takeover) {
        return response;
    }
};


exports.defaults = function (method, handler, core) {

    let defaults = null;

    if (typeof handler === 'object') {
        const type = Object.keys(handler)[0];
        const serverHandler = core._decorations.handler[type];

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
        const serverHandler = route._core._decorations.handler[type];

        Hoek.assert(serverHandler, 'Unknown handler:', type);

        return serverHandler(route.public, handler[type]);
    }

    return handler;
};


exports.prerequisitesConfig = function (config) {

    if (!config) {
        return null;
    }

    /*
        [
            [
                function (request, h) { },
                {
                    method: function (request, h) { }
                    assign: key1
                },
                {
                    method: function (request, h) { },
                    assign: key2
                }
            ],
            {
                method: function (request, h) { },
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

            set.push(item);
        }

        prerequisites.push(set);
    }

    return prerequisites.length ? prerequisites : null;
};
