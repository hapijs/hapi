// Load modules

var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'basic', 'Wrong scheme');
    Utils.assert(options.validateFunc, 'Missing required validateFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);                                               // Options can be reused
};


// Basic Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    var self = this;

    callback = Utils.nextTick(callback);

    var req = request.raw.req;
    var authorization = req.headers.authorization;
    if (!authorization) {
        return callback(Boom.unauthorized(null, 'Basic'));
    }

    var parts = authorization.split(/\s+/);

    if (parts[0] &&
        parts[0].toLowerCase() !== 'basic') {

        return callback(Boom.unauthorized(null, 'Basic'));
    }

    if (parts.length !== 2) {
        return callback(Boom.badRequest('Bad HTTP authentication header format', 'Basic'));
    }

    var credentialsParts = new Buffer(parts[1], 'base64').toString().split(':');
    if (credentialsParts.length !== 2) {
        return callback(Boom.badRequest('Bad header internal syntax', 'Basic'));
    }

    var username = credentialsParts[0];
    var password = credentialsParts[1];

    if (!username) {
        return callback(Boom.badRequest('HTTP authentication header missing username', 'Basic'));
    }

    this.settings.validateFunc(username, password, function (err, isValid, credentials) {

        credentials = credentials || null;

        if (err) {
            return callback(err, credentials, { log: { tags: ['auth', 'basic'], data: err } });
        }

        if (!isValid) {
            return callback(Boom.unauthorized('Bad username or password', 'Basic'), credentials);
        }

        if (typeof credentials !== 'object') {
            return callback(Boom.internal('Bad credentials object received for Basic auth validation'), null, { log: { tags: 'credentials' } });
        }

        // Authenticated

        return callback(null, credentials);
    });
};


