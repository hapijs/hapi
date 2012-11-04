// Load modules

var Cache = require('./cache');
var Utils = require('./utils');
var Proxy = require('./proxy');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, server) {

    var self = this;

    // Setup and validate route configuration

    var settings = Utils.clone(options);        // Options can be reused

    Utils.assert(this.constructor === internals.Route, 'Route must be instantiated using new');
    Utils.assert(settings.path, 'Route options missing path');
    Utils.assert(settings.path.match(internals.Route.pathRegex), 'Invalid path: ' + settings.path);
    Utils.assert(settings.method, 'Route options missing method');
    Utils.assert(!settings.schema || !settings.payload || settings.payload === 'parse', 'Route payload must be set to \'parse\' when schema validation enabled');

    this.server = server;
    this.method = settings.method.toLowerCase();
    this.path = settings.path;
    this.config = Utils.applyToDefaults(server.routeDefaults, settings.config || {});

    Utils.assert(this.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(!!settings.handler ^ !!this.config.handler ^ !!this.config.proxy, 'Handler must appear once and only once');         // XOR
    this.config.handler = this.config.handler || settings.handler;

    // Payload configuration ('stream', 'raw', 'parse')
    // Default is 'parse' for POST and PUT otherwise 'stream'

    this.config.payload = this.config.payload ||
                          (this.config.schema || this.method === 'post' || this.method === 'put' ? 'parse' : 'stream');
    Utils.assert(['stream', 'raw', 'parse'].indexOf(this.config.payload) !== -1, 'Unknown route payload mode: ' + this.config.payload);

    // Authentication configuration

    this.config.auth = this.config.auth || {};
    this.config.auth.mode = this.config.auth.mode || (this.server.settings.authentication ? 'required' : 'none');
    Utils.assert(['required', 'optional', 'none'].indexOf(this.config.auth.mode) !== -1, 'Unknown authentication mode: ' + this.config.auth.mode);
    Utils.assert(this.config.auth.mode === 'none' || this.server.settings.authentication, 'Route requires authentication but none configured');

    if (this.config.auth.mode !== 'none') {
        this.config.auth.scope = this.config.auth.scope || null;
        this.config.auth.tos = this.config.auth.tos || this.server.settings.authentication.tos.min;
        this.config.auth.entity = this.config.auth.entity || 'user';

        Utils.assert(['user', 'app', 'any'].indexOf(this.config.auth.entity) !== -1, 'Unknown authentication entity: ' + this.config.auth.entity);
    }

    // Parse path

    this._generateRegex();      // Sets this.regexp, this.params, this.fingerprint

    // Cache

    Utils.assert(!this.config.cache || this.config.cache.mode === 'none' || this.method === 'get', 'Only GET routes can use a cache');
    if (this.config.cache) {
        this.config.cache.segment = this.config.cache.segment || this.fingerprint;
    }
    this.cache = new Cache.Policy(this.config.cache, this.server.cache);

    // Prerequisites

    /*
        [
            function (request, next) {},
            {
                method: function (request, next) {}
                assign: key1
            },
            {
                method: function (request, next) {},
                assign: key2,
                mode: parallel
            }
        ]
    */

    this.prerequisites = [];
    if (this.config.pre) {
        for (var i = 0, il = this.config.pre.length; i < il; ++i) {

            var pre = (typeof this.config.pre[i] === 'object' ? this.config.pre[i] : { method: this.config.pre[i] });
            Utils.assert(pre.method, 'Prerequisite config missing method');
            Utils.assert(typeof pre.method === 'function', 'Prerequisite method must be a function');

            pre.mode = pre.mode || 'serial';
            Utils.assert(pre.mode === 'serial' || pre.mode === 'parallel', 'Unknown prerequisite mode: ' + pre.mode);
            this.prerequisites.push(pre);
        }
    }

    // Proxy configuration

    if (this.config.proxy) {
        this.proxy = new Proxy(this.config.proxy, this);
        this.config.handler = this.proxy.handler();
    }

    return this;
};


//                                  /  legal-characters                percent-encoded  param       /param?
internals.Route.pathRegex = /^\/|((\/(([\w\!\$&'\(\)\*\+\,;\=\:@\-\.~]|%[A-F0-9]{2})+|(\{\w+\})))+(\/(\{\w+\?\})?)?)$/;


internals.Route.prototype._generateRegex = function () {

    var trailingSlashOptional = !this.server.settings.router.isTrailingSlashSensitive;

    // Split on /

    var segments = this.path.split('/');
    var params = {};
    var pathRX = '';
    var fingerprint = '';

    for (var i = 1, il = segments.length; i < il; ++i) {                            // Skip first empty segment
        var segment = segments[i];

        if (segment.charAt(0) === '{') {

            // Parameter

            var isOptional = segment.charAt(segment.length - 2) === '?';
            var name = segment.slice(1, isOptional ? -2 : -1);                      // Drop {} and ?
            Utils.assert(!params[name], 'Cannot repeat the same parameter name');
            params[name] = true;
            pathRX += (trailingSlashOptional ? '(?:' : '') + '\\/([^\\/]+)' + (trailingSlashOptional ? ')' : '') + (isOptional ? '?' : '');
            fingerprint += '/?';
        }
        else {

            // Literal

            pathRX += '\\/' + Utils.escapeRegex(segment);
            fingerprint += '/' + segment;
        }
    }

    // Trailing /

    if (this.path.charAt(this.path.length - 1) === '/') {
        pathRX += '\\/' + (trailingSlashOptional ? '?' : '');
        fingerprint += '/';
    }

    this.regexp = new RegExp('^' + pathRX + '$', this.server.settings.router.isCaseSensitive ? '' : 'i');
    this.params = Object.keys(params);
    this.fingerprint = fingerprint;
};


internals.Route.prototype.match = function (request) {

    var match = this.regexp.exec(request.path);

    if (!match) {
        return false;
    }

    request.params = {};

    if (this.params.length > 0) {
        for (var i = 1, il = match.length; i < il; ++i) {
            var key = this.params[i - 1];
            if (key) {
                try {
                    request.params[key] = (typeof match[i] === 'string' ? decodeURIComponent(match[i]) : match[i]);
                }
                catch (err) {
                    // decodeURIComponent can throw
                    return false;
                }
            }
        }
    }

    return true;
};


internals.Route.prototype.test = function (path) {

    var match = this.regexp.exec(path);
    return !!match;
};


