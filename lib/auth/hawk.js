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

    Hawk.server.authenticate(request.raw.req, this.settings.getCredentialsFunc, { hostHeaderName: this.settings.hostHeaderName }, function (err, credentials, attributes) {

        if (credentials) {
            credentials.authExt = attributes.ext;
            credentials.hash = attributes.hash;
        }

        return callback(err, credentials);
    });
};


internals.Scheme.prototype.authenticatePayload = function (payload, credentials, contentType, callback) {

    var isValid = Hawk.server.authenticatePayload(payload, credentials, credentials.hash, contentType);

    return callback(isValid ? null : Boom.unauthorized('Payload is invalid'));
};