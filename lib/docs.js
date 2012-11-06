// Load modules

var Utils = require('./utils');
var Err = require('./error');
var Types = require('joi').Types;
var Fs = require('fs');
var Handlebars = require('handlebars');


// Declare internals

var internals = {};


exports.init = function(config) {

    Utils.assert(config.indexTemplate || config.indexTemplatePath, 'Config needs to specify either a indexTemplate or a indexTemplatePath');
    Utils.assert(config.routeTemplate || config.routeTemplatePath, 'Config needs to specify either a routeTemplate or a routeTemplatePath');

    var indexTemplateSource = config.indexTemplate || Fs.readFileSync(config.indexTemplatePath, 'utf8');
    var routeTemplateSource = config.routeTemplate || Fs.readFileSync(config.routeTemplatePath, 'utf8');

    internals.compiledIndexTemplate = Handlebars.compile(indexTemplateSource);
    internals.compiledRouteTemplate = Handlebars.compile(routeTemplateSource);

    internals.config = config;

    delete internals.config.indexTemplate;
    delete internals.config.routeTemplate;

    return {
        endpoint: internals.endpoint
    };
};


internals.generateIndexMarkup = function(routes) {

    Utils.assert(Object.prototype.toString.call(routes) === '[object Array]', 'routes must be an array');

    var templateData = internals.getRoutesData(routes);

    return internals.compiledIndexTemplate(templateData);
};


internals.generateRoutesMarkup = function(routes, path) {

    Utils.assert(Object.prototype.toString.call(routes) === '[object Array]', 'routes must be an array');

    var templateData = internals.getRoutesData(routes);
    templateData.path = path;

    return internals.compiledRouteTemplate(templateData);
};


internals.endpoint = function() {

    return {
        handler: internals.handler,
        query: { path: Types.String() }
    };
};


internals.handler = function(request) {

    var path = request.query.path;
    if (path) {
        request.reply(internals.getRoutesResponse(request.server, path));
    }
    else {
        request.reply(internals.getIndexResponse(request.server));
    }
};


internals.getIndexResponse = function(server) {

    var routes = [].concat(server._routes.post, server._routes.get);

    routes = routes.filter(function(route) {
        return route !== null && route !== undefined && route.path !== internals.config.docsEndpoint;
    });

    routes.sort(function(route1, route2) {
        return route1.path > route2.path;
    });

    return internals.generateIndexMarkup(routes);
};


internals.getRoutesResponse = function(server, path) {

    var routes = internals.findRoutes(server, path);

    return routes ? internals.generateRoutesMarkup(routes, path) : Err.notFound('No such path found');
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
        payloadParams: internals.getParamsData(route.config.schema),
        responseParams: internals.getParamsData(route.config.response)
    };
};


internals.getParamsData = function(params) {

    var paramsData = [];
    if (params === null || params === undefined) {
        return paramsData;
    }

    if (typeof params !== 'object') {
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
                type: param.type,
                required: param.__modifiers && param.__modifiers._values ? param.__modifiers._values.some(internals.isRequiredParam) : null,
                allowedValues: param.__valids ? internals.getExistsValues(param.__valids._exists) : null,
                disallowedValues: param.__invalids ? internals.getExistsValues(param.__invalids._exists) : null
            });
        }
    }

    return paramsData;
};


internals.getExistsValues = function(exists) {

    var values = [];
    if (exists === null || exists === undefined) {
        return values;
    }

    var keys = Object.keys(exists);
    keys.forEach(function(key) {
        key = key.substring(1, key.length - 1);
        if (key !== 'ndefine' && key !== 'ul' && key.length !== 0) {
            values.push(key);
        }
    });

    return values;
};


internals.isRequiredParam = function(element) {

    return element === 'required';
};
