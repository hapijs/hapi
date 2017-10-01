'use strict';

// Load modules

const Http = require('http');

const Ammo = require('ammo');
const Boom = require('boom');
const Hoek = require('hoek');
const Shot = require('shot');
const Teamwork = require('teamwork');

const Response = require('./response');


// Declare internals

const internals = {};


exports.send = async function (request) {

    const response = request.response;
    if (response.isBoom) {
        return internals.fail(request, response);
    }

    try {
        await internals.marshal(request);
        await internals.transmit(response);
    }
    catch (err) {
        request._setResponse(err);
        return internals.fail(request, err);
    }
};


internals.marshal = async function (request) {

    for (let i = 0; i < request._route._marshalCycle.length; ++i) {
        const func = request._route._marshalCycle[i];
        await func(request);
    }
};


internals.fail = async function (request, boom) {

    const error = boom.output;
    const response = new Response(error.payload, request);
    response._error = boom;
    response.code(error.statusCode);
    response.headers = Hoek.clone(error.headers);           // Prevent source from being modified
    request.response = response;                            // Not using request._setResponse() to avoid double log

    try {
        await internals.marshal(request);
    }
    catch (err) {

        // Failed to marshal an error - replace with minimal representation of original error

        const minimal = {
            statusCode: error.statusCode,
            error: Http.STATUS_CODES[error.statusCode],
            message: boom.message
        };

        response._payload = new Response.Payload(JSON.stringify(minimal), {});
    }

    return internals.transmit(response);
};


internals.transmit = function (response) {

    const request = response.request;
    const length = parseInt(response.headers['content-length'], 10);      // In case value is a string

    // Empty response

    if (length === 0 &&
        response.statusCode === 200 &&
        request.route.settings.response.emptyStatusCode === 204) {

        response.code(204);
        delete response.headers['content-length'];
    }

    // Compression

    const encoding = request.server.root._compression.encoding(response);

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
                    return internals.fail(request, error);
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

    let compressor = null;
    if (encoding &&
        length !== 0 &&
        response.statusCode !== 206 &&
        response._isPayloadSupported()) {

        delete response.headers['content-length'];
        response._header('content-encoding', encoding);

        compressor = request.server.root._compression.encoder(request, encoding);
    }

    if ((response.headers['content-encoding'] || encoding) &&
        response.headers.etag &&
        response.settings.varyEtag) {

        response.headers.etag = response.headers.etag.slice(0, -1) + '-' + (response.headers['content-encoding'] || encoding) + '"';
    }

    // Connection: close

    const isInjection = Shot.isInjection(request.raw.req);
    if (!(isInjection || request.server._started) ||
        (request._isPayloadPending && !request.raw.req._readableState.ended)) {

        response._header('connection', 'close');
    }

    // Write headers

    internals.writeHead(response);

    // Injection

    if (isInjection) {
        request.raw.res._hapi = { request };

        if (response.variety === 'plain') {
            request.raw.res._hapi.result = response._isPayloadSupported() ? response.source : null;
        }
    }

    return internals.pipe(response, compressor, ranger);
};


internals.pipe = function (response, compressor, ranger) {

    const request = response.request;
    const source = response._payload;
    const team = new Teamwork.Team({ meetings: 1 });

    // Write payload

    const end = (err, event) => {

        source.removeListener('error', end);

        request.raw.req.removeListener('aborted', onAborted);
        request.raw.req.removeListener('close', onClose);

        request.raw.res.removeListener('close', onClose);
        request.raw.res.removeListener('error', end);
        request.raw.res.removeListener('finish', end);

        if (err) {
            request.raw.res.destroy();

            if (request.raw.res._hapi) {
                request.raw.res.statusCode = 500;
                request.raw.res._hapi.result = Boom.boomify(err).output.payload;           // Force injected response to error
            }

            source.unpipe();
            Response.drain(source);
        }

        if (!request.raw.res.finished &&
            event !== 'aborted') {

            request.raw.res.end();
        }

        if ((event || err) &&
            request._events) {

            request._events.emit('disconnect');
        }

        const tags = (err ? ['response', 'error'] : (event ? ['response', 'error', event] : ['response']));
        request._log(tags, err);
        team.attend();
    };

    source.once('error', end);

    const onAborted = () => end(null, 'aborted');
    const onClose = () => end(null, 'close');

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

    return team.work;
};


internals.writeHead = function (response) {

    const res = response.request.raw.res;
    const headers = Object.keys(response.headers);
    let i = 0;

    try {
        for (; i < headers.length; ++i) {
            const header = headers[i];
            const value = response.headers[header];
            if (value !== undefined) {
                res.setHeader(header, value);
            }
        }
    }
    catch (err) {

        for (--i; i >= 0; --i) {
            res.setHeader(headers[i], null);        // Undo headers
        }

        throw Boom.boomify(err);
    }

    if (response.settings.message) {
        res.statusMessage = response.settings.message;
    }

    try {
        res.writeHead(response.statusCode);
    }
    catch (err) {
        throw Boom.boomify(err);
    }
};
