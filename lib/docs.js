// Load modules

var Err = require('./error');
var Joi = require('joi');
var Lout = require('lout');

// Declare internals

var internals = {};


exports.handler = function (route, config) {

    if (typeof config === 'boolean') {
        config = {};
    }

    config.docsEndpoint = this.path;

    route.config.query = {
        path: Joi.types.String()
    };

    var lout = new Lout(config);

    return function (request) {

        var routes = [];

        if (request.query.path) {
            var path = request.query.path;

            routes.push(request.server._match('get', path));
            routes.push(request.server._match('post', path));

            routes = routes.filter(function (item) {

                return !!item;
            });

            if (!routes.length) {
                return request.reply(Err.notFound());
            }

            return request.reply(lout.generateRoutesMarkup(routes));
        }

        routes = request.server._routeTable();
        routes = routes.filter(function (item) {

            return item && item.path !== route.path;
        });

        routes.sort(function (route1, route2) {

            return route1.path > route2.path;
        });

        return request.reply(lout.generateIndexMarkup(routes));
    };
};