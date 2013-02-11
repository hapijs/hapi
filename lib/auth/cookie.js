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
    Utils.assert(options.validateFunc, 'Missing required validateFunc method in configuration');
    Utils.assert(options.password, 'Missing required password in configuration');
    Utils.assert(!options.appendNext || options.redirectTo, 'Cannot set \'appendNext\' without \'redirectTo\'');

    this.settings = Utils.clone(options);                                               // Options can be reused
    this.settings.cookie = this.settings.cookie || 'session';

    var cookieOptions = {
        encoding: 'iron',
        password: this.settings.password,
        isSecure: !this.settings.allowInsecure,
        path: '/'
    };

    if (this.settings.ttl) {
        cookieOptions.ttl = this.settings.ttl;
    }

    if (typeof this.settings.appendNext === 'boolean') {
        this.settings.appendNext = (this.settings.appendNext ? 'next' : '');
    }

    server.state(this.settings.cookie, cookieOptions);

    return this;
};


// Cookie Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    var self = this;

    var validate = function () {

        // Check cookie

        var session = request.state[self.settings.cookie];
        if (!session) {
            return unauthenticated(Boom.unauthorized());
        }

        self.settings.validateFunc(session, function (err, override) {

            if (err) {
                if (self.settings.clearInvalid) {
                    request.clearState(self.settings.cookie);
                }

                request.log(['auth', 'validate'], err);
                return unauthenticated(Boom.unauthorized('Invalid cookie'), session, true);
            }

            if (override) {
                request.setState(self.settings.cookie, override);
            }

            return callback(null, override || session);
        });
    };

    var unauthenticated = function (err, session, wasLogged) {

        if (!self.settings.redirectTo) {
            return callback(err, session, wasLogged);
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

        return callback(new Redirection(uri), session, wasLogged);
    };

    validate();
};


internals.Scheme.prototype.extend = function (request) {

    var self = this;

    // Decorate request

    request.setSession = function (session) {

        request.setState(self.settings.cookie, session);
    };

    request.clearSession = function () {

        request.clearState(self.settings.cookie);
    };
};
