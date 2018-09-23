'use strict';

// Load modules

const Hoek = require('hoek');


// Declare internals

const internals = {};


exports.execute = async function (request) {

    // Prerequisites

    if (request._route._prerequisites) {
        for (const set of request._route._prerequisites) {      // Serial execution of each set
            const pres = [];
            for (const item of set) {
                pres.push(internals.handler(request, item.method, item));
            }

            const responses = await Promise.all(pres);                          // Parallel execution within sets
            for (const response of responses) {
                if (response !== undefined) {
                    return response;
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

    for (let pres of config) {
        pres = [].concat(pres);

        const set = [];
        for (let pre of pres) {
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
