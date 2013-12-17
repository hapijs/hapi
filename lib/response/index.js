// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Boom = require('boom');
var Shot = require('shot');
var Negotiator = require('negotiator');
var Utils = require('../utils');


// Declare internals

var internals = {
    maxNestedPreparations: 5
};


/*
                 /-- Stream ---|--- File
                |
    (Generic) --|--- Buffer
                |
                |--- Text -----|-- Redirection
                |
                |--- Empty
                |
                |--- View
                |
                |--- Obj ------|-- (Error)
                |
                 \-- (Cached)
    (Closed)
*/

exports.Generic = internals.Generic = require('./generic');
exports.Empty = internals.Empty = require('./empty');
exports.Obj = internals.Obj = require('./obj');
exports.Text = internals.Text = require('./text');
exports.Stream = internals.Stream = require('./stream');
exports.File = internals.File = require('./file');
exports.Redirection = internals.Redirection = require('./redirection');
exports.View = internals.View = require('./view');
exports.Buffer = internals.Buffer = require('./buffer');

// Internal response types

internals.Error = require('./error');
internals.Cached = require('./cached');


// Utilities

exports._generate = function (result, request, onSend) {

    var response = null;

    if (result === null ||
        result === undefined ||
        result === '') {

        response = new internals.Empty();
    }
    else if (typeof result === 'string') {
        response = new internals.Text(result);
    }
    else if (typeof result === 'object') {
        if (Buffer.isBuffer(result)) {
            response = new internals.Buffer(result);
        }
        else if (result.isHapiResponse ||
                 (result.isBoom && result instanceof Error)) {      // Checking 'instanceof Boom' is unreliable

            response = result;
        }
        else if (result instanceof Error) {
            response = new Boom(result);
        }
        else if (result instanceof Stream) {
            response = new internals.Stream(result);
        }
    }

    if (!response) {
        response = new internals.Obj(result);
    }

    if (response.isHapiResponse) {
        response._rawResult = result;
    }

    if (request.method !== 'post' &&
        request.method !== 'put') {

        response.created = undefined;                               // Can't delete off prototype
    }

    if (!onSend) {
        return response;
    }

    response.hold = function () {

        delete response.hold;

        response.send = function () {

            delete response.send;
            onSend(response);
        };

        return response;
    };

    process.nextTick(function () {

        delete response.hold;

        if (!response.send) {
            onSend(response);
        }
    });

    return response;
};


exports._prepare = function (item, request, callback) {

    var prepareCount = 0;

    var prepare = function (response) {

        if (!response ||
            (!response.variety && !response.isBoom)) {

            return callback(Boom.badImplementation('Unexpected response item', response));
        }

        if (response._payload ||
            response.isBoom) {

            return callback(response);
        }

        response._prepare(request, function (result) {

            if (result._payload ||
                result.isBoom) {

                return callback(result);
            }

            ++prepareCount;
            if (prepareCount > internals.maxNestedPreparations) {    // Prevent prepare loops
                return callback(Boom.badImplementation('Response prepare count exceeded maximum allowed', item));
            }

            return prepare(result);
        });
    };

    prepare(item);
};


exports._respond = function (item, request, callback) {

    var prepare = function (response) {

        if (!response.isBoom) {
            return etag(response);
        }

        response = new internals.Error(response);
        response._prepare(request, function (result) {

            if (!result.isBoom) {
                return send(result);
            }

            return send(response);      // Return the original error (which is partially prepared) instead of having to prepare the result error
        });
    };

    var etag = function (response) {

        if (request.method !== 'get' &&
            request.method !== 'head') {

            return send(response);
        }

        // Process ETag

        var etag = response._headers && response._headers.etag;
        if (etag &&
            request.headers['if-none-match'] === etag) {

            return unchanged();
        }

        // Process If-Modified-Since headers

        var ifModifiedSinceHeader = request.headers['if-modified-since'];
        var lastModifiedHeader = response._headers && response._headers['last-modified'];

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

        var empty = new internals.Empty();
        empty.code(304);
        exports._prepare(empty, request, send);
    };

    var send = function (response) {

        // Injection

        if (response.varieties.obj &&
            Shot.isInjection(request.raw.req)) {

            request.raw.res.hapi = { result: response.source };
        }

        internals.transmit(response, request, function () {

            request._response = response;                            // Error occurs late and should update request.response object
            request.log(['hapi', 'response', response.variety]);
            return callback();
        });
    };

    prepare(item);
};


internals.transmit = function (response, request, callback) {

    var source = response._payload;

    // Content encoding

    var encoder = null;
    if (!response._headers['content-encoding']) {
        var negotiator = new Negotiator(request.raw.req);
        var encoding = negotiator.preferredEncoding(['gzip', 'deflate', 'identity']);
        if (encoding === 'deflate' || encoding === 'gzip') {
            var keys = Object.keys(response._headers);
            for (var i = 0, il = keys.length; i < il; ++i) {
                var key = keys[i];
                if (/content\-length/i.test(key)) {                 // Can be lowercase when coming from proxy
                    delete response._headers[key];
                }
            }

            response.header('content-encoding', encoding);
            response.header('vary', 'accept-encoding', true);

            if (response._hapi &&
                response._hapi.gzipped &&
                encoding === 'gzip') {

                source = response._hapi.gzipped;
            }
            else {
                encoder = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
            }
        }
    }

    // Headers

    var headers = Object.keys(response._headers);
    for (var h = 0, hl = headers.length; h < hl; ++h) {
        var header = headers[h];
        request.raw.res.setHeader(header, response._headers[header]);
    }

    request.raw.res.writeHead(response._code);

    // Payload

    if (request.method === 'head') {
        response._preview.once('finish', function () {

            request.raw.res.end();
            callback();
        });

        response._preview.end();
        return;
    }

    var previewFinished = false;
    var hasEnded = false;
    var end = function (err, aborted) {

        if (!hasEnded) {
            hasEnded = true;

            if (!aborted) {
                request.raw.res.end();
            }

            var finalize = function () {

                request.raw.req.removeListener('close', end);
                request.raw.req.removeListener('aborted', end);
                response._preview.removeAllListeners();
                source.removeAllListeners();

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

    request.raw.req.once('close', end);
    request.raw.req.once('aborted', function () {

        end(null, true);
    });

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
