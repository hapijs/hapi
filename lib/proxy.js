// Load modules

var Request = require('request');
var Utils = require('./utils');
var Boom = require('boom');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Proxy = function (options, route) {

    Utils.assert(options, 'Missing options');
    Utils.assert(!!options.host ^ !!options.mapUri, 'Must have either options.host or options.mapUri');
    Utils.assert(!options.passThrough || !route.settings.cache.mode.server, 'Cannot use pass-through proxy mode with caching');
    Utils.assert(!options.mapUri || typeof options.mapUri === 'function', 'options.mapUri must be a function');
    Utils.assert(!options.postResponse || typeof options.postResponse === 'function', 'options.postResponse must be a function');
    Utils.assert(!options.hasOwnProperty('isCustomPostResponse'), 'Cannot manually set options.isCustomPostResponse');

    this.settings = {};
    this.settings.mapUri = options.mapUri || internals.mapUri(options.protocol, options.host, options.port);
    this.settings.xforward = options.xforward || false;
    this.settings.passThrough = options.passThrough || false;
    this.settings.isCustomPostResponse = !!options.postResponse;
    this.settings.postResponse = options.postResponse || internals.postResponse;     // function (request, settings, response, payload)

    return this;
};


internals.Proxy.prototype.httpClient = Request;


internals.Proxy.prototype.handler = function () {

    var self = this;

    return function (request) {

        self.settings.mapUri(request, function (err, uri) {

            if (err) {
                return request.reply(err);
            }

            var req = request.raw.req;

            var options = {
                uri: uri,
                method: request.method,
                headers: {},
                jar: false
            };

            if (self.settings.passThrough) {                        // Never set with cache
                options.headers = Utils.clone(req.headers);
                delete options.headers.host;
            }

            if (self.settings.xforward) {
                options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + req.connection.remoteAddress || req.socket.remoteAddress;
                options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + req.connection.remotePort || req.socket.remotePort;
                options.headers['x-forwarded-proto'] = (options.headers['x-forwarded-proto'] ? options.headers['x-forwarded-proto'] + ',' : '') + self.settings.protocol;
            }

            var isGet = (request.method === 'get' || request.method === 'head');

            // Parsed payload interface

            if (self.settings.isCustomPostResponse ||                           // Custom response method
                (isGet && request.route.cache.mode.server)) {                   // GET/HEAD with Cache

                delete options.headers['accept-encoding'];                      // Remove until Request supports unzip/deflate
                self.httpClient(options, function (err, res, payload) {

                    // Request handles all redirect responses (3xx) and will return an err if redirection fails

                    if (err) {
                        return request.reply(Boom.internal('Proxy error', err));
                    }

                    return self.settings.postResponse(request, self.settings, res, payload);
                });

                return;
            }

            // Streamed payload interface

            if (!isGet &&
                request.rawPayload &&
                request.rawPayload.length) {

                options.headers['Content-Type'] = req.headers['content-type'];
                options.body = request.rawPayload;
            }

            var reqStream = self.httpClient(options);
            reqStream.once('response', function (resStream) {

                reqStream.removeAllListeners();
                request.reply(resStream);                   // Request._respond will pass-through headers and status code
            });

            if (!isGet &&
                !request.rawPayload) {

                request.raw.req.pipe(reqStream);
            }
        });
    };
};


internals.mapUri = function (protocol, host, port) {

    protocol = protocol || 'http';
    port = port || (protocol === 'http' ? 80 : 443);
    var baseUrl = protocol + '://' + host + ':' + port;

    return function (request, next) {

        return next(null, baseUrl + request.path + (request.url.search || ''));
    };
};


internals.postResponse = function (request, settings, res, payload) {

    var contentType = res.headers['content-type'];
    var statusCode = res.statusCode;

    if (statusCode >= 400) {
        return request.reply(Boom.passThrough(statusCode, payload, contentType));
    }

    var response = request.reply(payload);
    if (contentType) {
        response.type(contentType);
    }
};