// Load modules

var Hawk = require('hawk');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'hawk', 'Wrong scheme');
    Utils.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);
    this.settings.hostHeaderName = this.settings.hostHeaderName || 'host';

    return this;
};


// Hawk Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    Hawk.server.authenticate(request.raw.req, this.settings.getCredentialsFunc, { hostHeaderName: this.settings.hostHeaderName }, function (err, credentials, artifacts) {

        return callback(err, credentials, { artifacts: artifacts });
    });
};


internals.Scheme.prototype.authenticatePayload = function (request, callback) {

    var isValid = Hawk.server.authenticatePayload(request.rawBody, request.auth.credentials, request.auth.artifacts.hash, request.raw.req.headers['content-type']);

    return callback(isValid ? null : Boom.unauthorized('Payload is invalid'));
};


internals.Scheme.prototype.responseHeader = function (request, callback) {

    var artifacts = Utils.clone(request.auth.artifacts);
    artifacts.credentials = request.auth.credentials;

    var options = {
        contentType: request._response._headers['Content-Type']
    };

    if (request._response._payload &&
        request._response._payload.length) {

        options.payload = request._response._payload.join('');

        var header = Hawk.server.header(artifacts, options);
        if (header) {
            request._response.header('Server-Authorization', header);
        }

        return callback(!header ? Boom.internal('Problem creating hawk response authorization header.') : null);
    }

    if (request._response.variety === 'stream' &&
        request._response.stream) {

        request._response.header('Trailer', 'Server-Authorization');

        var payload = '';
        request._response.stream.on('data', function (chunk) {

            payload += chunk;
        });

        request._response.stream.once('end', function (chunk) {

            payload += chunk;
            options.payload = payload;

            var header = Hawk.server.header(artifacts, options);
            if (header) {
                request.raw.res.addTrailers({ 'Server-Authorization': header });
            }
        });
    }

    callback();
};