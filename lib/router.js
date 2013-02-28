// Load modules

var Route = require('./route');
var Utils = require('./utils');


// Declare internals

var internals = {};


module.exports = internals.Router = function (server) {

    this.server = server;
    this.table = {};                                // Array per HTTP method, including * for catch-all

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

    // Lookup route

    var method = (request.method === 'head' ? 'get' : request.method);

    var routes = this.table[method] || [];
    for (var i = 0, il = routes.length; i<il;++i) {
        var route = routes[i];
        if (route.match(request)) {
            return route;
        }
    }

    // CORS

    if (method === 'options' &&
        this.cors) {

        return this.cors;
    }

    // *

    routes = this.table['*'] || [];
    for (i = 0, il = routes.length; i < il; ++i) {
        var route = routes[i];
        if (route.match(request)) {
            return route;
        }
    }

    // Not found

    return this.notfound;
};


internals.Router.prototype.add = function (configs, env) {

    var self = this;

    Utils.assert(configs, 'Routes configs must exist');

    configs = (configs instanceof Array ? configs : [configs]);

    var methods = {};
    configs.forEach(function (config) {

        var route = new Route(config, self.server, env);                              // Do no use config beyond this point, use route members

        self.table[route.method] = self.table[route.method] || [];

        // Check for existing route with same fingerprint

        methods[route.method] = true;
        self.table[route.method].forEach(function (existing) {

            Utils.assert(route.fingerprint !== existing.fingerprint, 'New route: ' + route.path + ' conflicts with existing: ' + existing.path);
        });

        self.table[route.method].push(route);
    });

    Object.keys(methods).forEach(function (method) {

        self.table[method].sort(Route.sort);
    });
};


internals.Router.prototype.routingTable = function () {

    var self = this;

    var table = [];
    Object.keys(this.table).forEach(function (method) {

        self.table[method].forEach(function (route) {

            table.push(route);
        });
    });

    return table;
};
