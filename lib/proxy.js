// Load modules

var Boom = require('boom');
var Client = require('./client');
var Defaults = require('./defaults');
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
    Utils.assert(!options.redirects || (typeof options.redirects === 'number' && options.redirects >= 0), 'Proxy redirects must false or a positive number');

    this.settings = Utils.applyToDefaults(Defaults.proxy, options);
    this.settings.mapUri = options.mapUri || internals.mapUri(options.protocol, options.host, options.port);
    this.settings.xforward = options.xforward || false;
    this.settings.passThrough = options.passThrough || false;
    this.settings.isCustomPostResponse = !!options.postResponse;
    this.settings.postResponse = options.postResponse || internals.postResponse;     // function (request, settings, response, payload)
    this.settings.redirects = options.redirects || false;

    if (options.rejectUnauthorized !== undefined) {
        this.settings.rejectUnauthorized = options.rejectUnauthorized;
    }
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
                payload: null,
                redirects: self.settings.redirects,
                timeout: self.settings.timeout,
                rejectUnauthorized: self.settings.rejectUnauthorized,
                downstreamRes: request.raw.res
            };

            if (self.settings.passThrough) {                        // Never set with cache
                options.headers = Utils.clone(req.headers);
                delete options.headers.host;
            }

            if (headers) {
                Utils.merge(options.headers, headers);
            }

            if (self.settings.xforward) {
                options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + request.info.remoteAddress;
                options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + request.info.remotePort;
                options.headers['x-forwarded-proto'] = (options.headers['x-forwarded-proto'] ? options.headers['x-forwarded-proto'] + ',' : '') + self.settings.protocol;
            }

            var isParsed = (self.settings.isCustomPostResponse || request.route.cache.mode.server);
            if (isParsed) {
                delete options.headers['accept-encoding'];
            }

            // Pass payload

            var contentType = req.headers['content-type'];
            if (contentType) {
                options.headers['Content-Type'] = contentType;
            }

            options.payload = request.rawPayload || request.raw.req;

            // Send request

            Client.request(request.method, uri, options, function (err, res) {

                if (err) {
                    return request.reply(err);
                }

                if (!isParsed) {
                    return request.reply(res);                 // Request._respond will pass-through headers and status code
                }

                // Parse payload for caching or post-processing

                Client.parse(res, function (err, buffer) {

                    if (err) {
                        return request.reply(err);
                    }

                    return self.settings.postResponse(request, self.settings, res, buffer.toString());
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

    if (res.statusCode !== 200) {
        return request.reply(Boom.passThrough(res.statusCode, payload, contentType));
    }

    var response = request.reply(payload);
    if (contentType) {
        response.type(contentType);
    }
};

