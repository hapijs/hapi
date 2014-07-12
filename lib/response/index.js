// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Boom = require('boom');
var Shot = require('shot');
var Plain = require('./plain');
var Payload = require('./payload');
var Headers = require('./headers');
var Hoek = require('hoek');


// Declare internals

var internals = {};


exports.Plain = Plain;
exports.Payload = Payload;


exports.wrap = function (result, request) {

    var response = (result instanceof Error ? Boom.wrap(result)
                                            : (result instanceof Plain ? result : new Plain(result, request)));
    return response;
};


exports.send = function (request, callback) {

    var response = request.response;
    if (response.isBoom) {
        return internals.fail(request, response, callback);
    }

    if (request.method === 'get' ||
        request.method === 'head') {

        // Not all headers are setup at this point - 'etag' and 'last-modified' must be set before _marshall()

        if (response.headers.etag &&
            request.headers['if-none-match'] === response.headers.etag) {

            response.code(304);
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

                    response.code(304);
                }
            }
        }
    }

    internals.marshall(request, function (err) {

        if (err) {
            request._setResponse(err);
            return internals.fail(request, err, callback);
        }

        return internals.transmit(response, request, callback);
    });
};


internals.marshall = function (request, next) {

    var response = request.response;
    if (!response._isPayloadSupported()) {

        // Close unused file streams

        response._close();

        // Set empty stream

        response._payload = new internals.Empty();
        delete response.headers['content-length'];

        if (response.statusCode === 304) {                  // Causes errors on some browsers
            delete response.headers.etag;
            delete response.headers['last-modified'];
        }

        return internals.headers(request, next);
    }

    response._marshall(request, function (err) {

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

    Headers.set(request, function (err) {

        if (err) {
            return next(err);
        }

        // Apply pass through headers

        if (response._payload.headers &&
            response.settings.passThrough) {

            var localHeaders = response.headers;

            response.headers = {};
            var headerKeys = Object.keys(response._payload.headers);
            for (var i = 0, il = headerKeys.length; i < il; ++i) {
                var key = headerKeys[i];
                response.header(key.toLowerCase(), Hoek.clone(response._payload.headers[key]));     // Clone arrays
            }

            headerKeys = Object.keys(localHeaders);
            for (i = 0, il = headerKeys.length; i < il; ++i) {
                var key = headerKeys[i];
                response.header(key, localHeaders[key], { append: key === 'set-cookie' });
            }
        }

        return next();
    });
};


internals.fail = function (request, boom, callback) {

    var error = boom.output;
    var response = new Plain(error.payload, request);
    response.code(error.statusCode);
    Hoek.merge(response.headers, error.headers);
    request.response = response;                            // Not using request._setResponse() to avoid double log

    internals.marshall(request, function (/* err */) {

        // Return the original error (which is partially prepared) instead of having to prepare the result error
        return internals.transmit(response, request, callback);
    });
};


internals.transmit = function (response, request, callback) {

    // Setup source

    var source = response._payload;
    var encoding = (!response.headers['content-encoding'] && response._isPayloadSupported() ? request.info.acceptEncoding : null);

    // Content-Encoding

    var compressor = null;
    if (encoding) {
        delete response.headers['content-length'];
        response._header('content-encoding', encoding);
        response.vary('accept-encoding');
        compressor = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
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
    var encoded = (compressor ? preview.pipe(compressor) : preview);
    encoded.pipe(request.raw.res);

    // Injection

    if (response.variety === 'plain' &&
        Shot.isInjection(request.raw.req)) {

        request.raw.res._hapi = { result: response._isPayloadSupported() ? response.source : null };
    }
};


internals.Empty = function () {

    Stream.Readable.call(this);
};

Hoek.inherits(internals.Empty, Stream.Readable);


internals.Empty.prototype._read = function (/* size */) {

    this.push(null);
};
