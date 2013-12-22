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
                 /-- Stream
                |
    (Generic) --|--- Buffer
                |
                |--- Text
                |
                |--- Empty
                |
                |--- View
                |
                 \-- Obj
    (Closed)
*/

exports.Generic = internals.Generic = require('./generic');
exports.Empty = internals.Empty = require('./empty');
exports.Obj = internals.Obj = require('./obj');
exports.Text = internals.Text = require('./text');
exports.Stream = internals.Stream = require('./stream');
exports.View = internals.View = require('./view');
exports.Buffer = internals.Buffer = require('./buffer');


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
        else if (result instanceof internals.Generic ||
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

    if (!response.isBoom) {
        response._rawResult = result;
    }

    if (request &&
        request.method !== 'post' &&
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


internals.prepare = function (item, request, callback) {

    var prepareCount = 0;

    var prepare = function (response) {

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

        // Boom

        var error = response;
        response = new internals.Obj(error.response.payload);
        response._err = error;
        response.code(error.response.code);

        Utils.merge(response._headers, error.response.headers);
        if (error.response.type) {
            response._header('content-type', error.response.type);
        }

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
        internals.prepare(empty, request, send);
    };

    var send = function (response) {

        // Injection

        if ((response.variety === 'obj' || response._err) &&
            Shot.isInjection(request.raw.req)) {

            request.raw.res._hapi = { result: response.source };
        }

        internals.transmit(response, request, function () {

            request._response = response;                            // Error occurs late and should update request.response object
            request.log(['hapi', 'response', response.variety]);
            return callback();
        });
    };

    internals.prepare(item, request, prepare);
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
