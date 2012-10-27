// Load modules

var Request = require('request');
var Utils = require('./utils');
var Err = require('./error');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Proxy = function (options, route) {

    var self = this;

    Utils.assert(options, 'Missing options');
    Utils.assert(options.host || options.mapUri, 'Missing options.host and no options.mapUri');
    Utils.assert(!options.passThrough || !route.cache.isMode('server'), 'Cannot use pass-through proxy mode with caching');
    Utils.assert(!options.mapUri || typeof options.mapUri === 'function', 'options.mapUri must be a function');

    this.settings = Utils.clone(options);                                   // Options can be reused
    this.settings.protocol = this.settings.protocol || 'http';
    this.settings.port = this.settings.port || (this.settings.protocol === 'http' ? 80 : 443);
    this.settings.xforward = this.settings.xforward || false;
    this.settings.passHeaders = this.settings.passThrough || false;
    this.settings.mapUri = this.settings.mapUri || internals.mapUri;        // function (err, uri, query)

    return this;
};


internals.Proxy.prototype.handler = function () {

    var self = this;

    return function (request) {

        self.settings.mapUri(request, self.settings, function (err, uri, query) {

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

            if (self.settings.passThrough) {                        // Never set with cache
                options.headers = Utils.clone(req.headers);
                delete options.headers.host;
            }

            if (self.settings.xforward) {
                options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + req.connection.remoteAddress || req.socket.remoteAddress;
                options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + req.connection.remotePort || req.socket.remotePort;
                options.headers['x-forwarded-proto'] = (options.headers['x-forwarded-proto'] ? options.headers['x-forwarded-proto'] + ',' : '') + self.settings.protocol;
            }

            if (request.method === 'get' ||
                request.method === 'head') {

                // No caching (pipe)

                if (!request._route ||
                    !request._route.cache.isMode('server')) {

                    var reqStream = Request(options);

                    reqStream.on('response', function (resStream) {

                        request.reply.stream(resStream);
                    });
                    return;
                }

                // Cache (parse response)

                Request(options, function (err, response, payload) {

                    if (err) {
                        return request.reply(Err.internal('Proxy error', err));
                    }

                    if (response.statusCode >= 400) {
                        return request.reply(Err.internal('Error proxy response', payload));
                    }

                    if (response.headers['content-type']) {
                        request.reply.type(response.headers['content-type']);
                    }

                    var headerKeys = Object.keys(response.headers);
                    for (var i = 0, il = headerKeys.length; i < il; ++i) {
                        var headerKey = headerKeys[i];
                        if (headerKey !== 'content-length') {
                            request.reply.header(headerKey, response.headers[headerKey]);
                        }
                    }

                    return request.reply(payload);
                });
            }
            else {
                if (request.rawBody) {
                    options.headers['Content-Type'] = req.headers['content-type'];
                    options.body = request.rawBody;
                }

                var reqStream = Request(options);

                if (request._route &&
                    request._route.config.payload === 'stream') {

                    request.raw.req.pipe(reqStream);
                }

                reqStream.on('response', function (resStream) {

                    request.reply.stream(resStream);                // Request._respond will pass-through headers and status code
                });
            }
        });
    };
};


internals.mapUri = function (request, options, callback) {

    return callback(null, options.protocol + '://' + options.host + ':' + options.port + request.path, request.query);
};

