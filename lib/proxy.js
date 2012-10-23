// Load modules

var Request = require('request');
var Utils = require('./utils');
var Err = require('./error');


// Declare internals

var internals = {};


// Create and configure server instance

exports = module.exports = internals.Proxy = function (options) {

    var self = this;

    Utils.assert(options, 'Missing options');
    Utils.assert(options.host, 'Missing destination host option');

    this.settings = Utils.clone(options);       // Options can be reused
    this.settings.protocol = this.settings.protocol || 'http';
    this.settings.port = this.settings.port || (this.settings.protocol === 'http' ? 80 : 443);
    this.settings.xforward = this.settings.xforward || false;
    this.settings.passHeaders = this.settings.passHeaders || true;
};


internals.Proxy.prototype.handler = function () {

    var self = this;

    return function (request) {

        var req = request.raw.req;

        var options = {
            url: self.settings.protocol + '://' + self.settings.host + ':' + self.settings.port + request.path,
            method: request.method,
            qs: request.query,
            headers: {}
        };

        if (self.settings.passHeaders) {
            options.headers = Utils.clone(req.headers);
            delete options.headers.host;
        }

        if (self.settings.xforward) {
            options.headers['x-forwarded-for'] = (options.headers['x-forwarded-for'] ? options.headers['x-forwarded-for'] + ',' : '') + req.connection.remoteAddress || req.socket.remoteAddress;
            options.headers['x-forwarded-port'] = (options.headers['x-forwarded-port'] ? options.headers['x-forwarded-port'] + ',' : '') + req.connection.remotePort || req.socket.remotePort;
        }

        delete options.headers['accept-encoding'];          // Disable gzip encoding


        if (request.method === 'get' ||
            request.method === 'head') {

            if (!request._route ||
                !request._route.cache.isMode('server')) {

                var stream = Request(options);
                return request.reply.pipe(stream);
            }

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
                        request.raw.res.setHeader(headerKey, response.headers[headerKey]);
                    }
                }

                return request.reply(payload);
            });
        }
        else {

            if (request.rawBody) {
                if (!self.settings.passHeaders) {
                    options.headers['Content-Type'] = req.headers['content-type'];
                }

                options.body = request.rawBody;
            }

            var stream = Request(options);
            var useRawPipe = request._route && request._route.settings.payload === 'stream';

            return useRawPipe ? req.pipe(stream) : request.reply.pipe(stream);
        }
    };
};