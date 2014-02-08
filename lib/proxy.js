// Load modules

var Boom = require('boom');
var Nipple = require('nipple');
var Defaults = require('./defaults');
var Utils = require('./utils');
var Response = require('./response');


// Declare internals

var internals = {};


exports.handler = function (route, options) {

    Utils.assert(!route.payload || ((route.payload.output === 'data' || route.payload.output === 'stream') && !route.payload.parse), 'Cannot proxy if payload is parsed or if output is not stream or data');
    var settings = Utils.applyToDefaults(Defaults.proxy, options);
    settings.mapUri = options.mapUri || internals.mapUri(options.protocol, options.host, options.port, options.uri);

    if (options.rejectUnauthorized !== undefined) {
        settings.rejectUnauthorized = options.rejectUnauthorized;
    }

    if (settings.ttl === 'upstream') {
        settings._upstreamTtl = true;
    }

    return function (request, reply) {

        settings.mapUri(request, function (err, uri, headers) {

            if (err) {
                return reply(err);
            }

            var req = request.raw.req;

            var options = {
                headers: {},
                payload: request.payload,
                redirects: settings.redirects,
                timeout: settings.timeout,
                rejectUnauthorized: settings.rejectUnauthorized
            };

            var bind = (request.route.bind || request._route.env.bind);

            if (settings.passThrough) {
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

            if (settings.onResponse ||
                settings.postResponse) {                            // Backward compatibility

                delete options.headers['accept-encoding'];
            }

            var contentType = req.headers['content-type'];
            if (contentType) {
                options.headers['Content-Type'] = contentType;
            }

            // Send request

            Nipple.request(request.method, uri, options, function (err, res) {

                if (err) {
                    if (settings.onResponse) {
                        return settings.onResponse.call(bind, err, res, request, reply, settings, ttl);
                    }

                    return reply(err);
                }

                var ttl = null;
                if (settings._upstreamTtl) {
                    var cacheControlHeader = res.headers['cache-control'];
                    if (cacheControlHeader) {
                        var cacheControl = Nipple.parseCacheControl(cacheControlHeader);
                        if (cacheControl) {
                            ttl = cacheControl['max-age'] * 1000;
                        }
                    }
                }

                if (settings.onResponse) {
                    return settings.onResponse.call(bind, null, res, request, reply, settings, ttl);
                }

                if (settings.postResponse) {                                                        // Backward compatibility
                    return settings.postResponse.call(bind, request, reply, res, settings, ttl);
                }

                reply(res)
                    .ttl(ttl)
                    .passThrough(settings.passThrough || false);   // Default to false
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

    if (protocol &&
        protocol[protocol.length - 1] !== ':') {

        protocol += ':';
    }

    protocol = protocol || 'http:';
    port = port || (protocol === 'http:' ? 80 : 443);
    var baseUrl = protocol + '//' + host + ':' + port;

    return function (request, next) {

        return next(null, baseUrl + request.path + (request.url.search || ''));
    };
};
