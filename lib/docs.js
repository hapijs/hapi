// Load modules

var Err = require('./error');
var Types = require('joi').Types;
var Lout = require('lout');

// Declare internals

var internals = {};


exports.endpoint = function(config) {

    return {
        handler: internals.handler(config),
        query: { path: Types.String() }
    };
};


internals.handler = function(config) {

    var lout = new Lout(config);
    var pathsToFilter = [config.docsEndpoint];

    return function(request) {

        var path = request.query.path;
        var server = request.server;
        var routes = [];

        if (path) {
            routes = internals.findRoutes(server, path);

            if (!routes) {
                request.reply(Err.notFound('Path not found'));
            }
            else {
                request.reply(lout.generateRoutesMarkup(routes));
            }
        }
        else {
            routes = [].concat(server._routes.post, server._routes.get);

            routes = routes.filter(function(route) {
                return route && (!pathsToFilter || pathsToFilter.indexOf(route.path) === -1);
            });

            routes.sort(function(route1, route2) {
                return route1.path > route2.path;
            });

            request.reply(lout.generateIndexMarkup(routes));
        }
    };
};


internals.findRoutes = function (server, path) {

    var routes = [];
    routes.push(server._match('get', path));
    routes.push(server._match('post', path));

    routes = routes.filter(function(route) {
        return route !== null;
    });

    return routes.length > 0 ? routes : null;
};