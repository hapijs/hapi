// Load modules

var Boom = require('boom');
var Catbox = require('catbox');
var Hoek = require('hoek');
var Joi = require('joi');
var Statehood = require('statehood');
var Subtext = require('subtext');
var Schema = require('./schema');
var Auth = require('./auth');
var Validation = require('./validation');
var Handler = require('./handler');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, connection, env) {

    // Apply plugin environment (before schema validation)

    if (env.routes.vhost ||
        env.routes.prefix) {

        options = Hoek.cloneWithShallow(options, ['config']);       // config is left unchanged
        options.path = (env.routes.prefix ? env.routes.prefix + (options.path !== '/' ? options.path : '') : options.path);
        options.vhost = env.routes.vhost || options.vhost;
    }

    // Setup and validate route configuration

    Hoek.assert(options.path, 'Route missing path');
    Hoek.assert(options.handler || (options.config && options.config.handler), 'Missing or undefined handler:', options.method, options.path);
    Hoek.assert(!!options.handler ^ !!(options.config && options.config.handler), 'Handler must only appear once:', options.method, options.path);            // XOR
    Hoek.assert(options.path === '/' || options.path[options.path.length - 1] !== '/' || !connection.settings.router.stripTrailingSlash, 'Path cannot end with a trailing slash when connection configured to strip:', options.method, options.path);

    Schema.assert('route', options, options.path);

    var handler = options.handler || options.config.handler;
    var method = options.method.toLowerCase();

    // Apply settings in order: {connection} <- {handler} <- {env} <- {route}

    var handlerDefaults = Handler.defaults(method, handler, connection.server);
    var base = Hoek.applyToDefaultsWithShallow(connection.settings.routes, handlerDefaults, ['bind']);
    base = Hoek.applyToDefaultsWithShallow(base, env.settings, ['bind']);
    this.settings = Hoek.applyToDefaultsWithShallow(base, options.config || {}, ['bind']);
    this.settings.handler = handler;

    Schema.assert('routeConfig', this.settings, options.path);

    var socketTimeout = (this.settings.timeout.socket === undefined ? 2 * 60 * 1000 : this.settings.timeout.socket);
    Hoek.assert(!this.settings.timeout.server || !socketTimeout || this.settings.timeout.server < socketTimeout, 'Server timeout must be shorter than socket timeout:', options.path);
    Hoek.assert(!this.settings.payload.timeout || !socketTimeout || this.settings.payload.timeout < socketTimeout, 'Payload timeout must be shorter than socket timeout:', options.path);

    this.connection = connection;
    this.server = connection.server;
    this.path = options.path;
    this.method = method;
    this._viewsEnv = env;

    this.settings.method = this.method;                             // Expose method in settings
    this.settings.path = this.path;                                 // Expose path in settings
    this.settings.vhost = options.vhost;                            // Expose vhost in settings
    this.settings.plugins = this.settings.plugins || {};            // Route-specific plugins settings, namespaced using plugin name
    this.settings.app = this.settings.app || {};                    // Route-specific application settings

    // Path parsing

    this._analysis = this.connection._router.analyze(this.path);
    this.params = this._analysis.params;
    this.fingerprint = this._analysis.fingerprint;

    // Validation

    this.settings.validate = this.settings.validate || {};
    var validation = this.settings.validate;
    ['headers', 'params', 'query', 'payload'].forEach(function (type) {

        validation[type] = internals.compileRule(validation[type]);
    });

    if (this.settings.response) {
        var rule = this.settings.response.schema;
        this.settings.response.status = this.settings.response.status || {};
        var statuses = Object.keys(this.settings.response.status);

        if ((rule === true && !statuses.length) ||
            this.settings.response.sample === 0) {

            this.settings.response = null;
        }
        else {
            this.settings.response.schema = internals.compileRule(rule);
            for (var i = 0, il = statuses.length; i < il; ++i) {
                var code = statuses[i];
                this.settings.response.status[code] = internals.compileRule(this.settings.response.status[code]);
            }
        }
    }

    // Payload parsing

    if (this.method === 'get' ||
        this.method === 'head') {

        this.settings.payload = null;
    }
    else {
        if (this.settings.payload.allow) {
            this.settings.payload.allow = [].concat(this.settings.payload.allow);
        }
    }

    Hoek.assert(!this.settings.validate.payload || this.settings.payload.parse, 'Route payload must be set to \'parse\' when payload validation enabled:', options.method, options.path);
    Hoek.assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name:', options.path);

    // Authentication configuration

    this.settings.auth = this.connection.auth._setupRoute(this.settings.auth, options.path);

    // Cache

    Hoek.assert(!this.settings.cache || this.method === 'get', 'Only GET routes can use a cache:', options.method, options.path);
    this._cache = this.settings.cache ? new Catbox.Policy(this.settings.cache) : null;

    // Handler

    this.settings.handler = Handler.configure(this.settings.handler, this);
    this._prerequisites = Handler.prerequisites(this.settings.pre, this.server);

    // Route lifecycle

    this._cycle = this.lifecycle();
};


internals.compileRule = function (rule) {

    // null, undefined, true - anything allowed
    // false - nothing allowed
    // {...} - ... allowed

    return (rule === false ? Joi.object({})
                           : typeof rule === 'function' ? rule
                                                        : !rule || rule === true ? null                     // false tested earlier
                                                                                 : Joi.compile(rule));
};


internals.Route.prototype.lifecycle = function () {

    var cycle = [];

    // 'onRequest'

    if (this.connection.settings.state.cookies.parse) {
        cycle.push(internals.state);
    }

    cycle.push('onPreAuth');

    var authenticate = (this.settings.auth !== false);                          // Anything other than 'false' can still require authentication
    if (authenticate) {
        cycle.push(Auth.authenticate);
    }

    if (this.method !== 'get' &&
        this.method !== 'head') {

        cycle.push(internals.payload);

        if (authenticate) {
            cycle.push(Auth.payload);
        }
    }

    cycle.push('onPostAuth');

    if (this.settings.validate.headers) {
        cycle.push(Validation.headers);
    }

    if (this.settings.validate.params) {
        cycle.push(Validation.params);
    }

    if (this.settings.jsonp) {
        cycle.push(internals.parseJSONP);
    }

    if (this.settings.validate.query) {
        cycle.push(Validation.query);
    }

    if (this.settings.validate.payload) {
        cycle.push(Validation.payload);
    }

    cycle.push('onPreHandler');
    cycle.push(Handler.execute);                                     // Must not call next() with an Error
    cycle.push('onPostHandler');                                     // An error from here on will override any result set in handler()

    if (this.settings.response) {
        cycle.push(Validation.response);
    }

    // 'onPreResponse'

    return cycle;
};


internals.state = function (request, next) {

    request.state = {};

    var req = request.raw.req;
    var cookies = req.headers.cookie;
    if (!cookies) {
        return next();
    }

    var definitions = request.connection._stateDefinitions;
    var settings = request.connection.settings.state;

    Statehood.parse(cookies, definitions, function (err, state, invalids) {

        request.state = state;

        var names = Object.keys(invalids);
        for (var i = 0, il = names.length; i < il; ++i) {
            var name = names[i];
            var definition = definitions.cookies[name];

            if (definition &&
                definition.clearInvalid !== undefined ? definition.clearInvalid : settings.cookies.clearInvalid) {

                request._clearState(name);
            }

            // failAction: 'error', 'log', 'ignore'

            var failAction = (definition && definition.failAction !== undefined ? definition.failAction
                                                                                : settings.cookies.failAction);
            if (failAction !== 'ignore') {
                request._log(['state', 'error'], invalids[name]);
            }
        }

        return next(err);
    });
};


internals.payload = function (request, next) {

    if (request.method === 'get' || request.method === 'head') {            // When route.method is '*'
        return next();
    }

    Subtext.parse(request.raw.req, request._tap(), request.route.payload, function (err, parsed) {

        request.mime = parsed.mime;
        request.payload = parsed.payload || null;

        if (!err) {
            return next();
        }

        var failAction = request.route.payload.failAction;                  // failAction: 'error', 'log', 'ignore'
        if (failAction !== 'ignore') {
            request._log(['payload', 'error'], err);
        }

        if (failAction === 'error') {
            return next(err);
        }

        return next();
    });
};


internals.parseJSONP = function (request, next) {

    var jsonp = request.query[request.route.jsonp];
    if (jsonp) {
        if (/^[\w\$\[\]\.]+$/.test(jsonp) === false) {
            return next(Boom.badRequest('Invalid JSONP parameter value'));
        }

        request.jsonp = jsonp;
        delete request.query[request.route.jsonp];
    }

    return next();
};
