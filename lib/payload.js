// Load modules

var Zlib = require('zlib');
var Querystring = require('querystring');
var Formidable = require('formidable');
var Boom = require('boom');
var Utils = require('./utils');


// Declare internals

var internals = {};

internals.validDeflate = new Buffer(['0x78', '0x9c']);
internals.validGzip = new Buffer(['0x1f', '0x8b']);


// Read and parse body

exports.read = function (request, next) {

    if (request.method === 'get' ||
        request.method === 'head') {

        return next();
    }

    // Levels are: 'stream', 'raw', 'parse'

    var level = request.route.payload || (request.route.validate.payload || request.method === 'post' || request.method === 'put'|| request.method === 'patch' ? 'parse' : 'stream');
    if (level === 'stream') {
        return next();
    }

    // Check content size

    var req = request.raw.req;
    var contentLength = req.headers['content-length'];
    if (contentLength &&
        parseInt(contentLength, 10) > request.server.settings.payload.maxBytes) {

        return next(Boom.badRequest('Payload content length greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
    }

    var clientTimeout = request.server.settings.timeout.client;
    var clientTimeoutId = null;

    if (clientTimeout) {
        clientTimeout -= Date.now() - request._timestamp;
        clientTimeoutId = setTimeout(function () {

            finish(Boom.clientTimeout('Client is taking too long to send request'));
        }, clientTimeout);
    }

    // Return only once from events

    var isBailed = false;
    var finish = function (err) {

        if (!isBailed) {
            clearTimeout(clientTimeoutId);
            isBailed = true;
            return next(err);
        }
    };

    // Read incoming body

    req.on('close', function () {

        return finish(Boom.internal('Request closed before finished reading'));
    });

    req.on('error', function (err) {

        return finish(Boom.internal('Request error before finished reading: ' + err));
    });

    var buffers = [];
    var buffersLength = 0

    req.on('readable', function () {

        var chunk = req.read();
        if (!chunk) {
            return;
        }

        if (buffersLength + chunk.length > request.server.settings.payload.maxBytes) {
            return finish(Boom.badRequest('Payload size greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
        }

        buffers.push(chunk);
        buffersLength += chunk.length;
    });

    req.on('end', function () {

        var review = function () {

            if (isBailed) {
                return;                 // next() already called
            }

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

            if (level !== 'parse') {        // 'raw'
                return finish();
            }

            request.payload = {};

            if (!payload.length) {
                return finish();
            }

            // Set parser

            internals.parse(payload, req.headers, function (err, result) {

                if (err) {
                    return finish(err);
                }

                request.payload = result;
                return finish();
            });
        };

        review();
    });
};


internals.isDeflate = function (compareBuf) {

    return compareBuf[0] === internals.validDeflate[0] && compareBuf[1] === internals.validDeflate[1];
};


internals.isGzip = function (compareBuf) {

    return compareBuf[0] === internals.validGzip[0] && compareBuf[1] === internals.validGzip[1];
};


internals.parse = function (payload, headers, callback) {

    callback = Utils.nextTick(callback);

    // Check content type

    var contentType = (headers && headers['content-type']) || 'application/json';           //  Defaults to 'application/json'
    var mime = contentType.split(';')[0].trim().toLowerCase();

    // Text

    if (mime.match(/^text\/.+$/)) {
        return callback(null, payload.toString('utf-8'));
    }

    // JSON

    if (mime === 'application/json') {
        var obj = null;
        var error = null;

        try {
            obj = JSON.parse(payload.toString('utf-8'));
        }
        catch (exp) {
            error = Boom.badRequest('Invalid request payload format');
        }

        return callback(error, obj);
    }

    // Form-encoded

    if (mime === 'application/x-www-form-urlencoded') {
        return callback(null, Querystring.parse(payload.toString('utf-8')));
    }

    // Multipart

    if (mime === 'multipart/form-data') {

        var data = {};
        var form = new Formidable.IncomingForm();

        var processData = function (name, val) {

            if (data[name]) {
                data[name] = [data[name], val];
            }
            else {
                data[name] = val;
            }
        };

        form.on('field', processData);
        form.on('file', processData);

        form.once('error', function () {

            form.removeAllListeners('end');
            return callback(Boom.badRequest('Invalid request multipart payload format'));
        });

        form.once('end', function () {

            form.removeAllListeners('error');
            return callback(null, data);
        });

        form.writeHeaders(headers);
        form.write(payload);
        return;
    }

    return callback(Boom.badRequest('Unsupported content-type'));
};
