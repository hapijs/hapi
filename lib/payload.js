// Load modules

var Zlib = require('zlib');
var Querystring = require('querystring');
var Formidable = require('formidable');
var Boom = require('boom');


// Declare internals

var internals = {};


// Read and parse body

exports.read = function (request, next) {

    var req = request.raw.req;

    if (request.method === 'get' ||
        request.method === 'head') {

        return next();
    }

    // Levels are: 'stream', 'raw', 'parse'

    var level = request.route.payload;
    if (level === 'stream') {
        return next();
    }

    // Set parser

    var parserFunc = internals.setParser(req.headers);
    if (parserFunc instanceof Error) {
        return next(parserFunc);
    }

    // Check content size

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

    var isGZip = (req.headers['content-encoding'] === 'gzip');
    var encoding = isGZip ? 'base64' : 'utf8';
    req.setEncoding(encoding);

    req.on('close', function () {

        return finish(Boom.internal('Request closed before finished reading'));
    });

    req.on('error', function (err) {

        return finish(Boom.internal('Request error before finished reading: ' + err));
    });

    var payload = '';
    req.on('data', function (chunk) {

        if (payload.length + chunk.length > request.server.settings.payload.maxBytes) {
            return finish(Boom.badRequest('Payload size greater than maximum allowed: ' + request.server.settings.payload.maxBytes));
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
                    return finish(Boom.badRequest('Invalid gzip: ' + err));
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
                    return finish(Boom.badRequest('Invalid request payload format'));
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


internals.setParser = function (headers) {

    // Check content type

    var contentType = (headers && headers['content-type']) || 'application/json';           //  Defaults to 'application/json'
    var mime = contentType.split(';')[0];

    // JSON

    if (mime === 'application/json') {
        var jsonParser = function (result, callback) {

            var obj = null;
            try {
                obj = JSON.parse(result);
            }
            catch (exp) {
                return callback(Boom.badRequest('Invalid request payload format'));
            }

            return callback(null, obj);
        };

        return jsonParser;
    }

    // Form-encoded

    if (mime === 'application/x-www-form-urlencoded') {
        var qsParser = function (result, callback) {

            return callback(null, Querystring.parse(result));
        };

        return qsParser;
    }

    // Multipart

    if (mime === 'multipart/form-data') {

        var multipartParser = function (result, callback) {

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
            form.write(new Buffer(result));
        };

        return multipartParser;
    }

    // Other

    return Boom.badRequest('Unsupported content-type: ' + mime);
};