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
    this.settings.hawk = this.settings.hawk || {};
    if (this.settings.hostHeaderName) {
        this.settings.hawk.hostHeaderName = this.settings.hostHeaderName;       // For backwards compatiblity
    }
};


// Hawk Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    Hawk.server.authenticate(request.raw.req, this.settings.getCredentialsFunc, this.settings.hawk, function (err, credentials, artifacts) {

        return callback(err, credentials, { artifacts: artifacts });
    });
};


internals.Scheme.prototype.authenticatePayload = function (request, callback) {

    callback = Utils.nextTick(callback);

    var isValid = Hawk.server.authenticatePayload(request.rawPayload, request.auth.credentials, request.auth.artifacts, request.raw.req.headers['content-type']);

    return callback(isValid ? null : Boom.unauthorized('Payload is invalid'));
};


internals.Scheme.prototype.responseHeader = function (request, response, callback) {

    callback = Utils.nextTick(callback);

    var payloadHash = Hawk.crypto.initializePayloadHash(request.auth.credentials.algorithm, response._headers['Content-Type']);

    response.header('Trailer', 'Server-Authorization');
    response.header('Transfer-Encoding', 'chunked');

    response._preview.on('peek', function (chunk) {

        payloadHash.update(chunk);
    });

    response._preview.once('finish', function () {

        var header = Hawk.server.header(request.auth.credentials, request.auth.artifacts, { hash: Hawk.crypto.finalizePayloadHash(payloadHash) });
        if (header) {
            request.raw.res.addTrailers({ 'Server-Authorization': header });
        }
    });

    callback();
};

