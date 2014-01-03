// Load modules

var Boom = require('boom');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Plugin registration

exports.register = function (plugin, options, next) {

    var loadUser = function (username, password, callback) {

        if (username === 'john') {
            return callback(null, password === '12345', { user: 'john' });
        }

        return callback(null, false);
    };

    plugin.auth.scheme('basic', internals.implementation);
    plugin.auth.strategy('basic', 'basic', 'required', { validateFunc: loadUser });

    plugin.auth.scheme('special', function () { return { authenticate: function () { } } });
    plugin.auth.strategy('special', 'special', {});

    return next();
};


internals.implementation = function (server, options) {

    var settings = Hoek.clone(options);

    var scheme = {
        authenticate: function (request, reply) {

            var req = request.raw.req;
            var authorization = req.headers.authorization;
            if (!authorization) {
                return reply(Boom.unauthorized(null, 'Basic'));
            }

            var parts = authorization.split(/\s+/);

            if (parts[0] &&
                parts[0].toLowerCase() !== 'basic') {

                return reply(Boom.unauthorized(null, 'Basic'));
            }

            if (parts.length !== 2) {
                return reply(Boom.badRequest('Bad HTTP authentication header format', 'Basic'));
            }

            var credentialsParts = new Buffer(parts[1], 'base64').toString().split(':');
            if (credentialsParts.length !== 2) {
                return reply(Boom.badRequest('Bad header internal syntax', 'Basic'));
            }

            var username = credentialsParts[0];
            var password = credentialsParts[1];

            settings.validateFunc(username, password, function (err, isValid, credentials) {

                if (!isValid) {
                    return reply(Boom.unauthorized('Bad username or password', 'Basic'), { credentials: credentials });
                }

                return reply(null, { credentials: credentials });
            });
        }
    };

    return scheme;
};
