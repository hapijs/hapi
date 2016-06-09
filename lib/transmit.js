'use strict';

// Load modules

const Http = require('http');
const Stream = require('stream');
const Zlib = require('zlib');
const Ammo = require('ammo');
const Boom = require('boom');
const Hoek = require('hoek');
const Items = require('items');
const Shot = require('shot');
const Auth = require('./auth');
const Cors = require('./cors');
const Response = require('./response');
const compressStream = require('iltorb').compressStream;

// Declare internals

const internals = {};


exports.send = function (request, callback) {

    const response = request.response;
    if (response.isBoom) {
        return internals.fail(request, response, callback);
    }

    internals.marshal(request, (err) => {

        if (err) {
            request._setResponse(err);
            return internals.fail(request, err, callback);
        }

        return internals.transmit(response, callback);
    });
};


internals.marshal = function (request, next) {

    const response = request.response;

    Cors.headers(response);
    internals.content(response, false);
    internals.security(response);

    if (response.statusCode !== 304 &&
        (request.method === 'get' || request.method === 'head')) {

        if (response.headers.etag &&
            request.headers['if-none-match']) {

            // Strong verifier

            const ifNoneMatch = request.headers['if-none-match'].split(/\s*,\s*/);
            for (let i = 0; i < ifNoneMatch.length; ++i) {
                const etag = ifNoneMatch[i];
                if (etag === response.headers.etag) {
                    response.code(304);
                    break;
                }
                else if (response.settings.varyEtag) {
                    const etagBase = response.headers.etag.slice(0, -1);
                    if (etag === etagBase + '-gzip"' ||
                        etag === etagBase + '-deflate"' ||
                        etag === etagBase + '-br"') {

                        response.code(304);
                        break;
                    }
                }
            }
        }
        else {
            const ifModifiedSinceHeader = request.headers['if-modified-since'];
            const lastModifiedHeader = response.headers['last-modified'];

            if (ifModifiedSinceHeader &&
                lastModifiedHeader) {

                // Weak verifier

                const ifModifiedSince = internals.parseDate(ifModifiedSinceHeader);
                const lastModified = internals.parseDate(lastModifiedHeader);

                if (ifModifiedSince &&
                    lastModified &&
                    ifModifiedSince >= lastModified) {

                    response.code(304);
                }
            }
        }
    }

    internals.state(response, (err) => {

        if (err) {
            request._log(['state', 'response', 'error'], err);
            request._states = {};                                           // Clear broken state
            return next(err);
        }

        internals.cache(response);

        if (!response._isPayloadSupported()) {

            // Close unused file streams

            response._close();

            // Set empty stream

            response._payload = new internals.Empty();
            if (request.method !== 'head') {
                delete response.headers['content-length'];
            }

            return Auth.response(request, next);               // Must be last in case requires access to headers
        }

        response._marshal((err) => {

            if (err) {
                return next(Boom.wrap(err));
            }

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

            internals.content(response, true);
            return Auth.response(request, next);               // Must be last in case requires access to headers
        });
    });
};


internals.parseDate = function (string) {

    try {
        return Date.parse(string);
    }
    catch (errIgnore) { }
};


internals.fail = function (request, boom, callback) {

    const error = boom.output;
    const response = new Response(error.payload, request);
    response._error = boom;
    response.code(error.statusCode);
    response.headers = error.headers;
    request.response = response;                            // Not using request._setResponse() to avoid double log

    internals.marshal(request, (err) => {

        if (err) {

            // Failed to marshal an error - replace with minimal representation of original error

            const minimal = {
                statusCode: error.statusCode,
                error: Http.STATUS_CODES[error.statusCode],
                message: boom.message
            };

            response._payload = new Response.Payload(JSON.stringify(minimal), {});
        }

        return internals.transmit(response, callback);
    });
};


internals.transmit = function (response, callback) {

    // Setup source

    const request = response.request;
    const source = response._payload;
    const length = parseInt(response.headers['content-length'], 10);      // In case value is a string

    // Empty response

    if (length === 0 &&
        response.statusCode === 200 &&
        request.route.settings.response.emptyStatusCode === 204) {

        response.code(204);
        delete response.headers['content-length'];
    }

    // Compression

    const mime = request.server.mime.type(response.headers['content-type'] || 'application/octet-stream');
    let encoding = (request.connection.settings.compression && mime.compressible && !response.headers['content-encoding'] ? request.info.acceptEncoding : null);
    encoding = (encoding === 'identity' ? null : encoding);

    // Range

    let ranger = null;
    if (request.route.settings.response.ranges &&
        request.method === 'get' &&
        response.statusCode === 200 &&
        length > 0 &&
        !encoding) {

        if (request.headers.range) {

            // Check If-Range

            if (!request.headers['if-range'] ||
                request.headers['if-range'] === response.headers.etag) {            // Ignoring last-modified date (weak)

                // Parse header

                const ranges = Ammo.header(request.headers.range, length);
                if (!ranges) {
                    const error = Boom.rangeNotSatisfiable();
                    error.output.headers['content-range'] = 'bytes */' + length;
                    return internals.fail(request, error, callback);
                }

                // Prepare transform

                if (ranges.length === 1) {                                          // Ignore requests for multiple ranges
                    const range = ranges[0];
                    ranger = new Ammo.Stream(range);
                    response.code(206);
                    response.bytes(range.to - range.from + 1);
                    response._header('content-range', 'bytes ' + range.from + '-' + range.to + '/' + length);
                }
            }
        }

        response._header('accept-ranges', 'bytes');
    }

    // Content-Encoding

    if (request.headers['accept-encoding']) {
        response.vary('accept-encoding');
    }

    let compressor = null;
    if (encoding &&
        length !== 0 &&
        response._isPayloadSupported()) {

        delete response.headers['content-length'];
        response._header('content-encoding', encoding);
        compressor = (encoding === 'gzip' ? Zlib.createGzip() : (encoding === 'br' ? compressStream() : Zlib.createDeflate()));
    }

    if ((response.headers['content-encoding'] || encoding) &&
        response.headers.etag &&
        response.settings.varyEtag) {

        response.headers.etag = response.headers.etag.slice(0, -1) + '-' + (response.headers['content-encoding'] || encoding) + '"';
    }

    // Write headers

    const headers = Object.keys(response.headers);
    for (let i = 0; i < headers.length; ++i) {
        const header = headers[i];
        const value = response.headers[header];
        if (value !== undefined) {
            request.raw.res.setHeader(header, value);
        }
    }

    const isInjection = Shot.isInjection(request.raw.req);
    if (!isInjection && !request.connection._started) {
        request.raw.res.setHeader('connection', 'close');
    }

    request.raw.res.writeHead(response.statusCode);

    // Write payload

    let hasEnded = false;
    const end = (err, event) => {

        if (hasEnded) {
            return;
        }

        hasEnded = true;

        if (!request.raw.res.finished &&
            event !== 'aborted') {

            request.raw.res.end();
        }

        source.removeListener('error', end);

        request.raw.req.removeListener('aborted', onAborted);
        request.raw.req.removeListener('close', onClose);

        request.raw.res.removeListener('close', onClose);
        request.raw.res.removeListener('error', end);
        request.raw.res.removeListener('finish', end);

        const tags = (err ? ['response', 'error']
                        : (event ? ['response', 'error', event]
                                 : ['response']));

        if (event || err) {
            request.emit('disconnect');
        }

        request._log(tags, err);
        return callback();
    };

    source.once('error', end);

    const onAborted = () => {

        return end(null, 'aborted');
    };

    const onClose = () => {

        return end(null, 'close');
    };

    request.raw.req.once('aborted', onAborted);
    request.raw.req.once('close', onClose);

    request.raw.res.once('close', onClose);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    const tap = response._tap();
    const preview = (tap ? source.pipe(tap) : source);
    const compressed = (compressor ? preview.pipe(compressor) : preview);
    const ranged = (ranger ? compressed.pipe(ranger) : compressed);
    ranged.pipe(request.raw.res);

    // Injection

    if (isInjection) {
        request.raw.res._hapi = {
            request: request
        };

        if (response.variety === 'plain') {
            request.raw.res._hapi.result = response._isPayloadSupported() ? response.source : null;
        }
    }
};


internals.Empty = function () {

    Stream.Readable.call(this);
};

Hoek.inherits(internals.Empty, Stream.Readable);


internals.Empty.prototype._read = function (/* size */) {

    this.push(null);
};


internals.cache = function (response) {

    const request = response.request;

    if (response.headers['cache-control'] ||
        !request.route.settings.cache) {

        return;
    }

    const policy = request._route._cache && (request.route.settings.cache._statuses[response.statusCode] || (response.statusCode === 304 && request.route.settings.cache._statuses['200']));
    if (policy ||
        response.settings.ttl) {

        const ttl = (response.settings.ttl !== null ? response.settings.ttl : request._route._cache.ttl());
        const privacy = (request.auth.isAuthenticated || response.headers['set-cookie'] ? 'private' : request.route.settings.cache.privacy || 'default');
        response._header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
    }
    else {
        response._header('cache-control', 'no-cache');
    }
};


internals.security = function (response) {

    const request = response.request;

    const security = request.route.settings.security;
    if (security) {
        if (security._hsts) {
            response._header('strict-transport-security', security._hsts, { override: false });
        }

        if (security._xframe) {
            response._header('x-frame-options', security._xframe, { override: false });
        }

        if (security.xss) {
            response._header('x-xss-protection', '1; mode=block', { override: false });
        }

        if (security.noOpen) {
            response._header('x-download-options', 'noopen', { override: false });
        }

        if (security.noSniff) {
            response._header('x-content-type-options', 'nosniff', { override: false });
        }
    }
};


internals.content = function (response, postMarshal) {

    const type = response.headers['content-type'];
    if (!type) {
        if (response._contentType) {
            const charset = (response.settings.charset && response._contentType !== 'application/octet-stream' ? '; charset=' + response.settings.charset : '');
            response.type(response._contentType + charset);
        }
    }
    else if ((!response._contentType || !postMarshal) &&
        response.settings.charset &&
        type.match(/^(?:text\/)|(?:application\/(?:json)|(?:javascript))/)) {

        const hasParams = (type.indexOf(';') !== -1);
        if (!hasParams ||
            !type.match(/[; ]charset=/)) {

            response.type(type + (hasParams ? ', ' : '; ') + 'charset=' + (response.settings.charset));
        }
    }
};


internals.state = function (response, next) {

    const request = response.request;

    const names = {};
    const states = [];

    const requestStates = Object.keys(request._states);
    for (let i = 0; i < requestStates.length; ++i) {
        const stateName = requestStates[i];
        names[stateName] = true;
        states.push(request._states[stateName]);
    }

    const each = (name, nextKey) => {

        const autoValue = request.connection.states.cookies[name].autoValue;
        if (!autoValue || names[name]) {
            return nextKey();
        }

        names[name] = true;

        if (typeof autoValue !== 'function') {
            states.push({ name: name, value: autoValue });
            return nextKey();
        }

        autoValue(request, (err, value) => {

            if (err) {
                return nextKey(err);
            }

            states.push({ name: name, value: value });
            return nextKey();
        });
    };

    const keys = Object.keys(request.connection.states.cookies);
    Items.parallel(keys, each, (err) => {

        if (err) {
            return next(Boom.wrap(err));
        }

        if (!states.length) {
            return next();
        }

        request.connection.states.format(states, (err, header) => {

            if (err) {
                return next(Boom.wrap(err));
            }

            const existing = response.headers['set-cookie'];
            if (existing) {
                header = (Array.isArray(existing) ? existing : [existing]).concat(header);
            }

            response._header('set-cookie', header);
            return next();
        });
    });
};
