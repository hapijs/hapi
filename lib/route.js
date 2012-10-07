/*
* Path regular expression parsing adapted from Express, Copyright (c) 2009-2012 TJ Holowaychuk <tj@vision-media.ca>
* Express is released under the MIT License and is available at http://expressjs.com
*/

// Load modules

var Cache = require('./cache');
var Utils = require('./utils');


// Declare internals

var internals = {};


exports = module.exports = Route = function (options, server) {

    var self = this;

    // Setup and validate route configuration

    var settings = Utils.clone(options);        // Options can be reused

    Utils.assert(this.constructor === Route, 'Route must be instantiated using new');
    Utils.assert(settings.path, 'Route options missing path');
    Utils.assert(settings.path.charAt(0) === '/', 'Path must begin with \'/\'');
    Utils.assert(settings.method, 'Route options missing method');
    Utils.assert(!settings.schema || !settings.payload || settings.payload === 'parse', 'Route payload must be set to \'parse\' when schema validation enabled');

    this.server = server;
    this.method = settings.method.toLowerCase();
    this.path = settings.path;
    this.config = Utils.applyToDefaults(server.routeDefaults, settings.config || {});
    this.keys = [];                             // Request path parameter names

    Utils.assert(this.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(!!settings.handler ^ !!this.config.handler, 'Handler must appear once and only once');         // XOR
    this.config.handler = this.config.handler || settings.handler;

    // Authentication configuration

    this.config.auth = this.config.auth || {};
    this.config.auth.mode = this.config.auth.mode || (this.server.settings.authentication ? 'required' : 'none');
    Utils.assert(this.config.auth.mode === 'none' || this.server.settings.authentication, 'Route requires authentication but none configured');

    if (this.config.auth.mode !== 'none') {
        this.config.auth.scope = this.config.auth.scope || null;
        this.config.auth.tos = this.config.auth.tos || this.server.settings.authentication.tos.min;
        this.config.auth.entity = this.config.auth.entity || 'user';
    }

    // Cache

    Utils.assert(!this.config.cache || this.config.cache.mode === 'none' || this.method === 'get', 'Only GET routes can use a cache');
    this.cache = new Cache.Policy('route', this.config.cache, this.server.cache);

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

            var pre = (typeof this.config.pre[i] === 'function' ? { method: this.config.pre[i] } : this.config.pre[i]);
            pre.mode = pre.mode || 'serial';
            Utils.assert(pre.mode === 'serial' || pre.mode === 'parallel', 'Unknown prerequisite mode: ' + pre.mode);
            this.prerequisites.push(pre);
        }
    }

    // Parse path

    if (this.path instanceof RegExp) {
        this.regexp = this.path;
    }
    else {
        var convFunc = function (_, slash, format, key, capture, optional, star) {

            self.keys.push(key);
            slash = slash || '';
            return '' +
                   (optional ? '' : slash) +
                   '(?:' +
                   (optional ? slash : '') +
                   (format || '') +
                   (capture || (format && '([^/.]+?)' || '([^/]+?)')) +
                   ')' +
                   (optional || '') +
                   (star ? '(/*)?' : '');
        };

        var pathRx = this.path.concat(self.server.settings.router.isTrailingSlashSensitive ? '' : '/?')
            .replace(/\/\(/g, '(?:/')
            .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, convFunc)
            .replace(/([\/.])/g, '\\$1')
            .replace(/\*/g, '(.*)');

        this.regexp = new RegExp('^' + pathRx + '$', self.server.settings.router.isCaseSensitive ? '' : 'i');
    }

    return this;
};


Route.prototype.match = function (request) {

    var match = this.regexp.exec(request.path);

    if (!match) {
        return false;
    }

    request.params = {};

    if (this.keys.length > 0) {
        for (var i = 1, il = match.length; i < il; ++i) {
            var key = this.keys[i - 1];
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


Route.prototype.test = function (path) {

    var match = this.regexp.exec(path);
    return !!match;
};