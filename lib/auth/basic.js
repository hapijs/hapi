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

    var credentials = {
        username: credentialsParts[0],
        password: credentialsParts[1]
    };

    this.settings.loadUserFunc(credentials.username, function (err, user) {

        if (err) {
            request.log(['auth', 'user'], err);
            return callback(err, null, true);
        }

        if (!user) {
            request.log(['auth', 'error', 'user', 'unknown']);
            return callback(Boom.unauthorized('Bad username or password', 'Basic'), null, true);
        }

        if (!user.hasOwnProperty('password') ||
            !user.id ||
            user.id !== credentials.username) {

            request.log(['auth', 'error', 'user', 'invalid']);
            return callback(Boom.internal('Bad user object received for Basic auth validation'), null, true);
        }

        if (typeof self.settings.hashPasswordFunc === 'function') {
            credentials.password = self.settings.hashPasswordFunc(credentials.password);
        }

        // Check password

        if (!Cryptiles.fixedTimeComparison(user.password, credentials.password)) {
            request.log(['auth', 'error', 'user', 'password']);
            return callback(Boom.unauthorized('Bad username or password', 'Basic'), null, true);
        }

        // Authenticated

        var session = {
            id: user.id,
            app: '',
            scope: user.scope,
            user: user.id,
            ext: Utils.clone(user)                       // ext.tos
        };

        delete session.ext.password;

        return callback(null, session);
    });
};


