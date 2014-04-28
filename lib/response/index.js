// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Boom = require('boom');
var Shot = require('shot');
var Negotiator = require('negotiator');
var Plain = require('./plain');
var Payload = require('./payload');
var Headers = require('./headers');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports.Plain = Plain;
exports.Payload = Payload;


exports.wrap = function (result, request) {

    var response = (result instanceof Error ? Boom.wrap(result)
                                            : (result instanceof Plain ? result : new Plain(result, request)));
    return response;
};


internals.setup = function (request, next) {

    request.response._marshall(request, function (err) {

        if (err) {
            return next(err.isBoom ? err : Boom.wrap(err));
        }

        return internals.headers(request, next);
    });
};


internals.headers = function (request, next) {

    var response = request.response;

    if (request.jsonp &&
        response._payload.jsonp) {

        response.type('text/javascript');
        response._payload.jsonp(request.jsonp);
    }

    Headers.apply(request, function (err) {

        if (err) {
            return next(err);
        }

        // Apply pass through headers

        if (response._payload.headers &&
            response.settings.passThrough) {

            var localCookies = Utils.clone(response.headers['set-cookie']);
            var localHeaders = response.headers;
            response.headers = Utils.clone(response._payload.headers);
            Utils.merge(response.headers, localHeaders);

            if (localCookies) {
                var headerKeys = Object.keys(response._payload.headers);
                for (var i = 0, il = headerKeys.length; i < il; ++i) {
                    if (headerKeys[i].toLowerCase() === 'set-cookie') {
                        delete response.headers[headerKeys[i]];
                        response._header('set-cookie', [].concat(response._payload.headers[headerKeys[i]]).concat(localCookies));
                        break;
                    }
                }
            }
        }

        return next();
    });
};


exports.send = function (request, callback) {

    var prepare = function () {

        var response = request.response;
        if (response.isBoom) {
            return fail(response);
        }

        internals.setup(request, function (err) {

            if (err) {
                request._setResponse(err);
                return fail(err);
            }

            return etag(response);
        });
    };

    var fail = function (boom) {

        var error = boom.output;
        var response = new Plain(error.payload, request);
        response.code(error.statusCode);
        Utils.merge(response.headers, error.headers);
        request.response = response;                            // Not using request._setResponse() to avoid double log

        internals.setup(request, function (/* err */) {

            // Return the original error (which is partially prepared) instead of having to prepare the result error
            return internals.transmit(response, request, callback);
        });
    };

    var etag = function (response) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return internals.transmit(response, request, callback);
        }

        if (response.headers.etag &&
            request.headers['if-none-match'] === response.headers.etag) {

            response.statusCode = 304;
        }
        else {
            var ifModifiedSinceHeader = request.headers['if-modified-since'];
            var lastModifiedHeader = response.headers['last-modified'];

            if (ifModifiedSinceHeader &&
                lastModifiedHeader) {

                var ifModifiedSince = Date.parse(ifModifiedSinceHeader);
                var lastModified = Date.parse(lastModifiedHeader);

                if (ifModifiedSince &&
                    lastModified &&
                    ifModifiedSince >= lastModified) {

                    response.statusCode = 304;
                }
            }
        }

        return internals.transmit(response, request, callback);
    };

    prepare();
};


internals.transmit = function (response, request, callback) {

    // Injection

    if (response.variety === 'plain' &&
        Shot.isInjection(request.raw.req)) {

        request.raw.res._hapi = { result: response.source };
    }

    // Setup source

    var source = response._payload;
    var encoder = null;

    if (request.method !== 'head' &&
        response.statusCode !== 304) {

        // Content encoding

        if (!response.headers['content-encoding']) {
            var negotiator = new Negotiator(request.raw.req);
            var encoding = negotiator.preferredEncoding(['gzip', 'deflate', 'identity']);
            if (encoding === 'deflate' || encoding === 'gzip') {
                var keys = Object.keys(response.headers);
                for (var i = 0, il = keys.length; i < il; ++i) {
                    var key = keys[i];
                    if (/content\-length/i.test(key)) {                 // Can be lowercase when coming from proxy
                        delete response.headers[key];
                    }
                }

                response._header('content-encoding', encoding);
                response.vary('accept-encoding');

                if (source._hapi &&
                    source._hapi.gzipped &&
                    encoding === 'gzip') {

                    source = source._hapi.gzipped;
                }
                else {
                    encoder = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
                }
            }
        }
    }
    else {
        source = new internals.Empty();
        delete response.headers['content-length'];
        delete response.headers.etag;
        delete response.headers['last-modified'];
    }

    // Close unused file streams

    if (source !== response._payload) {
        if (response._payload.close) {
            response._payload.close();          // Close file
        }
        else if (response._payload.destroy) {
            response._payload.destroy();        // Close upstream
        }
    }

    if (response._payload._hapi &&
        response._payload._hapi.gzipped &&
        source !== response._payload._hapi.gzipped &&
        response._payload._hapi.gzipped.close) {

        response._payload._hapi.gzipped.close();           // Close file
    }

    // Write headers

    var headers = Object.keys(response.headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, response.headers[header]);
    }

    request.raw.res.writeHead(response.statusCode);

    // Generate tap stream

    var tap = response._tap();

    // Write payload

    var hasEnded = false;
    var end = function (err, event) {

        if (!hasEnded) {
            hasEnded = true;

            if (event !== 'aborted') {
                request.raw.res.end();
            }

            source.removeListener('error', end);

            request.raw.req.removeListener('aborted', onAborted);
            request.raw.req.removeListener('close', onClose);

            request.raw.res.removeListener('close', onClose);
            request.raw.res.removeListener('error', end);
            request.raw.res.removeListener('finish', end);

            var tags = (err ? ['hapi', 'response', 'error']
                            : (event ? ['hapi', 'response', 'error', event]
                                     : ['hapi', 'response']));

            if (event || err) {
                request.emit('disconnect');
            }

            request.log(tags, err);
            callback();
        }
    };

    source.once('error', end);

    var onAborted = function () {

        end(null, 'aborted');
    };

    var onClose = function () {

        end(null, 'close');
    };

    request.raw.req.once('aborted', onAborted);
    request.raw.req.once('close', onClose);

    request.raw.res.once('close', onClose);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    var preview = (tap ? source.pipe(tap) : source);
    var encoded = (encoder ? preview.pipe(encoder) : preview);
    encoded.pipe(request.raw.res);
};


internals.Empty = function () {

    Stream.Readable.call(this);
};

Utils.inherits(internals.Empty, Stream.Readable);


internals.Empty.prototype._read = function (/* size */) {

    this.push(null);
};
