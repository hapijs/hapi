// Load modules

var Boom = require('boom');
var Client = require('./client');
var Defaults = require('./defaults');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports.handler = function (options, route) {

    Utils.assert(!options.passThrough || !route.settings.cache.mode.server, 'Cannot use pass-through proxy mode with caching');
    Utils.assert(!options.ttl || route.settings.cache.mode.server || route.settings.cache.mode.client, 'Cannot set proxy ttl without caching');

    var settings = Utils.applyToDefaults(Defaults.proxy, options);
    settings.mapUri = options.mapUri || internals.mapUri(options.protocol, options.host, options.port, options.uri);
    settings.isCustomPostResponse = !!options.postResponse;
    settings.postResponse = options.postResponse || internals.postResponse;     // function (request, settings, response, payload)

    if (options.rejectUnauthorized !== undefined) {
        settings.rejectUnauthorized = options.rejectUnauthorized;
    }

    if (settings.ttl === 'upstream') {
        settings._upstreamTtl = true;
    }

    return function (request) {

        settings.mapUri(request, function (err, uri, headers) {

            if (err) {
                return request.reply(err);
            }

            var req = request.raw.req;

            var options = {
                headers: {},
                payload: null,
                redirects: settings.redirects,
                timeout: settings.timeout,
                rejectUnauthorized: settings.rejectUnauthorized,
                downstreamRes: request.raw.res
            };

            if (settings.passThrough) {                        // Never set with cache
                options.headers = Utils.clone(req.headers);
                delete options.headers.host;
            }

            if (headers) {
                Utils.merge(options.headers, headers);
            }

            if (settings.xforward) {
                options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + request.info.remoteAddress;
                options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + request.info.remotePort;
                options.headers['x-forwarded-proto'] = (options.headers['x-forwarded-proto'] ? options.headers['x-forwarded-proto'] + ',' : '') + settings.protocol;
            }

            var isParsed = (settings.isCustomPostResponse || request.route.cache.mode.server);
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

                var ttl = 0;
                if (settings._upstreamTtl) {
                    var cacheControlHeader = res.headers['cache-control'];
                    if (cacheControlHeader) {
                        var cacheControl = Client.parseCacheControl(cacheControlHeader);
                        if (cacheControl) {
                            ttl = cacheControl['max-age'] * 1000;
                        }
                    }
                }

                if (!isParsed) {
                    var response = request.reply(res);                      // Request._respond will pass-through headers and status code
                    if (ttl) {
                        response.ttl(ttl);
                    }
                    return;
                }

                // Parse payload for caching or post-processing

                Client.parse(res, function (err, buffer) {

                    if (err) {
                        return request.reply(err);
                    }

                    return settings.postResponse(request, settings, res, buffer.toString(), ttl);
                });
            });
        });
    };
};


internals.mapUri = function (protocol, host, port, uri) {

    if (uri) {
        return function (request, next) {

            if (uri.indexOf('{') === -1) {
                return next(null, uri);
            }

            var address = uri.replace(/{protocol}/g, request.server.info.protocol)
                             .replace(/{host}/g, request.server.info.host)
                             .replace(/{port}/g, request.server.info.port)
                             .replace(/{path}/g, request.url.path);

            return next(null, address);
        };
    }

    protocol = protocol || 'http';
    port = port || (protocol === 'http' ? 80 : 443);
    var baseUrl = protocol + '://' + host + ':' + port;

    return function (request, next) {

        return next(null, baseUrl + request.path + (request.url.search || ''));
    };
};


internals.postResponse = function (request, settings, res, payload, ttl) {

    var contentType = res.headers['content-type'];

    if (res.statusCode !== 200) {
        return request.reply(Boom.passThrough(res.statusCode, payload, contentType));
    }

    var response = request.reply(payload);
    if (ttl) {
        response.ttl(ttl);
    }

    if (contentType) {
        response.type(contentType);
    }
};
