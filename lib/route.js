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


exports = module.exports = internals.Route = function (options, server, env) {

    // Apply plugin environment (before schema validation)

    if (env &&
        (env.route.vhost || env.route.prefix)) {

        options = Hoek.cloneWithShallow(options, ['config']);
        options.path = (env.route.prefix ? env.route.prefix + (options.path !== '/' ? options.path : '') : options.path);
        options.vhost = env.route.vhost || options.vhost;
    }

    // Setup and validate route configuration

    Hoek.assert(options.handler || (options.config && options.config.handler), 'Missing or undefined handler:', options.method, options.path);
    Hoek.assert(!!options.handler ^ !!(options.config && options.config.handler), 'Handler must only appear once:', options.method, options.path);            // XOR
    Hoek.assert(options.path === '/' || options.path[options.path.length - 1] !== '/' || !server.settings.router.stripTrailingSlash, 'Path cannot end with a trailing slash when server configured to strip:', options.method, options.path);

    Schema.assert('route', options, options.path);

    var handler = options.handler || options.config.handler;
    var method = options.method.toLowerCase();

    var handlerDefaults = Handler.defaults(method, handler, server);
    this.settings = Hoek.applyToDefaultsWithShallow(handlerDefaults, options.config || {}, ['bind', 'plugins', 'app']);
    this.settings.handler = handler;

    Schema.assert('routeConfig', this.settings, options.path);

    this.server = server;
    this.path = options.path;
    this.method = method;
    this._env = env || {};                                          // Plugin-specific environment

    this.settings.method = this.method;                             // Expose method in settings
    this.settings.path = this.path;                                 // Expose path in settings
    this.settings.vhost = options.vhost;                            // Expose vhost in settings
    this.settings.plugins = this.settings.plugins || {};            // Route-specific plugins settings, namespaced using plugin name
    this.settings.app = this.settings.app || {};                    // Route-specific application settings

    // Path parsing

    this._analysis = this.server._router.analyze(this.path);
    this.params = this._analysis.params;
    this.fingerprint = this._analysis.fingerprint;

    // Validation

    this.settings.validate = this.settings.validate || {};
    var validation = this.settings.validate;
    ['headers', 'params', 'query', 'payload'].forEach(function (type) {

        // null, undefined, true - anything allowed
        // false - nothing allowed
        // {...} - ... allowed

        var rule = validation[type];
        validation[type] = (rule === false ? Joi.object({})
                                           : typeof rule === 'function' ? rule
                                                                        : !rule || rule === true ? null                     // false tested earlier
                                                                                                 : Joi.compile(rule));
    });

    if (this.settings.response) {
        var rule = this.settings.response.schema;
        if (rule === true ||
            this.settings.response.sample === 0) {

            this.settings.response = null;
        }
        else {
            this.settings.response.schema = (rule === false ? Joi.object({})
                                                            : typeof rule === 'function' ? rule
                                                                                         : Joi.compile(rule));
        }
    }

    // Payload parsing

    if (this.method !== 'get' &&
        this.method !== 'head') {

        this.settings.payload = this.settings.payload || {};
        this.settings.payload.output = this.settings.payload.output || 'data';
        this.settings.payload.parse = this.settings.payload.parse !== undefined ? this.settings.payload.parse : true;
        this.settings.payload.maxBytes = this.settings.payload.maxBytes || this.server.settings.payload.maxBytes;
        this.settings.payload.uploads = this.settings.payload.uploads || this.server.settings.payload.uploads;
        this.settings.payload.failAction = this.settings.payload.failAction || 'error';
        this.settings.payload.timeout = this.settings.payload.timeout !== undefined ? this.settings.payload.timeout : this.server.settings.timeout.client;
        if (this.settings.payload.allow) {
            this.settings.payload.allow = [].concat(this.settings.payload.allow);
        }
    }
    else {
        Hoek.assert(!this.settings.payload, 'Cannot set payload settings on HEAD or GET request:', options.path);
        Hoek.assert(!this.settings.validate.payload, 'Cannot validate HEAD or GET requests:', options.path);
    }

    Hoek.assert(!this.settings.validate.payload || this.settings.payload.parse, 'Route payload must be set to \'parse\' when payload validation enabled:', options.method, options.path);
    Hoek.assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name:', options.path);

    // Authentication configuration

    this.settings.auth = this.server.auth._setupRoute(this.settings.auth, options.path);

    // Cache

    Hoek.assert(!this.settings.cache || this.method === 'get', 'Only GET routes can use a cache:', options.method, options.path);
    this._cache = this.settings.cache ? new Catbox.Policy(this.settings.cache) : null;

    // Files

    this.settings.files = this.settings.files || {};
    this.settings.files.relativeTo = this.settings.files.relativeTo || this._env.path || this.server.settings.files.relativeTo;

    // Handler

    this.settings.handler = Handler.configure(this.settings.handler, this);
    this._prerequisites = Handler.prerequisites(this.settings.pre, server);

    // Route lifecycle

    this._cycle = this.lifecycle();
};


internals.Route.prototype.lifecycle = function () {

    var cycle = [];

    // 'onRequest'

    if (this.server.settings.state.cookies.parse) {
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

    var definitions = request.server._stateDefinitions;
    var settings = request.server.settings.state;

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
                request.log(['hapi', 'state', 'error'], invalids[name]);
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
            request.log(['hapi', 'payload', 'error'], err);
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
