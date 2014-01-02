// Load modules

var Hawk = require('hawk');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'hawk', 'Wrong scheme');
    Utils.assert(options.getCredentialsFunc, 'Missing required getCredentialsFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);
    this.settings.hawk = this.settings.hawk || {};
};


// Hawk Authentication

internals.Scheme.prototype.authenticate = function (request, reply) {

    Hawk.server.authenticate(request.raw.req, this.settings.getCredentialsFunc, this.settings.hawk, function (err, credentials, artifacts) {

        return reply(err, { credentials: credentials, artifacts: artifacts });
    });
};


internals.Scheme.prototype.authenticatePayload = function (request, callback) {

    callback = Utils.nextTick(callback);

    var isValid = Hawk.server.authenticatePayload(request.rawPayload, request.auth.credentials, request.auth.artifacts, request.headers['content-type']);

    return callback(isValid ? null : Boom.unauthorized('Payload is invalid'));
};


internals.Scheme.prototype.responseHeader = function (request, response, callback) {

    callback = Utils.nextTick(callback);

    var payloadHash = Hawk.crypto.initializePayloadHash(request.auth.credentials.algorithm, response.headers['content-type']);

    response._header('trailer', 'server-authorization');
    response._header('transfer-encoding', 'chunked');

    response.on('peek', function (chunk) {

        payloadHash.update(chunk);
    });

    response.once('finish', function () {

        var header = Hawk.server.header(request.auth.credentials, request.auth.artifacts, { hash: Hawk.crypto.finalizePayloadHash(payloadHash) });
        if (header) {
            request.raw.res.addTrailers({ 'server-authorization': header });
        }
    });

    callback();
};

