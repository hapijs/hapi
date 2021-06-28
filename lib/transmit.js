'use strict';

const Http = require('http');

const Ammo = require('@hapi/ammo');
const Boom = require('@hapi/boom');
const Bounce = require('@hapi/bounce');
const Hoek = require('@hapi/hoek');
const Teamwork = require('@hapi/teamwork');

const Config = require('./config');


const internals = {};


exports.send = async function (request) {

    const response = request.response;

    try {
        if (response.isBoom) {
            await internals.fail(request, response);
            return;
        }

        await internals.marshal(response);
        await internals.transmit(response);
    }
    catch (err) {
        Bounce.rethrow(err, 'system');
        request._setResponse(err);
        return internals.fail(request, err);
    }
};


internals.marshal = async function (response) {

    for (const func of response.request._route._marshalCycle) {
        if (response._state !== 'close') {
            await func(response);
        }
    }
};


internals.fail = async function (request, boom) {

    const response = internals.error(request, boom);
    request.response = response;                                // Not using request._setResponse() to avoid double log

    try {
        await internals.marshal(response);
    }
    catch (err) {
        Bounce.rethrow(err, 'system');

        // Failed to marshal an error - replace with minimal representation of original error

        const minimal = {
            statusCode: response.statusCode,
            error: Http.STATUS_CODES[response.statusCode],
            message: boom.message
        };

        response._payload = new request._core.Response.Payload(JSON.stringify(minimal), {});
    }

    return internals.transmit(response);
};


internals.error = function (request, boom) {

    const error = boom.output;
    const response = new request._core.Response(error.payload, request, { error: boom });
    response.code(error.statusCode);
    response.headers = Hoek.clone(error.headers);               // Prevent source from being modified
    return response;
};


internals.transmit = function (response) {

    const request = response.request;
    const length = internals.length(response);

    // Pipes

    const encoding = request._core.compression.encoding(response, length);
    const ranger = encoding ? null : internals.range(response, length);
    const compressor = internals.encoding(response, encoding);

    // Connection: close

    const isInjection = request.isInjected;
    if (!(isInjection || request._core.started) ||
        request._isPayloadPending && !request.raw.req._readableState.ended) {

        response._header('connection', 'close');
    }

    // Write headers

    internals.writeHead(response);

    // Injection

    if (isInjection) {
        request.raw.res[Config.symbol] = { request };

        if (response.variety === 'plain') {
            request.raw.res[Config.symbol].result = response._isPayloadSupported() ? response.source : null;
        }
    }

    // Finalize response stream

    const stream = internals.chain([response._payload, response._tap(), compressor, ranger]);
    return internals.pipe(request, stream);
};


internals.length = function (response) {

    const request = response.request;

    const header = response.headers['content-length'];
    if (header === undefined) {
        return null;
    }

    let length = header;
    if (typeof length === 'string') {
        length = parseInt(header, 10);
        if (!isFinite(length)) {
            delete response.headers['content-length'];
            return null;
        }
    }

    // Empty response

    if (length === 0 &&
        !response._statusCode &&
        response.statusCode === 200 &&
        request.route.settings.response.emptyStatusCode !== 200) {

        response.code(204);
        delete response.headers['content-length'];
    }

    return length;
};


internals.range = function (response, length) {

    const request = response.request;

    if (!length ||
        !request.route.settings.response.ranges ||
        request.method !== 'get' ||
        response.statusCode !== 200) {

        return null;
    }

    response._header('accept-ranges', 'bytes');

    if (!request.headers.range) {
        return null;
    }

    // Check If-Range

    if (request.headers['if-range'] &&
        request.headers['if-range'] !== response.headers.etag) {            // Ignoring last-modified date (weak)

        return null;
    }

    // Parse header

    const ranges = Ammo.header(request.headers.range, length);
    if (!ranges) {
        const error = Boom.rangeNotSatisfiable();
        error.output.headers['content-range'] = 'bytes */' + length;
        throw error;
    }

    // Prepare transform

    if (ranges.length !== 1) {                                              // Ignore requests for multiple ranges
        return null;
    }

    const range = ranges[0];
    response.code(206);
    response.bytes(range.to - range.from + 1);
    response._header('content-range', 'bytes ' + range.from + '-' + range.to + '/' + length);

    return new Ammo.Clip(range);
};


internals.encoding = function (response, encoding) {

    const request = response.request;

    const header = response.headers['content-encoding'] || encoding;
    if (header &&
        response.headers.etag &&
        response.settings.varyEtag) {

        response.headers.etag = response.headers.etag.slice(0, -1) + '-' + header + '"';
    }

    if (!encoding ||
        response.statusCode === 206 ||
        !response._isPayloadSupported()) {

        return null;
    }

    delete response.headers['content-length'];
    response._header('content-encoding', encoding);
    const compressor = request._core.compression.encoder(request, encoding);
    if (response.variety === 'stream' &&
        typeof response._payload.setCompressor === 'function') {

        response._payload.setCompressor(compressor);
    }

    return compressor;
};


internals.pipe = function (request, stream) {

    const team = new Teamwork.Team();

    // Write payload

    const env = { stream, request, team };

    if (request._closed) {
        // No more events will be fired, so we proactively close-up shop
        request.raw.res.end(); // Ensure res is finished so internals.end() doesn't think we're responding
        internals.end(env, 'close');
        return team.work;
    }

    const aborted = internals.end.bind(null, env, 'aborted');
    const close = internals.end.bind(null, env, 'close');
    const end = internals.end.bind(null, env, null);

    request.raw.req.on('aborted', aborted);

    request.raw.res.on('close', close);
    request.raw.res.on('error', end);
    request.raw.res.on('finish', end);

    if (stream.writeToStream) {
        stream.writeToStream(request.raw.res);
    }
    else {
        stream.on('error', end);
        stream.pipe(request.raw.res);
    }

    return team.work;
};


internals.end = function (env, event, err) {

    const { request, stream, team } = env;

    if (!team) {                                                        // Used instead of cleaning up emitter listeners
        return;
    }

    env.team = null;

    if (request.raw.res.finished) {
        if (!event) {
            request.info.responded = Date.now();
        }

        team.attend();
        return;
    }

    if (err) {
        request.raw.res.destroy();
        request._core.Response.drain(stream);
    }

    err = err || new Boom.Boom(`Request ${event}`, { statusCode: request.route.settings.response.disconnectStatusCode });
    const error = internals.error(request, Boom.boomify(err));
    request._setResponse(error);

    if (request.raw.res[Config.symbol]) {
        request.raw.res[Config.symbol].statusCode = error.statusCode;
        request.raw.res[Config.symbol].statusMessage = error.source.error;
        request.raw.res[Config.symbol].result = error.source;       // Force injected response to error
    }

    if (event) {
        request._log(['response', 'error', event]);
    }
    else {
        request._log(['response', 'error'], err);
    }

    request.raw.res.end();                                          // Triggers injection promise resolve
    team.attend();
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
            res.removeHeader(headers[i]);       // Undo headers
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


internals.chain = function (sources) {

    let from = sources[0];
    for (let i = 1; i < sources.length; ++i) {
        const to = sources[i];
        if (to) {
            from.on('error', internals.errorPipe.bind(from, to));
            from = from.pipe(to);
        }
    }

    return from;
};


internals.errorPipe = function (to, err) {

    to.emit('error', err);
};
