// Load modules

var Utils = require('../utils');
var Boom = require('boom');
var Redirection = require('../response/redirection');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(server, 'Server is required');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'cookie', 'Wrong scheme');
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

internals.Scheme.prototype.authenticate = function (request, callback) {

    var self = this;

    callback = Utils.nextTick(callback);

    var validate = function () {

        // Check cookie

        var session = request.state[self.settings.cookie];
        if (!session) {
            return unauthenticated(Boom.unauthorized());
        }

        if (!self.settings.validateFunc) {
            return callback(null, session);
        }

        self.settings.validateFunc(session, function (err, isValid, credentials) {

            if (err ||
                !isValid) {

                if (self.settings.clearInvalid) {
                    request.clearState(self.settings.cookie);
                }

                return unauthenticated(Boom.unauthorized('Invalid cookie'), session, { log: (err ? { data: err } : 'Failed validation') });
            }

            if (credentials) {
                request.setState(self.settings.cookie, credentials);
            }

            return callback(null, credentials || session);
        });
    };

    var unauthenticated = function (err, session, options) {

        if (!self.settings.redirectTo) {
            return callback(err, session, options);
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

        return callback(new Redirection(uri), session, options);
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
            request.setState(self.settings.cookie, session);
        },
        clear: function () {

            request.clearState(self.settings.cookie);
        }
    };
};
