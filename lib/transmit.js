// Load modules

var Http = require('http');
var Stream = require('stream');
var Zlib = require('zlib');
var Boom = require('boom');
var Hoek = require('hoek');
var Items = require('items');
var Mimos = require('mimos');
var Shot = require('shot');
var Statehood = require('statehood');
var Auth = require('./auth');
var Range = require('./range');
var Response = require('./response');


// Declare internals

var internals = {};


exports.send = function (request, callback) {

    var response = request.response;
    if (response.isBoom) {
        return internals.fail(request, response, callback);
    }

    if (request.method === 'get' ||
        request.method === 'head') {

        // Not all headers are setup at this point - 'etag' and 'last-modified' must be set before _marshal()

        if (response.headers.etag &&
            request.headers['if-none-match'] === response.headers.etag) {

            // Strong verifier

            response.code(304);
        }
        else {
            var ifModifiedSinceHeader = request.headers['if-modified-since'];
            var lastModifiedHeader = response.headers['last-modified'];

            if (ifModifiedSinceHeader &&
                lastModifiedHeader) {

                // Weak verifier

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

    internals.marshal(request, function (err) {

        if (err) {
            request._setResponse(err);
            return internals.fail(request, err, callback);
        }

        return internals.transmit(response, callback);
    });
};


internals.marshal = function (request, next) {

    var response = request.response;
    if (!response._isPayloadSupported()) {

        // Close unused file streams

        response._close();

        // Set empty stream

        response._payload = new internals.Empty();
        delete response.headers['content-length'];
        return internals.headers(request, next);
    }

    response._marshal(function (err) {

        if (err) {
            return next(Boom.wrap(err));
        }

        return internals.headers(request, next);
    });
};


internals.headers = function (request, next) {

    var response = request.response;

    if (request.jsonp &&
        response._payload.jsonp) {

        response.type('text/javascript');
        response.header('X-Content-Type-Options', 'nosniff');
        response._payload.jsonp(request.jsonp);
    }

    if (response._payload.size &&
        typeof response._payload.size === 'function') {

        response._header('content-length', response._payload.size(), { override: false });
    }

    internals.cors(response);
    internals.security(response);
    internals.content(response);
    internals.state(response, function (err) {

        if (err) {
            request._log(['state', 'header', 'response', 'error'], err);
            request._states = {};                                           // Clear broken state
            return next(err);
        }

        internals.cache(response);
        Auth.response(request, function (err) {                             // Must be last in case requires access to headers

            if (err) {
                return next(err);
            }

            // Apply pass-through headers

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
                    key = headerKeys[i];
                    response.header(key, localHeaders[key], { append: key === 'set-cookie' });
                }
            }

            return next();
        });
    });
};


internals.fail = function (request, boom, callback) {

    var error = boom.output;
    var response = new Response(error.payload, request);
    response.code(error.statusCode);
    response.headers = error.headers;
    request.response = response;                            // Not using request._setResponse() to avoid double log

    internals.marshal(request, function (err) {

        if (err) {

            // Failed to marshal an error - replace with minimal representation of original error

            var minimal = {
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

    var request = response.request;
    var source = response._payload;
    var mime = Mimos.type(response.headers['content-type'] || 'hapi/unknown');
    var encoding = (mime.compressible && !response.headers['content-encoding'] && response._isPayloadSupported() ? request.info.acceptEncoding : null);
    encoding = (encoding === 'identity' ? null : encoding);

    // Range

    var ranger = null;
    if (request.method === 'get' &&
        response.statusCode === 200 &&
        response.headers['content-length'] &&
        !encoding) {

        if (request.headers.range) {

            // Check If-Range

            if (!request.headers['if-range'] ||
                request.headers['if-range'] === response.headers.etag) {            // Ignoring last-modified date (weak)

                // Parse header

                var length = parseInt(response.headers['content-length'], 10);      // In case value is a string
                var ranges = Range.header(request.headers.range, length);
                if (!ranges) {
                    var error = Boom.rangeNotSatisfiable();
                    error.output.headers['content-range'] = 'bytes */' + length;
                    return internals.fail(request, error, callback);
                }

                // Prepare transform

                if (ranges.length === 1) {                                          // Ignore requests for multiple ranges
                    var range = ranges[0];
                    ranger = new Range.Stream(range);
                    response.code(206);
                    response.bytes(range.to - range.from + 1);
                    response._header('content-range', 'bytes ' + range.from + '-' + range.to + '/' + length);
                }
            }
        }

        response._header('accept-ranges', 'bytes');
    }

    // Content-Encoding

    var compressor = null;
    if (encoding) {
        delete response.headers['content-length'];
        response._header('content-encoding', encoding);
        response.vary('accept-encoding');
        compressor = (encoding === 'gzip' ? Zlib.createGzip() : Zlib.createDeflate());
    }

    response._varyEtag();

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

            var tags = (err ? ['response', 'error']
                            : (event ? ['response', 'error', event]
                                     : ['response']));

            if (event || err) {
                request.emit('disconnect');
            }

            request._log(tags, err);
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
    var compressed = (compressor ? preview.pipe(compressor) : preview);
    var ranged = (ranger ? compressed.pipe(ranger) : compressed);
    ranged.pipe(request.raw.res);

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


internals.cors = function (response) {

    var request = response.request;
    var cors = request.connection.settings.cors;
    if (cors &&
        request.route.cors !== false) {     // Defaults to true (when null)

        if (cors._origin &&
            !response.headers['access-control-allow-origin']) {

            if (cors._origin.any) {
                response._header('access-control-allow-origin', '*');
            }
            else if (cors.matchOrigin) {
                response.vary('origin');
                if (internals.matchOrigin(request.headers.origin, cors)) {
                    response._header('access-control-allow-origin', request.headers.origin);
                }
                else if (cors.isOriginExposed) {
                    response._header('access-control-allow-origin', cors._origin.qualifiedString);
                }
            }
            else {
                response._header('access-control-allow-origin', cors._origin.qualifiedString);
            }
        }

        response._header('access-control-max-age', cors.maxAge, { override: false });
        response._header('access-control-allow-methods', cors._methods, { override: false });
        response._header('access-control-allow-headers', cors._headers, { override: false });

        if (cors._exposedHeaders.length !== 0) {
            response._header('access-control-expose-headers', cors._exposedHeaders, { override: false });
        }

        if (cors.credentials) {
            response._header('access-control-allow-credentials', 'true', { override: false });
        }
    }
};


internals.matchOrigin = function (origin, cors) {

    if (!origin) {
        return false;
    }

    if (cors._origin.qualified.indexOf(origin) !== -1) {
        return true;
    }

    for (var i = 0, il = cors._origin.wildcards.length; i < il; ++i) {
        if (origin.match(cors._origin.wildcards[i])) {
            return true;
        }
    }

    return false;
};


internals.cache = function (response) {

    if (response.headers['cache-control']) {
        return;
    }

    var request = response.request;
    if (request.connection.settings._cacheControlStatus[response.statusCode] ||
        response.settings.ttl) {

        var ttl = (response.settings.ttl !== null ? response.settings.ttl
                                                  : (request.route.cache ? request._route._cache.ttl() : 0));
        if (ttl) {
            var privacy = (request.auth.isAuthenticated || response.headers['set-cookie'] ? 'private' : (request.route.cache && request.route.cache.privacy) || 'default');
            response._header('cache-control', 'max-age=' + Math.floor(ttl / 1000) + ', must-revalidate' + (privacy !== 'default' ? ', ' + privacy : ''));
        }
        else if (!response.settings.passThrough ||
            !response._payload.headers ||
            !response._payload.headers['cache-control']) {

            response._header('cache-control', 'no-cache');
        }
    }
    else {
        response._header('cache-control', 'no-cache');
    }
};


internals.security = function (response) {

    var request = response.request;

    var security = request.route.security === undefined ? request.connection.settings.security : request.route.security;

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


internals.content = function (response) {

    var type = response.headers['content-type'];
    if (!type) {
        var charset = (response.settings.charset ? '; charset=' + response.settings.charset : '');

        if (typeof response.source === 'string') {
            response.type('text/html' + charset);
        }
        else if (Buffer.isBuffer(response.source)) {
            response.type('application/octet-stream');
        }
        else if (response.variety === 'plain') {
            response.type('application/json' + charset);
        }
    }
    else if (response.settings.charset &&
        type.match(/^(?:text\/)|(?:application\/(?:json)|(?:javascript))/)) {

        var hasParams = (type.indexOf(';') !== -1);
        if (!hasParams ||
            !type.match(/[; ]charset=/)) {

            response.type(type + (hasParams ? ', ' : '; ') + 'charset=' + (response.settings.charset));
        }
    }
};


internals.state = function (response, next) {

    var request = response.request;

    var names = {};
    var states = [];

    var keys = Object.keys(request._states);
    for (var i = 0, il = keys.length; i < il; ++i) {
        var name = keys[i];
        names[name] = true;
        states.push(request._states[name]);
    }

    keys = Object.keys(request.connection._stateDefinitions.cookies);
    Items.parallel(keys, function (name, nextKey) {

        var autoValue = request.connection._stateDefinitions.cookies[name].autoValue;
        if (!autoValue || names[name]) {
            return nextKey();
        }

        names[name] = true;

        if (typeof autoValue !== 'function') {
            states.push({ name: name, value: autoValue });
            return nextKey();
        }

        autoValue(request, function (err, value) {

            if (err) {
                return nextKey(err);
            }

            states.push({ name: name, value: value });
            return nextKey();
        });
    },
    function (err) {

        if (err) {
            return next(Boom.wrap(err));
        }

        if (!states.length) {
            return next();
        }

        Statehood.format(states, request.connection._stateDefinitions, function (err, header) {

            if (err) {
                return next(Boom.wrap(err));
            }

            var existing = response.headers['set-cookie'];
            if (existing) {
                header = (Array.isArray(existing) ? existing : [existing]).concat(header);
            }

            response._header('set-cookie', header);
            return next();
        });
    });
};
