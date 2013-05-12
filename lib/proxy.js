// Load modules

var Boom = require('boom');
var Client = require('./client');
var Utils = require('./utils');


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


internals.Proxy.prototype.handler = function () {

    var self = this;

    return function (request) {

        self.settings.mapUri(request, function (err, uri, headers) {

            if (err) {
                return request.reply(err);
            }

            var req = request.raw.req;

            var options = {
                headers: {},
                payload: null
            };

            if (self.settings.passThrough) {                        // Never set with cache
                options.headers = Utils.clone(req.headers);
                delete options.headers.host;
            }

            if (headers) {
                Utils.merge(options.headers, headers);
            }

            if (self.settings.xforward) {
                options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + req.connection.remoteAddress || req.socket.remoteAddress;
                options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + req.connection.remotePort || req.socket.remotePort;
                options.headers['x-forwarded-proto'] = (options.headers['x-forwarded-proto'] ? options.headers['x-forwarded-proto'] + ',' : '') + self.settings.protocol;
            }

            var isParsed = (self.settings.isCustomPostResponse || request.route.cache.mode.server);
            if (isParsed) {
                delete options.headers['accept-encoding'];
            }

            // Set payload

            if (request.rawPayload &&
                request.rawPayload.length) {

                options.headers['Content-Type'] = req.headers['content-type'];
                options.payload = request.rawPayload;
            }
            else {
                options.payload = request.raw.req;
            }

            // Send request

            Client.request(request.method, uri, options, function (err, res) {

                if (err) {
                    console.log(err);
                    return request.reply(Boom.internal('Proxy error', err));
                }

                if (!isParsed) {
                    return request.reply(res);                 // Request._respond will pass-through headers and status code
                }

                Client.parse(res, function (err, buffer) {

                    if (err) {
                        return request.reply(err);
                    }

                    return self.settings.postResponse(request, self.settings, res, buffer);
                });
            });
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