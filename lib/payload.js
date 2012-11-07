// Load modules

var Zlib = require('zlib');
var Qs = require('querystring');
var MultiPart = require('multipart-parser');
var Err = require('./error');


// Declare internals

var internals = {};


internals.multipartParser = function(contentType) {

    var boundary = contentType ? contentType.split(';')[1] : '';
    boundary = boundary.substring(boundary.indexOf('=') + 1);

    return function(result) {

        var parsedParts = [];

        MultiPart.create(boundary)
            .on('part', function(part) {

                parsedParts.push(part);
            })
            .on('error', function(err) {

                parsedParts.push(err);
             })
            .write(new Buffer(result));

        return parsedParts;
    };
};


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

    // Check content type (defaults to 'application/json')

    var contentType = req.headers['content-type'];
    var mime = (contentType ? contentType.split(';')[0] : 'application/json');
    var parserFunc = null;

    if (mime === 'application/json') {
        parserFunc = JSON.parse;
    }
    else if (mime === 'application/x-www-form-urlencoded') {
        parserFunc = Qs.parse;
    }
    else if (mime === 'multipart/form-data') {
        parserFunc = internals.multipartParser(contentType);
    }
    else {
        return next(Err.badRequest('Unsupported content-type: ' + mime));
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

        if (isBailed) {
            return;         // next() already called
        }

        isBailed = true;
        return next(err);
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
            isBailed = true;
            return finish(Err.badRequest('Payload size greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
        }

        payload += chunk.toString(encoding);
    });

    req.on('end', function () {

        if (isBailed) {
            return;                 // next() already called
        }

        if (level !== 'parse') {    // 'raw'
            return finish();
        }

        request.payload = {};

        internals.unwrap(isGZip, payload, encoding, request, function (err, result) {

            if (err) {
                return finish(err);
            }

            if (result) {
                try {
                    request.payload = parserFunc(result);
                }
                catch (e) {
                    return finish(Err.badRequest('Invalid JSON body'));
                }
            }

            return finish();
        })
    });

    req.resume();
};


internals.unwrap = function (isGZip, payload, encoding, req, callback) {

    if (!isGZip) {
        req.rawBody = payload;
        return callback(null, payload);
    }

    Zlib.unzip(new Buffer(payload, encoding), function (err, buffer) {

        if (err) {
            return callback(Err.badRequest('Invalid gzip: ' + err));
        }

        var newPayload = buffer.toString();
        req.rawBody = newPayload;
        return callback(null, newPayload);
    });
};

