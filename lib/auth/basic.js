// Load modules

var Cryptiles = require('cryptiles');
var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'basic', 'Wrong scheme');
    Utils.assert(options.loadUserFunc, 'Missing required loadUserFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);                                               // Options can be reused

    return this;
};


// Basic Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    var self = this;

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

    this.settings.loadUserFunc(username, function (err, credentials, hashedPassword) {

        if (err) {
            return callback(err, null, { log: { tags: ['auth', 'basic'], data: err } });
        }

        if (!credentials) {
            return callback(Boom.unauthorized('Bad username or password', 'Basic'), null, { log: { tags: 'user' } });
        }

        if (typeof credentials !== 'object') {
            return callback(Boom.internal('Bad credentials object received for Basic auth validation'), null, { log: { tags: 'credentials' } });
        }

        if (hashedPassword === null ||
            hashedPassword === undefined ||
            typeof hashedPassword !== 'string') {

            return callback(Boom.internal('Bad password received for Basic auth validation'), null, { log: { tags: ['password', 'invalid'] } });
        }

        if (typeof self.settings.hashPasswordFunc === 'function') {
            password = self.settings.hashPasswordFunc(password);
        }

        // Check password

        if (!Cryptiles.fixedTimeComparison(hashedPassword, password)) {
            return callback(Boom.unauthorized('Bad username or password', 'Basic'), null, { log: { tags: 'password' } });
        }

        // Authenticated

        return callback(null, credentials);
    });
};


