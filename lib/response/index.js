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


internals.prepare = function (response, request, next) {

    var headers = function () {

        if (request.jsonp &&
            response._payload.jsonp) {

            response.type('text/javascript');
            response._payload.jsonp(request.jsonp);
        }

        if (response._payload.statusCode) {                      // Stream is an HTTP response
            response.statusCode = response._payload.statusCode;
        }

        Headers.apply(response, request, function (err) {

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

    if (response._payload) {
        return headers();
    }

    response._marshall(request, function (err) {

        if (err) {
            return next(err);
        }

        return headers();
    });
};


exports.send = function (item, request, callback) {

    var prepare = function (response, after) {

        if (response.isBoom) {
            return fail(response);
        }

        internals.prepare(response, request, function (err) {

            if (err) {
                return fail(err);
            }

            return after(response);
        });
    };

    var fail = function (boom) {

        var error = boom.response;
        var response = new Plain(error.payload);
        response._err = boom;
        response.code(error.code);

        Utils.merge(response.headers, error.headers);
        if (error.type) {
            response.type(error.type);
        }

        internals.prepare(response, request, function (err) {

            return send(response);          // Return the original error (which is partially prepared) instead of having to prepare the result error
        });
    };

    var etag = function (response) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return send(response);
        }

        // Process ETag

        var etag = (response.headers && response.headers.etag);
        if (etag &&
            request.headers['if-none-match'] === etag) {

            return unchanged();
        }

        // Process If-Modified-Since headers

        var ifModifiedSinceHeader = request.headers['if-modified-since'];
        var lastModifiedHeader = response.headers && response.headers['last-modified'];

        if (ifModifiedSinceHeader &&
            lastModifiedHeader) {

            var ifModifiedSince = Date.parse(ifModifiedSinceHeader);
            var lastModified = Date.parse(lastModifiedHeader);

            if (ifModifiedSince &&
                lastModified &&
                ifModifiedSince >= lastModified) {

                return unchanged();
            }
        }

        return send(response);
    };

    var unchanged = function () {

        var empty = new Plain();
        empty.code(304);
        return prepare(empty, send);
    };

    var send = function (response) {

        // Injection

        if (response.variety === 'plain' &&
            Shot.isInjection(request.raw.req)) {

            request.raw.res._hapi = { result: response.source };
        }

        internals.transmit(response, request, function () {

            request._response = response;                            // Error occurs late and should update request.response object
            request.log(['hapi', 'response']);
            return callback();
        });
    };

    prepare(item, etag);
};


internals.transmit = function (response, request, callback) {

    var source = response._payload;

    // Content encoding

    var encoder = null;
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

    var cleanup = (source === response._payload ? (source._hapi && source._hapi.gzipped) : response._payload);
    if (cleanup &&
        cleanup.destroy) {
            
        cleanup.destroy();          // Close file descriptor
    }

    // Write headers

    var headers = Object.keys(response.headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, response.headers[header]);
    }

    request.raw.res.writeHead(response.statusCode);

    // Write payload

    if (request.method === 'head') {
        response._preview.once('finish', function () {

            request.raw.res.end();
            callback();
        });

        response._preview.end();
        return;
    }

    var onAborted = null;
    var previewFinished = false;
    var hasEnded = false;
    var end = function (err, aborted) {

        if (!hasEnded) {
            hasEnded = true;

            if (!aborted) {
                request.raw.res.end();
            }

            var finalize = function () {

                source.removeListener('error', end);

                request.raw.req.removeListener('aborted', onAborted);
                request.raw.req.removeListener('close', end);

                request.raw.res.removeListener('close', end);
                request.raw.res.removeListener('error', end);
                request.raw.res.removeListener('finish', end);

                response._preview.removeAllListeners();

                callback();
            };

            if (previewFinished) {
                return finalize();
            }

            response._preview.once('finish', finalize);
            response._preview.end();
        }
    };

    source.once('error', end);

    onAborted = function () {

        end(null, true);
    };

    request.raw.req.once('aborted', onAborted);
    request.raw.req.once('close', end);

    request.raw.res.once('close', end);
    request.raw.res.once('error', end);
    request.raw.res.once('finish', end);

    response._preview.once('finish', function () {

        previewFinished = true;
    });

    var preview = source.pipe(response._preview);
    var encoded = (encoder ? preview.pipe(encoder) : preview);
    encoded.pipe(request.raw.res);
};

