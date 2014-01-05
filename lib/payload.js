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

    var output = request.route.payload.output;      // Output: 'data', 'stream', 'file'
    var parse = request.route.payload.parse;        // Parse: true, false

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

    // Input source

    var source = req;
    next = Utils.once(next);

    // Output: 'stream'

    if (output === 'stream') {
        request.payload = source;
        return next();
    }

    // Content encoding

    var contentEncoding = req.headers['content-encoding'];
    if (contentEncoding === 'gzip' || contentEncoding === 'deflate') {
        var decoder = (contentEncoding === 'gzip' ? Zlib.createGunzip() : Zlib.createInflate());
        decoder.once('error', function (err) {

            return next(Boom.badRequest('Invalid compressed payload'));
        });

        source = source.pipe(decoder);
    }

    // Read full payload

    var parseOptions = {
        timeout: request.server.settings.timeout.client,
        maxBytes: request.route.payload.maxBytes
    };

    Nipple.parse(source, parseOptions, function (err, payload) {

        if (err) {
            return next(err);
        }

        request.rawPayload = payload;

        if (!parse) {
            return next();
        }

        request.payload = {};

        if (!payload.length) {
            return next();
        }

        // Parse payload

        internals.parse(payload, mime, req.headers, request.route.payload, function (err, result) {

            if (err) {
                return next(err);
            }

            request.payload = result;
            return next();
        });
    });
};


internals.parse = function (payload, mime, headers, options, callback) {

    callback = Utils.nextTick(callback);

    // Binary

    if (mime === 'application/octet-stream') {
        return callback(null, payload);
    }

    // Text

    if (mime.match(/^text\/.+$/)) {
        return callback(null, payload.toString('utf8'));
    }

    // JSON

    if (mime === 'application/json') {
        return internals.jsonParse(payload, callback);                      // Isolate try...catch for V8 optimization
    }

    // Form-encoded

    if (mime === 'application/x-www-form-urlencoded') {
        return callback(null, Querystring.parse(payload.toString('utf8')));
    }

    // Multipart

    if (mime === 'multipart/form-data' &&
        options.multipart) {

        var stream = new internals.Replay(headers, payload);

        var form = new Multiparty.Form({
            encoding: options.multipart.encoding,
            maxFieldsSize: options.multipart.maxFieldBytes,
            maxFields: options.multipart.maxFields,
            uploadDir: options.multipart.uploadDir,
            hash: options.multipart.hash
        });

        var data = {};

        form.once('error', function (err) {

            return callback(Boom.badRequest('Invalid request multipart payload format'));
        });

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

        if (options.multipart.mode === 'stream') {
            form.on('part', function (part) {

                if (!part.filename) {
                    return;
                }

                part.type = part.headers && part.headers['content-type'];
                set(part.name, part);
            });
        }
        else {
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

            stream.removeAllListeners();
            form.removeAllListeners();
            return callback(null, data);
        });

        form.parse(stream);

        return;
    }

    return callback(Boom.unsupportedMediaType());
};


internals.jsonParse = function (payload, next) {

    var obj = null;
    var error = null;

    try {
        obj = JSON.parse(payload.toString('utf8'));
    }
    catch (exp) {
        error = Boom.badRequest('Invalid request payload JSON format');
    }

    return next(error, obj);
};


internals.Replay = function (headers, payload) {

    Stream.Readable.call(this);
    this.headers = headers;
    this._data = payload;
};

Utils.inherits(internals.Replay, Stream.Readable);


internals.Replay.prototype._read = function (size) {

    this.push(this._data);
    this.push(null);
};
