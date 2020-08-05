'use strict';


const Stream = require('stream');

const Boom = require('@hapi/boom');


const internals = {};


exports.cache = function (request) {

    const response = request.response;
    if (response.headers['cache-control']) {
        return;
    }

    const settings = request.route.settings.cache;
    const policy = settings && request._route._cache && (settings._statuses.has(response.statusCode) || (response.statusCode === 304 && settings._statuses.has(200)));

    if (policy ||
        response.settings.ttl) {

        const ttl = response.settings.ttl !== null ? response.settings.ttl : request._route._cache.ttl();
        const privacy = request.auth.isAuthenticated || response.headers['set-cookie'] ? 'private' : settings.privacy || 'default';
        response._header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
    }
    else if (settings) {
        response._header('cache-control', settings.otherwise);
    }
};


exports.content = async function (request) {

    const response = request.response;
    if (response._isPayloadSupported() ||
        request.method === 'head') {

        await response._marshal();

        if (request.jsonp &&
            response._payload.jsonp) {

            response._header('content-type', 'text/javascript' + (response.settings.charset ? '; charset=' + response.settings.charset : ''));
            response._header('x-content-type-options', 'nosniff');
            response._payload.jsonp(request.jsonp);
        }

        if (response._payload.size &&
            typeof response._payload.size === 'function') {

            response._header('content-length', response._payload.size(), { override: false });
        }

        if (!response._isPayloadSupported()) {
            response._close();                              // Close unused file streams
            response._payload = new internals.Empty();      // Set empty stream
        }

        exports.type(request);
    }
    else {

        // Set empty stream

        response._close();                                  // Close unused file streams
        response._payload = new internals.Empty();
        delete response.headers['content-length'];
    }
};


exports.state = async function (request) {

    const response = request.response;
    const states = [];

    for (const stateName in request._states) {
        states.push(request._states[stateName]);
    }

    try {
        for (const name in request._core.states.cookies) {
            const autoValue = request._core.states.cookies[name].autoValue;
            if (!autoValue || name in request._states || name in request.state) {
                continue;
            }

            if (typeof autoValue !== 'function') {
                states.push({ name, value: autoValue });
                continue;
            }

            const value = await autoValue(request);
            states.push({ name, value });
        }

        if (!states.length) {
            return;
        }

        let header = await request._core.states.format(states, request);
        const existing = response.headers['set-cookie'];
        if (existing) {
            header = (Array.isArray(existing) ? existing : [existing]).concat(header);
        }

        response._header('set-cookie', header);
    }
    catch (err) {
        const error = Boom.boomify(err);
        request._log(['state', 'response', 'error'], error);
        request._states = {};                                           // Clear broken state
        throw error;
    }
};


exports.type = function (request) {

    const response = request.response;
    const type = response.contentType;
    if (type !== null && type !== response.headers['content-type']) {
        response.type(type);
    }
};


exports.entity = function (request) {

    if (!request._entity) {
        return;
    }

    const response = request.response;

    if (request._entity.etag &&
        !response.headers.etag) {

        response.etag(request._entity.etag, { vary: request._entity.vary });
    }

    if (request._entity.modified &&
        !response.headers['last-modified']) {

        response.header('last-modified', request._entity.modified);
    }
};


exports.unmodified = function (request) {

    const response = request.response;
    if (response.statusCode === 304) {
        return;
    }

    const entity = {
        etag: response.headers.etag,
        vary: response.settings.varyEtag,
        modified: response.headers['last-modified']
    };

    const etag = request._core.Response.unmodified(request, entity);
    if (etag) {
        response.code(304);

        if (etag !== true) {                                // Override etag with incoming weak match
            response.headers.etag = etag;
        }
    }
};


internals.Empty = class extends Stream.Readable {

    _read(/* size */) {

        this.push(null);
    }

    writeToStream(stream) {

        stream.end();
    }
};
