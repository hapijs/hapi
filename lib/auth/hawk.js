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

        if (credentials) {
            credentials.artifacts = artifacts;
            delete credentials.artifacts.credentials;                           // Needed to prevent utils.clone from creating a maximum call stack error
        }

        return callback(err, credentials);
    });
};


internals.Scheme.prototype.authenticatePayload = function (payload, credentials, contentType, callback) {

    var isValid = Hawk.server.authenticatePayload(payload, credentials, credentials.artifacts.hash, contentType);

    return callback(isValid ? null : Boom.unauthorized('Payload is invalid'));
};


internals.Scheme.prototype.responseHeader = function (request, callback) {

    var artifacts = Utils.clone(request.session.artifacts);
    artifacts.credentials = request.session;

    var options = {
        contentType: request.response._headers['Content-Type']
    };

    if (request.response._payload &&
        request.response._payload.length) {

        options.payload = request.response._payload.join('');

        var header = Hawk.server.header(artifacts, options);
        if (header) {
            request.response.header('Authorization', header);
        }

        return callback(!header ? Boom.internal('Problem creating hawk response authorization header.') : null);
    }

    if (request.response.variety === 'stream' &&
        request.response.stream) {

        request.response.header('Trailer', 'Authorization');

        var payload = '';
        request.response.stream.on('data', function (chunk) {

            payload += chunk;
        });

        request.response.stream.once('end', function (chunk) {

            payload += chunk;
            options.payload = payload;

            var header = Hawk.server.header(artifacts, options);
            if (header) {
                request.raw.res.addTrailers({ Authorization: header });
            }
        });
    }

    callback();
};