// Load modules

var Utils = require('../utils');
var Err = require('../error');


// Declare internals

var internals = {};


exports = module.exports = internals.Scheme = function (server, options) {

    Utils.assert(this.constructor === internals.Scheme, 'Scheme must be instantiated using new');
    Utils.assert(options, 'Invalid options');
    Utils.assert(options.scheme === 'cookie', 'Wrong scheme');
    Utils.assert(options.validateFunc, 'Missing required validateFunc method in configuration');
    Utils.assert(options.password, 'Missing required password in configuration');
    Utils.assert(server, 'Server is required');

    this.settings = Utils.clone(options);                                               // Options can be reused
    this.settings.cookie = this.settings.cookie || 'session';

    var cookieOptions = {
        encoding: 'iron',
        password: this.settings.password,
        isSecure: !this.settings.allowInsecure
    };

    if (this.settings.ttl) {
        cookieOptions.ttl = this.settings.ttl;
    }

    server.state(this.settings.cookie, cookieOptions);

    return this;
};


// Cookie Authentication

internals.Scheme.prototype.authenticate = function (request, callback) {

    var self = this;

    // Decorate request

    request.setSession = function (session) {

        var state = {
            name: self.settings.cookie,
            value: session
        };

        request._states.push(state);
    };

    // Check cookie

    var session = request.state[this.settings.cookie];
    if (!session) {
        return callback(Err.unauthorized());
    }

    this.settings.validateFunc(session, function (err) {

        if (err) {
            if (self.settings.clearInvalid) {
                request._states.push({ name: self.settings.cookie, ttl: 0 });
            }
            request.log(['auth', 'validate'], err);
            return callback(Err.unauthorized(), session, true);
        }

        return callback(null, session);
    });
};


