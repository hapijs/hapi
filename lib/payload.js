// Load modules

var Qs = require('querystring');
var Err = require('./error');
var Zlib = require("zlib");


// Declare internals

var internals = {};


internals.unwrap = function (payload, encoding, req, callback) {

    req.rawBody = payload;
    return callback(null, payload);
};


internals.unwrapGzip = function (payload, encoding, req, callback) {

    Zlib.unzip(new Buffer(payload, encoding), function (err, buffer) {

        if (err) {
            return callback(err);
        }

        var newPayload = buffer.toString();
        req.rawBody = newPayload;
        return callback(null, newPayload);
    });
};


// Read and parse body

exports.read = function (request, next) {

    if (request.method === 'get' ||
        request.method === 'head') {

        return next();
    }

    // Levels are: 'stream', 'raw', 'parse'

    var level = request._route.config.payload;
    if (level === 'stream') {
        return next();
    }

    // Check content type (defaults to 'application/json')

    var req = request.raw.req;
    var contentType = req.headers['content-type'];
    var mime = (contentType ? contentType.split(';')[0] : 'application/json');
    var gzip = (req.headers['content-encoding'] == "gzip" ? true : false);
    var parserFunc = null;

    if (mime === 'application/json') {
        parserFunc = JSON.parse;
    }
    else if (mime === 'application/x-www-form-urlencoded') {
        parserFunc = Qs.parse;
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

    // Read incoming payload

    var payload = '';
    var isBailed = false;
    var encoding = "utf8";

    if (gzip) {
        encoding = "base64";
    }

    req.setEncoding(encoding);
    req.on('data', function (chunk) {

        if (payload.length + chunk.length <= request.server.settings.payload.maxBytes) {
            payload += chunk.toString(encoding);
        }
        else {
            isBailed = true;
            return next(Err.badRequest('Payload size greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
        }
    });

    req.on('end', function () {

        if (isBailed) {
            return;                 // next() already called
        }

        var unwrapper = internals.unwrap;

        if (gzip) {
            unwrapper = internals.unwrapGzip;
        }

        if (level !== 'parse') {    // 'raw'
            return next();
        }

        request.payload = {};

        unwrapper(payload, encoding, request, function (err, result) {

            if (err) {
                return next(Err.badRequest("Invalid gzip: " + err));
            }

            if (result) {
                try {
                    request.payload = parserFunc(result);
                }
                catch (err) {
                    return next(Err.badRequest('Invalid JSON body'));
                }
            }

            return next();
        })
    });
};

