// Load modules

var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


exports.Scheme = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'basic', 'Wrong scheme');
    Utils.assert(options.loadUserFunc, 'Missing required loadUserFunc method in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);                                               // Options can be reused

    return this;
};


// Basic Authentication

internals.Scheme.prototype.authenticate = function (request, next) {

    var self = this;

    var authenticate = function (callback) {

        var req = request.raw.req;
        var authorization = req.headers.authorization;
        if (!authorization) {
            return callback(Err.unauthorized('Request missing authentication', 'Basic'));
        }

        var parts = authorization.split(/\s+/);
        if (parts.length !== 2) {
            return callback(Err.unauthorized('Bad HTTP authentication header format: ' + authorization, 'Basic'));
        }

        if (parts[0].toLowerCase() !== 'basic') {
            return callback(Err.unauthorized('Incorrect HTTP authentication scheme: ' + parts[0], 'Basic'));
        }

        var credentialsParts = new Buffer(parts[1], 'base64').toString().split(':');
        var credentials = {
            username: credentialsParts[0],
            password: credentialsParts[1]
        };

        self.settings.loadUserFunc(credentials.username, function (err, user) {

            if (err) {
                request.log(['auth', 'error', 'user'], err);
                return callback(err, null, true);
            }

            if (!user) {
                request.log(['auth', 'error', 'user', 'unknown']);
                return callback(Err.unauthorized('Bad username or password', 'Basic'), null, true);
            }

            if (!user.hasOwnProperty('password') ||
                !user.id ||
                user.id !== credentials.username) {

                request.log(['auth', 'error', 'user', 'invalid']);
                return callback(Err.internal('Bad user object received for Basic auth validation'), null, true);
            }

            // Check password

            if (user.password !== credentials.password) {
                request.log(['auth', 'error', 'user', 'password']);
                return callback(Err.unauthorized('Bad username or password', 'Basic'), null, true);
            }

            // Authenticated

            var session = {
                id: user.id,
                app: '',
                scope: user.scope,
                user: user.id,
                ext: user                       // ext.tos
            };

            delete session.ext.password;

            return callback(null, session);
        });
    };

    var validate = function (err, session, isLogged) {

        var config = request._route.config.auth;

        // Unauthenticated

        if (err) {
            if (config.mode === 'optional' &&
                !request.raw.req.headers.authorization) {

                request.session = null;
                request.log(['auth', 'unauthenticated']);
                return next();
            }

            if (isLogged) {
                request.log(['auth', 'unauthenticated', 'error'], err);
            }

            return next(err);
        }

        request.session = session;

        // Check scope

        if (config.scope &&
            session.scope.indexOf(config.scope) === -1) {

            request.log(['auth', 'error', 'scope'], { got: session.scope, need: config.scope });
            return next(Err.forbidden('Insufficient scope (\'' + config.scope + '\' expected)'));
        }

        // Check TOS

        var tos = (config.hasOwnProperty('tos') ? config.tos : self.settings.tos);
        if (tos &&
            (!session.ext || !session.ext.tos || session.ext.tos < tos)) {

            request.log(['auth', 'error', 'tos'], { min: tos, user: session.ext && session.ext.tos });
            return next(Err.forbidden('Insufficient TOS accepted'));
        }

        request.log(['auth']);
        return next();
    };

    if (request.session) {
        return validate(null, request.session);
    }

    authenticate(validate);
};


