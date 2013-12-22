// Load modules

var Stream = require('stream');
var Zlib = require('zlib');
var Querystring = require('querystring');
var Multiparty = require('multiparty');
var Boom = require('boom');
var Utils = require('./utils');


// Declare internals

var internals = {};

internals.validDeflate = new Buffer(['0x78', '0x9c']);
internals.validGzip = new Buffer(['0x1f', '0x8b']);


// Read and parse body

exports.read = function (request, next) {

    // Levels are: 'stream', 'raw', 'parse', 'try'

    var level = request.route.payload.mode;         // Will be null when not explicitly set and route method is '*'
    if (!level) {
        if (request.method === 'get' || request.method === 'head') {
            return next();
        }

        level = request.route.payload.mode || (request.route.validate.payload || ['post', 'put', 'patch'].indexOf(request.method) !== -1 ? 'parse' : 'stream');
        if (level === 'stream') {
            return next();
        }
    }

    // Check content size

    var req = request.raw.req;
    var contentLength = req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > request.route.payload.maxBytes) {

        return next(Boom.badRequest('Payload content length greater than maximum allowed: ' + request.route.payload.maxBytes));
    }

    // Check content type

    var contentType = request.route.payload.override || (req.headers && req.headers['content-type']) || 'application/json';     //  Defaults to 'application/json'
    var mime = contentType.split(';')[0].trim().toLowerCase();
    request.mime = mime;

    if (request.route.payload.allow &&
        ((Array.isArray(request.route.payload.allow) && request.route.payload.allow.indexOf(mime) === -1) ||
        request.route.payload.allow !== mime)) {

        return next(new Boom.unsupportedMediaType());
    }

    // Set client timeout

    var clientTimeout = request.server.settings.timeout.client;
    var clientTimeoutId = null;

    if (clientTimeout) {
        clientTimeout -= request._bench.elapsed();
        clientTimeoutId = setTimeout(function () {

            finish(Boom.clientTimeout('Client is taking too long to send request'));
        }, clientTimeout < 0 ? 0 : clientTimeout);
    }

    // Return only once from events

    var finish = function (err) {

        clearTimeout(clientTimeoutId);
        req.removeListener('close', onClose);
        req.removeListener('error', onError);
        req.removeListener('readable', onReadable);
        req.removeListener('end', onEnd);

        return next(err);
    };

    // Read incoming body

    var onClose = function () {

        return finish(Boom.internal('Request closed before finished reading'));
    };

    req.once('close', onClose);

    var onError = function (err) {

        return finish(Boom.internal('Request error before finished reading: ' + err));
    };

    req.once('error', onError);

    var buffers = [];
    var buffersLength = 0;

    var onReadable = function () {

        var chunk = req.read();
        if (!chunk) {
            return;
        }

        if (buffersLength + chunk.length > request.route.payload.maxBytes) {
            return finish(Boom.badRequest('Payload size greater than maximum allowed: ' + request.route.payload.maxBytes));
        }

        buffers.push(chunk);
        buffersLength += chunk.length;
    };

    req.on('readable', onReadable);

    var onEnd = function () {

        var review = function () {

            var payload = Buffer.concat(buffers, buffersLength);

            if (payload.length &&
                (req.headers['content-encoding'] === 'gzip' || req.headers['content-encoding'] === 'deflate')) {

                if (!internals.isDeflate(payload) && !internals.isGzip(payload)) {
                    return finish(Boom.badRequest('Invalid compressed payload'));
                }

                Zlib.unzip(payload, function (err, unzipped) {                           // Err shouldn't exist since the buffer is validated above

                    return parse(unzipped);
                });

                return;
            }

            parse(payload);
        };

        var parse = function (payload) {

            request.rawPayload = payload;

            if (level === 'raw') {
                return finish();
            }

            request.payload = {};

            if (!payload.length) {
                return finish();
            }

            // Parse payload

            internals.parse(payload, mime, req.headers, request.route.payload, function (err, result) {

                if (err) {
                    return finish(level !== 'try' ? err : null);
                }

                request.payload = result;
                return finish();
            });
        };

        review();
    };

    req.once('end', onEnd);
};


internals.isDeflate = function (compareBuf) {

    return compareBuf[0] === internals.validDeflate[0] && compareBuf[1] === internals.validDeflate[1];
};


internals.isGzip = function (compareBuf) {

    return compareBuf[0] === internals.validGzip[0] && compareBuf[1] === internals.validGzip[1];
};


internals.parse = function (payload, mime, headers, options, callback) {

    callback = Utils.nextTick(callback);

    // Binary

    if (mime === 'application/octet-stream') {
        return callback(null, payload);
    }

    // Text

    if (mime.match(/^text\/.+$/)) {
        return callback(null, payload.toString('utf-8'));
    }

    // JSON

    if (mime === 'application/json') {
        return internals.jsonParse(payload, callback);                      // Isolate try...catch for V8 optimization
    }

    // Form-encoded

    if (mime === 'application/x-www-form-urlencoded') {
        return callback(null, Querystring.parse(payload.toString('utf-8')));
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

    return callback(new Boom.unsupportedMediaType());
};


internals.jsonParse = function (payload, next) {

    var obj = null;
    var error = null;

    try {
        obj = JSON.parse(payload.toString('utf-8'));
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
