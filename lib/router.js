// Load modules

var Route = require('./route');
var Utils = require('./utils');


// Declare internals

var internals = {};


module.exports = internals.Router = function (server) {

    this.server = server;
    this.table = {};                                // Key: HTTP method or * for catch-all, value: sorted array of routes
    this.vhosts = null;                             // {} where Key: hostname, value: see this.table

    this.notfound = new Route({
        method: 'notfound',
        path: '/{p*}',
        config: {
            auth: false,                            // Override any defaults
            handler: 'notFound'
        }
    }, server);

    if (server.settings.cors) {
        this.cors = new Route({
            path: '/{p*}',
            method: 'options',
            config: {
                auth: false,                         // Override any defaults
                handler: function (request) {

                    request.reply({});
                }
            }
        }, server);
    }
};


internals.Router.prototype.route = function (request) {

    var vhost = (this.vhosts && request.info.host && this.vhosts[request.info.host.split(':')[0]]);

    // Lookup route

    var route = (vhost && internals.lookup(request, vhost, request.method)) ||
                internals.lookup(request, this.table, request.method) ||
                (request.method === 'head' && vhost && internals.lookup(request, vhost, 'get')) ||
                (request.method === 'head' && internals.lookup(request, this.table, 'get')) ||
                (request.method === 'options' && this.cors) ||
                (vhost && internals.lookup(request, vhost, '*')) ||
                internals.lookup(request, this.table, '*') ||
                this.notfound;

    return route;
};


internals.lookup = function (request, table, verb) {

    var match = null;
    var routes = table[verb];
    if (routes) {
        for (var i = 0, il = routes.length; !match && i < il; ++i) {
            var route = routes[i];
            if (route.match(request)) {
                match = route;
            }
        }
    }

    return match;
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
                self.vhosts = self.vhosts || {};
                self.vhosts[vhost] = self.vhosts[vhost] || {};
            }

            var table = (vhost === '*' ? self.table : self.vhosts[vhost]);
            table[route.method] = table[route.method] || [];

            // Check for existing route with same fingerprint

            var altFingerprint = (route._segments[route._segments.length - 1].isEmptyOk ? route.fingerprint.substring(0, route.fingerprint.length - 2) : '');
            
            table[route.method].forEach(function (existing) {

                Utils.assert(route.fingerprint !== existing.fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);
                Utils.assert(altFingerprint !== existing.fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);

                var altExistingFingerprint = (existing._segments[existing._segments.length - 1].isEmptyOk ? existing.fingerprint.substring(0, existing.fingerprint.length - 2) : '');
                Utils.assert(route.fingerprint !== altExistingFingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);
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

    collect(host && this.vhosts && this.vhosts[host]);
    collect(this.table);

    return result;
};
