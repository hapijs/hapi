// Load modules

var Utils = require('../utils');
var Boom = require('boom');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(server, 'Server is required');
    Utils.assert(options, 'Invalid options');
    Utils.assert(!options.validateFunc || typeof options.validateFunc === 'function', 'Invalid validateFunc method in configuration');
    Utils.assert(options.password, 'Missing required password in configuration');
    Utils.assert(!options.appendNext || options.redirectTo, 'Cannot set \'appendNext\' without \'redirectTo\'');

    this.settings = Utils.clone(options);                           // Options can be reused
    this.settings.cookie = this.settings.cookie || 'sid';

    var cookieOptions = {
        encoding: 'iron',
        password: this.settings.password,
        isSecure: this.settings.isSecure !== false,                 // Defaults to true
        path: '/',
        isHttpOnly: this.settings.isHttpOnly !== false              // Defaults to true
    };

    if (this.settings.ttl) {
        cookieOptions.ttl = this.settings.ttl;
    }

    server.state(this.settings.cookie, cookieOptions);

    if (typeof this.settings.appendNext === 'boolean') {
        this.settings.appendNext = (this.settings.appendNext ? 'next' : '');
    }
};


// Cookie Authentication

internals.Scheme.prototype.authenticate = function (request, reply) {

    var self = this;

    var validate = function () {

        // Check cookie

        var session = request.state[self.settings.cookie];
        if (!session) {
            return unauthenticated(Boom.unauthorized());
        }

        if (!self.settings.validateFunc) {
            return reply(null, { credentials: session });
        }

        self.settings.validateFunc(session, function (err, isValid, credentials) {

            if (err ||
                !isValid) {

                if (self.settings.clearInvalid) {
                    reply.unstate(self.settings.cookie);
                }

                return unauthenticated(Boom.unauthorized('Invalid cookie'), { credentials: credentials, log: (err ? { data: err } : 'Failed validation') });
            }

            if (credentials) {
                reply.state(self.settings.cookie, credentials);
            }

            return reply(null, { credentials: credentials || session });
        });
    };

    var unauthenticated = function (err, result) {

        if (!self.settings.redirectTo) {
            return reply(err, result);
        }

        var uri = self.settings.redirectTo;
        if (self.settings.appendNext) {
            if (uri.indexOf('?') !== -1) {
                uri += '&';
            }
            else {
                uri += '?';
            }

            uri += self.settings.appendNext + '=' + encodeURIComponent(request.url.path);
        }

        return reply('You are being redirected...', result).redirect(uri);
    };

    validate();
};


internals.Scheme.prototype.extend = function (request) {

    var self = this;
    Utils.assert(!request.auth.session, 'The cookie scheme may not be registered more than once');

    // Decorate request

    request.auth.session = {
        set: function (session) {

            Utils.assert(session && typeof session === 'object', 'Invalid session');
            request._setState(self.settings.cookie, session);
        },
        clear: function () {

            request._clearState(self.settings.cookie);
        }
    };
};
