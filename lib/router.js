// Load modules

var Hoek = require('hoek');
var Boom = require('boom');
var Route = require('./route');


// Declare internals

var internals = {};


exports = module.exports = internals.Router = function (server) {

    this.server = server;
    this.routes = {};                                // Key: HTTP method or * for catch-all, value: sorted array of routes
    this.vhosts = null;                              // {} where Key: hostname, value: see this.routes

    this.notfound = new Route({
        method: 'notfound',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.notFound());
            }
        }
    }, server);

    this.badResource = new Route({
        method: 'badResource',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: function (request, reply) {

                return reply(Boom.badRequest('Invalid request path'));
            }
        }
    }, server);

    if (server.settings.cors) {
        this.cors = new Route({
            path: '/{p*}',
            method: 'options',
            config: {
                auth: false,                         // Override any defaults
                handler: function (request, reply) {

                    return reply({});
                }
            }
        }, server);
    }
};


internals.Router.prototype.route = function (request) {

    var vhost = (this.vhosts && request.info.host && this.vhosts[request.info.host.split(':')[0]]);

    // Lookup route

    var route = (vhost && internals.lookup(request, vhost, request.method)) ||
                internals.lookup(request, this.routes, request.method) ||
                (request.method === 'head' && vhost && internals.lookup(request, vhost, 'get')) ||
                (request.method === 'head' && internals.lookup(request, this.routes, 'get')) ||
                (request.method === 'options' && this.cors) ||
                (vhost && internals.lookup(request, vhost, '*')) ||
                internals.lookup(request, this.routes, '*') ||
                this.notfound;

    return (route instanceof Error ? this.badResource : route);
};


internals.lookup = function (request, table, verb) {

    var match = null;
    var routes = table[verb];
    if (routes) {
        for (var i = 0, il = routes.length; !match && i < il; ++i) {
            var route = routes[i];
            var test = route.match(request);                // Returns Error, true, false
            if (test) {
                match = (test === true ? route : test);
            }
        }
    }

    return match;
};


internals.Router.prototype.add = function (configs, env) {

    var self = this;

    Hoek.assert(configs, 'Routes config must exist');
    Hoek.assert(typeof configs === 'object', 'Route configuration must be an object or array');

    configs = (Array.isArray(configs) ? configs : [configs]);
    configs.forEach(function (config) {

        var methods = [].concat(config.method);
        methods.forEach(function (method) {

            config.method = method;
            var route = new Route(config, self.server, env);                // Do no use config beyond this point, use route members
            var vhosts = [].concat(route.settings.vhost || '*');

            vhosts.forEach(function (vhost) {

                if (vhost !== '*') {
                    self.vhosts = self.vhosts || {};
                    self.vhosts[vhost] = self.vhosts[vhost] || {};
                }

                var table = (vhost === '*' ? self.routes : self.vhosts[vhost]);
                table[route.method] = table[route.method] || [];

                // Check for existing route with same fingerprint

                var altFingerprint = (route._segments[route._segments.length - 1].isEmptyOk ? route.fingerprint.substring(0, route.fingerprint.length - 2) : '');

                table[route.method].forEach(function (existing) {

                    Hoek.assert(route.fingerprint !== existing.fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);
                    Hoek.assert(altFingerprint !== existing.fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);

                    var altExistingFingerprint = (existing._segments[existing._segments.length - 1].isEmptyOk ? existing.fingerprint.substring(0, existing.fingerprint.length - 2) : '');
                    Hoek.assert(route.fingerprint !== altExistingFingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);
                });

                // Add and sort

                table[route.method].push(route);
                table[route.method].sort(Route.sort);
            });
        });
    });
};


internals.Router.prototype.table = function (host) {

    var result = [];
    var collect = function (table) {

        if (!table) {
            return;
        }

        Object.keys(table).forEach(function (method) {

            table[method].forEach(function (route) {

                result.push(route);
            });
        });
    };

    if (this.vhosts) {
        var vhosts = host ? [].concat(host) : Object.keys(this.vhosts);
        for (var i = 0, il = vhosts.length; i < il; ++i) {
            collect(this.vhosts[vhosts[i]]);
        }
    }

    collect(this.routes);

    return result;
};
