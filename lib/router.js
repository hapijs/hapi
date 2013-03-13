// Load modules

var Route = require('./route');
var Utils = require('./utils');


// Declare internals

var internals = {};


module.exports = internals.Router = function (server) {

    this.server = server;
    this.table = {};                                // Key: HTTP method or * for catch-all, value: sorted array of routes
    this.vhosts = {};                               // Key: hostname, value: see this.table

    this.notfound = new Route({
        method: 'notfound',
        path: '/{p*}',
        config: {
            auth: { mode: 'none' },                 // In case defaults are set otherwise
            handler: 'notFound'
        }
    }, server);

    if (server.settings.cors) {
        this.cors = new Route({
            path: '/{p*}',
            method: 'options',
            config: {
                auth: { mode: 'none' },                 // In case defaults are set otherwise
                handler: function (request) {

                    request.reply({});
                }
            }
        }, server);
    }
};


internals.Router.prototype.route = function (request) {

    var method = (request.method === 'head' ? 'get' : request.method);
    var vhost = (request.raw.req.headers.host && this.vhosts[request.raw.req.headers.host]);

    var lookup = function (table, verb) {

        var routes = table[verb] || [];
        for (var i = 0, il = routes.length; i < il; ++i) {
            var route = routes[i];
            if (route.match(request)) {
                return route;
            }
        }

        return null;
    };

    // Lookup route

    var route = (vhost && lookup(vhost, method)) ||
                lookup(this.table, method) ||
                (method === 'options' && this.cors && this.cors) ||
                (vhost && lookup(vhost, '*')) ||
                lookup(this.table, '*') ||
                this.notfound;

    return route;
};


internals.Router.prototype.add = function (configs, env) {

    var self = this;

    Utils.assert(configs, 'Routes configs must exist');

    configs = (configs instanceof Array ? configs : [configs]);
    configs.forEach(function (config) {

        var route = new Route(config, self.server, env);                              // Do no use config beyond this point, use route members
        var vhosts = [].concat(config.vhost || '*');

        vhosts.forEach(function (vhost) {

            if (vhost !== '*') {
                self.vhosts[vhost] = self.vhosts[vhost] || {};
            }

            var table = (vhost === '*' ? self.table : self.vhosts[vhost]);
            table[route.method] = table[route.method] || [];

            // Check for existing route with same fingerprint

            table[route.method].forEach(function (existing) {

                Utils.assert(route.fingerprint !== existing.fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);
            });

            // Add and sort

            table[route.method].push(route);
            table[route.method].sort(Route.sort);
        });
    });
};


internals.Router.prototype.routingTable = function (host) {

    var self = this;

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

    collect(host && this.vhosts[host]);
    collect(this.table);

    return result;
};
