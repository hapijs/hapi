// Load modules

var Request = require('request');
var Utils = require('./utils');
var Err = require('./error');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Proxy = function (options, route) {

    Utils.assert(options, 'Missing options');
    Utils.assert(!!options.host ^ !!options.mapUri, 'Must have either options.host or options.mapUri');
    Utils.assert(!options.passThrough || !route.cache.isMode('server'), 'Cannot use pass-through proxy mode with caching');
    Utils.assert(!options.mapUri || typeof options.mapUri === 'function', 'options.mapUri must be a function');
    Utils.assert(!options.postResponse || typeof options.postResponse === 'function', 'options.postResponse must be a function');
    Utils.assert(!options.hasOwnProperty('isCustomPostResponse'), 'Cannot manually set options.isCustomPostResponse');

    this.settings = {};
    this.settings.mapUri = options.mapUri || internals.mapUri(options.protocol, options.host, options.port);
    this.settings.xforward = options.xforward || false;
    this.settings.passHeaders = options.passThrough || false;
    this.settings.isCustomPostResponse = !!options.postResponse;
    this.settings.postResponse = options.postResponse || internals.postResponse;     // function (request, settings, response, payload)

    return this;
};


internals.Proxy.prototype.httpClient = Request;


internals.Proxy.prototype.handler = function () {

    var self = this;

    return function (request) {

        self.settings.mapUri(request, function (err, uri, query) {

            if (err) {
                return request.reply(err);
            }

            var req = request.raw.req;

            var options = {
                url: uri,
                method: request.method,
                qs: query,
                headers: {}
            };

            if (self.settings.passHeaders) {                        // Never set with cache
                options.headers = Utils.clone(req.headers);
                delete options.headers.host;
            }

            if (self.settings.xforward) {
                options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + req.connection.remoteAddress || req.socket.remoteAddress;
                options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + req.connection.remotePort || req.socket.remotePort;
                options.headers['x-forwarded-proto'] = (options.headers['x-forwarded-proto'] ? options.headers['x-forwarded-proto'] + ',' : '') + self.settings.protocol;
            }

            var isGet = (request.method === 'get' || request.method === 'head');

            if (self.settings.isCustomPostResponse ||                                       // Custom response method
                (isGet && request._route && request._route.cache.isMode('server'))) {       // GET/HEAD with Cache

                // Callback interface

                self.httpClient(options, function (err, response, payload) {

                    // Request handles all redirect responses (3xx) and will return an err if redirection fails

                    if (err) {
                        return request.reply(Err.internal('Proxy error', err));
                    }

                    return self.settings.postResponse(request, self.settings, response, payload);
                });
            }
            else {

                // Stream interface

                if (!isGet &&
                    request.rawBody) {

                    options.headers['Content-Type'] = req.headers['content-type'];
                    options.body = request.rawBody;
                }

                var reqStream = self.httpClient(options);

                reqStream.on('response', function (resStream) {

                    request.reply(resStream);                   // Request._respond will pass-through headers and status code
                });

                if (!isGet &&
                    request._route &&
                    request._route.config.payload === 'stream') {

                    request.reply.stream(reqStream)
                }
            }
        });
    };
};


internals.mapUri = function (protocol, host, port) {

    protocol = protocol || 'http';
    port = port || (protocol === 'http' ? 80 : 443);
    var baseUrl = protocol + '://' + host + ':' + port;

    return function (request, callback) {

        return callback(null, baseUrl + request.path, request.query);
    };
};


internals.postResponse = function (request, settings, response, payload) {

    var contentType = response.headers['content-type'];
    var statusCode = response.statusCode;

    if (statusCode >= 400) {
        return request.reply(Err.passThrough(statusCode, payload, contentType));
    }

    var response = request.reply.payload(payload);
    if (contentType) {
        response.type(contentType);
    }

    return response.send();
};