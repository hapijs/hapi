// Load modules

var Zlib = require('zlib');
var Qs = require('querystring');
var MultiPart = require('multipart-parser');
var Err = require('./error');


// Declare internals

var internals = {};


// Read and parse body

exports.read = function (request, next) {

    var req = request.raw.req;

    if (request.method === 'get' ||
        request.method === 'head') {

        req.resume();
        return next();
    }

    // Levels are: 'stream', 'raw', 'parse'

    var level = request._route.config.payload;
    if (level === 'stream') {
        return next();
    }

    // Set parser

    var parserFunc = internals.setParser(req.headers['content-type']);
    if (parserFunc instanceof Error) {
        return next(parserFunc);
    }

    // Check content size

    var contentLength = req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > request.server.settings.payload.maxBytes) {

        return next(Err.badRequest('Payload content length greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
    }

    // Return only once from events

    var isBailed = false;
    var finish = function (err) {

        if (!isBailed) {
            isBailed = true;
            return next(err);
        }
    };

    // Read incoming body

    var isGZip = (req.headers['content-encoding'] === 'gzip');
    var encoding = isGZip ? 'base64' : 'utf8';
    req.setEncoding(encoding);

    req.on('close', function () {

        return finish(Err.internal('Request closed before finished reading'));
    });

    req.on('error', function (err) {

        return finish(Err.internal('Request error before finished reading: ' + err));
    });

    var payload = '';
    req.on('data', function (chunk) {

        if (payload.length + chunk.length > request.server.settings.payload.maxBytes) {
            return finish(Err.badRequest('Payload size greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
        }

        payload += chunk.toString(encoding);
    });

    req.on('end', function () {

        if (isBailed) {
            return;                 // next() already called
        }

        var unzip = function () {

            Zlib.unzip(new Buffer(payload, encoding), function (err, buffer) {

                if (err) {
                    return finish(Err.badRequest('Invalid gzip: ' + err));
                }

                var unzipped = buffer.toString();
                request.rawBody = unzipped;
                return parse(unzipped);
            });
        };

        var parse = function (result) {

            if (level !== 'parse') {    // 'raw'
                return finish();
            }

            request.payload = {};

            if (!result) {
                return finish();
            }

            parserFunc(result, function (err, payload) {

                if (err) {
                    return finish(Err.badRequest('Invalid request payload format'));
                }

                request.payload = payload;
                return finish();
            });
        };

        if (isGZip) {
            return unzip();
        }

        request.rawBody = payload;
        parse(payload);
    });

    req.resume();
};


internals.setParser = function (header) {

    // Check content type

    var contentType = header || 'application/json';            //  Defaults to 'application/json'
    var contentTypeParts = contentType.split(';');
    var mime = contentTypeParts[0];

    // JSON

    if (mime === 'application/json') {
        var jsonParser = function (result, callback) {

            var obj = null;
            try {
                obj = JSON.parse(result);
            }
            catch (exp) {
                return callback(Err.badRequest('Invalid request payload format'));
            }

            return callback(null, obj);
        };

        return jsonParser;
    }

    // Form-encoded

    if (mime === 'application/x-www-form-urlencoded') {
        var qsParser = function (result, callback) {

            return callback(null, Qs.parse(result));
        };

        return qsParser;
    }

    // Multipart

    if (mime === 'multipart/form-data') {
        var attributes = contentTypeParts[1];
        if (!attributes) {
            return Err.badRequest('Missing multipart boundary in content-type header');
        }

        var boundary = attributes.substring(attributes.indexOf('=') + 1);
        if (!boundary) {
            return Err.badRequest('Missing multipart boundary in content-type header');
        }

        var multipartParser = function (result, callback) {

            var parser = MultiPart.create(boundary);
            var parsedParts = null;
            var isBailed = false;

            parser.on('error', function (err) {

                if (!isBailed) {
                    isBailed = true;
                    return callback(Err.badRequest('Invalid request payload format'));
                }
            });

            parser.on('part', function (part) {

                parsedParts = parsedParts || [];
                parsedParts.push(part);
            });

            parser.on('end', function () {

                if (!isBailed) {
                    isBailed = true;
                    return callback(null, parsedParts);
                }
            });

            parser.write(new Buffer(result));
            parser.end();
        };

        return multipartParser;
    }

    // Other

    return Err.badRequest('Unsupported content-type: ' + mime);
};

