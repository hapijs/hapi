// Load modules

var Boom = require('boom');
var Call = require('call');
var Hoek = require('hoek');
var Route = require('./route');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports.create = function (server) {

    server._router = new Call.Router(server.settings.router);

    server._router.special('notFound', new Route({
        method: 'notFound',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.notFound());
            }
        }
    }, server));

    server._router.special('badRequest', new Route({
        method: 'badRequest',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.badRequest());
            }
        }
    }, server));

    if (server.settings.cors) {
        server._router.special('options', new Route({
            path: '/{p*}',
            method: 'options',
            config: {
                auth: false,                         // Override any defaults
                handler: function (request, reply) {

                    return reply({});
                }
            }
        }, server));
    }
};


exports.add = function (server, configs, env) {

    Hoek.assert(configs, 'Routes config must exist');
    Hoek.assert(typeof configs === 'object', 'Route configuration must be an object or array');

    [].concat(configs).forEach(function (config) {

        if (Array.isArray(config.method)) {
            config.method.forEach(function (method) {

                var settings = Utils.shallow(config);
                settings.method = method;
                internals.add(server, settings, env);
            });
        }
        else {
            internals.add(server, config, env);
        }
    });
};


internals.add = function (server, config, env) {

    var route = new Route(config, server, env);                // Do no use config beyond this point, use route members
    var vhosts = [].concat(route.settings.vhost || '*');

    vhosts.forEach(function (vhost) {

        var record = server._router.add({ method: route.method, path: route.path, vhost: vhost, analysis: route._analysis }, route);
        route.fingerprint = record.fingerprint;
        route.params = record.params;
    });
};
