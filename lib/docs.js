// Load modules

var Utils = require('./utils');
var Types = require('joi').Types;
var Fs = require('fs');
var Handlebars = require('handlebars');


// Declare internals

var internals = {};


exports.init = function(config) {

    Utils.assert(config.template || config.templatePath, 'Config need to specify either a template or a templatePath');

    var templateSource = config.template || Fs.readFileSync(config.templatePath, 'utf8');
    internals.compiledTemplate = Handlebars.compile(templateSource);
    internals.config = config;

    delete internals.config.template;

    return {
        endpoint: internals.endpoint
    };
};


internals.generateMarkup = function(routes, path) {

    Utils.assert(Object.prototype.toString.call(routes) === '[object Array]', 'routes must be an array');

    var templateData = internals.getRoutesData(routes);
    templateData.path = path;

    return internals.compiledTemplate(templateData);
};


internals.endpoint = function() {

    return {
        handler: internals.handler,
        query: { path: Types.String().required() }
    };
};


internals.handler = function(request) {

    var path = request.query.path;
    var routes = internals.findRoutes(request.server, path);
    var markup = internals.generateMarkup(routes, path);
    request.reply(markup);
};


internals.findRoutes = function (server, path) {

    var routes = [];

    routes.push(server._match('get', path));
    routes.push(server._match('post', path));

    return routes;
};


internals.getRoutesData = function(routes) {

    var routesData = [];
    var templateConfig = Utils.clone(internals.config);

    for (var i = 0, il = routes.length; i < il; ++i) {
        var routeData = internals.getRouteData(routes[i]);

        if (routeData) {
            routesData.push(routeData);
        }
    }
    
    templateConfig.routes = routesData;

    return templateConfig;
};


internals.getRouteData = function(route) {

    return route === null ? null : {
        path: route.path,
        method: route.method.toUpperCase(),
        description: route.description,
        notes: route.notes,
        tags: route.tags,
        queryParams: internals.getParamsData(route.config.query),
        payloadParams: internals.getParamsData(route.config.schema)
    };
};


internals.getParamsData = function(params) {

    var paramsData = [];
    if (params === null || params === undefined) {
        return paramsData;
    }

    var keys = Object.keys(params);

    if (keys) {
        for (var i = 0, il = keys.length; i < il; ++i) {
            var key = keys[i];
            var param = params[key];
            paramsData.push({
                name: key,
                description: typeof param.description === 'function' ? '' : param.description,
                notes: typeof param.notes === 'function' ? '' : param.notes,
                tags: typeof param.tags === 'function' ? '' : param.tags,
                type: param.type
            });
        }
    }

    return paramsData;
};