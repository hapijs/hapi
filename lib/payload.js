// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Querystring = require('querystring');
var Nipple = require('nipple');
var Multiparty = require('multiparty');
var Boom = require('boom');
var Utils = require('./utils');


// Declare internals

var internals = {};


// Read and parse body

exports.read = function (request, next) {

    if (request.method === 'get' || request.method === 'head') {            // When route.method is '*'
        return next();
    }

    // Content size

    var req = request.raw.req;
    var contentLength = req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > request.route.payload.maxBytes) {

        return next(Boom.badRequest('Payload content length greater than maximum allowed: ' + request.route.payload.maxBytes));
    }

    // Content type

    var contentType = request.route.payload.override || (req.headers && req.headers['content-type']) || 'application/json';     //  Defaults to 'application/json'
    var mime = contentType.split(';')[0].trim().toLowerCase();
    request.mime = mime;

    if (request.route.payload.allow &&
        ((Array.isArray(request.route.payload.allow) && request.route.payload.allow.indexOf(mime) === -1) ||
        request.route.payload.allow !== mime)) {

        return next(Boom.unsupportedMediaType());
    }

    // Parse: true

    if (request.route.payload.parse) {
        return internals.parse(request, next);
    }

    // Parse: false

    return internals.raw(request, next);
};


internals.parse = function (request, next) {

    var output = request.route.payload.output;      // Output: 'data', 'stream', 'file'
    var source = request.raw.req;

    var contentEncoding = source.headers['content-encoding'];
    if (contentEncoding === 'gzip' || contentEncoding === 'deflate') {
        var decoder = (contentEncoding === 'gzip' ? Zlib.createGunzip() : Zlib.createInflate());
        next = Utils.once(next);                                                                     // Modify next() for async events
        decoder.once('error', function (err) {

            return next(Boom.badRequest('Invalid compressed payload'));
        });

        source = source.pipe(decoder);
    }

    if (request.mime === 'multipart/form-data') {
        return internals.multipart(request, source, next);
    }

    // Output: 'stream'

    if (output === 'stream') {
        request.payload = source;
        return next();
    }

    // Output: 'file'

    if (output === 'file') {

    }

    // Output: 'data'

    return internals.buffer(request, source, function (err, payload) {

        if (err) {
            return next(err);
        }

        request.payload = {};

        if (!payload.length) {
            return next();
        }

        internals.object(request, payload, function (err, result) {

            if (err) {
                return next(err);
            }

            request.payload = result;
            return next();
        });
    });
};


internals.raw = function (request, next) {

    var output = request.route.payload.output;      // Output: 'data', 'stream', 'file'

    // Output: 'stream'

    if (output === 'stream') {
        request.payload = request.raw.req;
        return next();
    }

    // Output: 'file'

    if (output === 'file') {

    }

    // Output: 'data'

    return internals.buffer(request, request.raw.req, function (err, payload) {

        if (err) {
            return next(err);
        }

        request.payload = payload;
        return next();
    });
};


internals.buffer = function (request, source, next) {

    var parseOptions = {
        timeout: request.server.settings.timeout.client,
        maxBytes: request.route.payload.maxBytes
    };

    Nipple.read(source, parseOptions, next);
};


internals.object = function (request, payload, next) {

    var mime = request.mime;
    var headers = request.raw.req.headers;
    var options = request.route.payload;

    // Binary

    if (mime === 'application/octet-stream') {
        return next(null, payload);
    }

    // Text

    if (mime.match(/^text\/.+$/)) {
        return next(null, payload.toString('utf8'));
    }

    // JSON

    if (mime === 'application/json') {
        return internals.jsonParse(payload, next);                      // Isolate try...catch for V8 optimization
    }

    // Form-encoded

    if (mime === 'application/x-www-form-urlencoded') {
        return next(null, Querystring.parse(payload.toString('utf8')));
    }

    return next(Boom.unsupportedMediaType());
};


internals.multipart = function (request, source, next) {

    var options = request.route.payload;
    next = Utils.once(next);                                            // Modify next() for async events

    var form = new Multiparty.Form({
        uploadDir: options.uploads
    });

    form.once('error', function (err) {

        return next(Boom.badRequest('Invalid request multipart payload format'));
    });

    var data = {};
    var set = function (name, value) {

        if (!data.hasOwnProperty(name)) {
            data[name] = value;
        }
        else if (Array.isArray(data[name])) {
            data[name].push(value);
        }
        else {
            data[name] = [data[name], value];
        }
    };

    if (options.output === 'stream' ||                                      // Output: 'stream'
        options.output === 'data') {                                        // Output: 'data'

        form.on('part', function (part) {

            if (!part.filename) {
                return;
            }

            part.type = part.headers && part.headers['content-type'];
            set(part.name, part);
        });
    }
    else {                                                                  // Output: 'file'
        form.on('file', function (name, file) {

            var item = {
                type: file.headers && file.headers['content-type'],
                fieldName: file.fieldName,
                originalFilename: file.originalFilename,
                path: file.path,
                headers: file.headers,
                size: file.size
            };

            set(name, item);
        });
    }

    form.on('field', function (name, value) {

        set(name, value);
    });

    form.once('close', function () {

        form.removeAllListeners();
        request.payload = data;
        return next();
    });

    form.parse(source);
};


internals.jsonParse = function (payload, next) {

    try {
        return next(null, JSON.parse(payload.toString('utf8')));
    }
    catch (err) {
        return next(Boom.badRequest('Invalid request payload JSON format'));
    }
};
