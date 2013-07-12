// Load modules

var Boom = require('boom');
var Catbox = require('catbox');
var Files = require('./files');
var Proxy = require('./proxy');
var Schema = require('./schema');
var Utils = require('./utils');
var Views = require('./views');
var Request = require('./request');
var State = require('./state');
var Auth = require('./auth');
var Payload = require('./payload');
var Validation = require('./validation');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, server, env) {

    var self = this;

    Utils.assert(this.constructor === internals.Route, 'Route must be instantiated using new');

    // Setup and validate route configuration

    Utils.assert(!!options.handler ^ !!(options.config && options.config.handler), 'Handler must appear once and only once');         // XOR
    Utils.assert(options.path.match(internals.Route.validatePathRegex), 'Invalid path:', options.path);
    Utils.assert(options.path.match(internals.Route.validatePathEncodedRegex) === null, 'Path cannot contain encoded non-reserved path characters');

    this.settings = Utils.clone(options.config) || {};
    this.settings.handler = this.settings.handler || options.handler;

    Utils.assert((typeof this.settings.handler === 'function') ^ !!this.settings.handler.proxy ^ !!this.settings.handler.file ^ !!this.settings.handler.directory ^ !!this.settings.handler.view ^ (this.settings.handler === 'notFound'), 'Handler must be a function or equal notFound or be an object with a proxy, file, directory, or view');

    var schemaError = Schema.routeOptions(options);
    Utils.assert(!schemaError, 'Invalid route options for', options.path, ':', schemaError);

    schemaError = Schema.routeConfig(this.settings);
    Utils.assert(!schemaError, 'Invalid route config for', options.path, ':', schemaError);

    this.server = server;
    this.env = env || {};                                           // Plugin-specific environment
    this.method = options.method.toLowerCase();
    this.settings.method = this.method;                             // Expose method in settings
    this.settings.path = options.path;                              // Expose path in settings
    this.settings.plugins = this.settings.plugins || {};            // Route-specific plugins settings, namespaced using plugin name
    this.settings.app = this.settings.app || {};                    // Route-specific application settings

    // Path parsing

    this._parsePath();                                              // Sets this.path, this.params, this.fingerprint, this._segments

    // Payload parsing

    this.settings.validate = this.settings.validate || {};

    if (!this.settings.payload ||
        typeof this.settings.payload !== 'object') {

        this.settings.payload = { mode: this.settings.payload };
    }

    if (!this.settings.payload.mode &&
        this.settings.method !== '*') {

        this.settings.payload.mode = (this.settings.validate.payload || ['post', 'put', 'patch'].indexOf(this.settings.method) !== -1 ? 'parse' : 'stream');
    }

    Utils.assert(!this.settings.validate.payload || !this.settings.payload.mode || this.settings.payload.mode === 'parse', 'Route payload must be set to \'parse\' when payload validation enabled');
    Utils.assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name');

    // Authentication configuration

    this.settings.auth = this.server._auth.setupRoute(this.settings.auth);

    // Cache

    if (this.settings.cache) {
        Utils.assert(this.method === 'get', 'Only GET routes can use a cache');

        this.settings.cache.mode = (this.settings.cache.mode || 'client').split('+');
        var modes = {};
        this.settings.cache.mode.forEach(function (mode) {

            Utils.assert(mode === 'client' || mode === 'server', 'Unknown cache mode:', mode);
            modes[mode] = true;
        });

        this.settings.cache.mode = modes;
        Utils.assert(!this.settings.cache.segment || this.settings.cache.mode.server, 'Cannot set cache segment without server-side caching');
        Utils.assert(!this.settings.cache.privacy || this.settings.cache.mode.client, 'Cannot set cache privacy setting without client-side caching');
        this.settings.cache.privacy = this.settings.cache.privacy || 'default';
        this.cache = (this.settings.cache.mode.server ? this.server.pack._provisionCache(this.settings.cache, 'route', this.fingerprint, this.settings.cache.segment) :
                                                        new Catbox.Policy(this.settings.cache));
    }
    else {
        this.settings.cache = { mode: {} };
        this.cache = new Catbox.Policy();
    }

    // Prerequisites

    /*
        [
            function (request, next) { },
            {
                method: function (request, next) { }
                assign: key1
            },
            {
                method: function (request, next) { },
                assign: key2,
                mode: parallel
            },
            'user(params.id)'
        ]
    */

    this.prerequisites = {
        parallel: [],
        serial: []
    };

    (this.settings.pre || []).forEach(function (pre) {

        if (typeof pre !== 'object') {
            pre = { method: pre };
        }

        Utils.assert(pre.method, 'Prerequisite config missing method');
        Utils.assert(typeof pre.method === 'function' || typeof pre.method === 'string', 'Prerequisite method must be a function or helper name');

        pre.mode = pre.mode || 'serial';
        Utils.assert(pre.mode === 'serial' || pre.mode === 'parallel', 'Unknown prerequisite mode:', pre.mode);

        if (typeof pre.method === 'string') {
            var preMethodParts = pre.method.match(/^(\w+)(?:\s*)\((\s*\w+(?:\.\w+)*\s*(?:\,\s*\w+(?:\.\w+)*\s*)*)?\)$/);
            Utils.assert(preMethodParts, 'Invalid prerequisite string method syntax');
            var helper = preMethodParts[1];
            Utils.assert(preMethodParts && self.server.helpers[helper], 'Unknown server helper method in prerequisite string');
            pre.assign = pre.assign || helper;
            var helperArgs = preMethodParts[2].split(/\s*\,\s*/);

            pre.method = function (helper, helperArgs, request, next) {

                var args = [];
                for (var i = 0, il = helperArgs.length; i < il; ++i) {
                    var arg = helperArgs[i];
                    args.push(Utils.reach(request, arg));
                }

                args.push(next);
                request.server.helpers[helper].apply(null, args);
            }.bind(null, helper, helperArgs);
        }

        self.prerequisites[pre.mode].push(Request.bindPre(pre));
    });

    // Object handler

    if (typeof this.settings.handler === 'object') {

        Utils.assert(!!this.settings.handler.proxy ^ !!this.settings.handler.file ^ !!this.settings.handler.directory ^ !!this.settings.handler.view, 'Object handler must include one and only one of proxy, file, directory or view');

        if (this.settings.handler.proxy) {
            this.proxy = new Proxy(this.settings.handler.proxy, this);
            this.settings.handler = this.proxy.handler();
        }
        else if (this.settings.handler.file) {
            this.settings.handler = Files.fileHandler(this, this.settings.handler.file);
        }
        else if (this.settings.handler.directory) {
            this.settings.handler = Files.directoryHandler(this, this.settings.handler.directory);
        }
        else if (this.settings.handler.view) {
            this.settings.handler = Views.handler(this, this.settings.handler.view);
        }
    }
    else if (this.settings.handler === 'notFound') {
        this.settings.handler = internals.notFound();
    }

    // Route lifecycle

    this.cycle = this.lifecycle();
};


internals.Route.prototype.lifecycle = function () {

    var self = this;

    var cycle = [];

    // Lifecycle flags

    var parsePayload = (!this.settings.payload.mode || (this.method !== 'get' && this.method !== 'head' && this.settings.payload.mode !== 'stream'));
    var authenticate = (this.settings.auth !== false);                          // Anything other than 'false' can still require authentication

    var validate = function (type) {

        // null, undefined, true - anything allowed
        // false, {} - nothing allowed
        // {...} - ... allowed

        return self.settings.validate[type] !== null &&
               self.settings.validate[type] !== undefined &&
               self.settings.validate[type] !== true;
    };

    // 'onRequest'

    if (this.server.settings.state.cookies.parse) {
        cycle.push(State.parseCookies);
    }

    cycle.push('onPreAuth');

    if (authenticate) {
        cycle.push(Auth.authenticate);
    }

    if (parsePayload) {
        cycle.push(Payload.read);
        if (authenticate) {
            cycle.push(Auth.authenticatePayload);
        }
    }

    cycle.push('onPostAuth');

    if (validate('path')) {
        cycle.push(Validation.path);
    }

    if (this.settings.jsonp) {
        cycle.push(Request.parseJSONP);
    }

    if (validate('query')) {
        cycle.push(Validation.query);
    }

    if (parsePayload &&
        validate('payload')) {

        cycle.push(Validation.payload);
    }

    cycle.push('onPreHandler');
    cycle.push(Request.handler);                                     // Must not call next() with an Error
    cycle.push('onPostHandler');                                     // An error from here on will override any result set in handler()

    if (validate('response') &&
        this.settings.validate.response.sample !== 0 &&
        this.settings.validate.response.sample !== false) {

        cycle.push(Validation.response);
    }

    // 'onPreResponse'

    return cycle;
};


/*
    /path/{param}/path/{param?}
    /path/{param*2}/path
    /path/{param*2}
    /{param*}
*/

//                                   |--/-| |------------------------------------------/segment/segment/.../{param?}----------------------------------------------|
//                                   .    . . |-------------------------------/segments-----------------------------------||-------/optional-param--------------| .
//                                   .    . . .  |---------------------------segment-content----------------------------| ..  |--------{param*|?}-------------| . .
//                                   .    . . .  .|----------------path-characters--------------|                       . ..        |------decorators-----|   . . .
//                                   .    . . .  ..|-------legal-characters------| |--%encode-| . |-------{param}------|. ..         |-----*n------| |?-|     . . .
internals.Route.validatePathRegex = /(^\/$)|(^(\/(([\w\!\$&'\(\)\*\+\,;\=\:@\-\.~]|%[A-F0-9]{2})+|(\{\w+(\*[1-9]\d*)?\})))*(\/(\{\w+((\*([1-9]\d*)?)|(\?))?\})?)?$)/;
//                                   a    a b c  de          f f                               e  g     h          h   gdc i  j     kl  m        m l n  nk   j i  b


internals.Route.validatePathEncodedRegex = /%(?:2[146-9A-E]|3[\dABD]|4[\dA-F]|5[\dAF]|6[1-9A-F]|7[\dAE])/g;


internals.Route.prototype._parsePath = function () {

    this._segments = [];

    // Split on /

    var path = '';
    var segments = this.settings.path.split('/');
    var params = {};
    var fingers = [];

    var paramRegex = /^\{(\w+)(?:(\*)(\d+)?)?(\?)?\}$/;                             // $1: name, $2: *, $3: segments, $4: empty-ok

    for (var i = 1, il = segments.length; i < il; ++i) {                            // Skip first empty segment
        var segment = segments[i];
        var param = segment.match(paramRegex);
        if (param) {

            // Parameter

            path += '/' + segment;
            var name = param[1];
            var isMulti = !!param[2];
            var multiCount = param[3] && parseInt(param[3], 10);
            var isEmptyOk = !!param[4];

            Utils.assert(!params[name], 'Cannot repeat the same parameter name');
            params[name] = true;

            if (isMulti) {
                if (multiCount) {
                    for (var m = 0; m < multiCount; ++m) {
                        fingers.push('?');
                        this._segments.push({ name: name, count: multiCount });
                    }
                }
                else {
                    fingers.push('#');
                    this._segments.push({ isWildcard: true, name: name });
                }
            }
            else {
                fingers.push('?');
                this._segments.push({ name: name, isEmptyOk: isEmptyOk });
            }
        }
        else {

            // Literal

            if (segment) {
                segment = this.server.settings.router.isCaseSensitive ? segment : segment.toLowerCase();
                path += '/' + segment;
                fingers.push(segment);
                this._segments.push({ literal: segment });
            }
            else {
                path += '/';
                fingers.push('');
                this._segments.push({ literal: '' });
            }
        }
    }

    this.path = path;
    this.fingerprint = '/' + fingers.join('/');
    this.params = Object.keys(params);
};


internals.Route.prototype.match = function (request) {

    var params = {};
    var paramsArray = [];

    var match = this._test(request.path, params, paramsArray);
    if (match) {
        request.params = params;
        request._paramsArray = paramsArray;
    }

    return match;
};


internals.setParam = function (name, value, params, paramsArray, isEmptyOk) {

    var isValid = (isEmptyOk || value);

    if (isValid &&
        value &&
        params) {

        var decoded = internals.decodeURIComponent(value);
        if (decoded === null) {
            isValid = false;
        }
        else {
            params[name] = decoded;
            paramsArray.push(decoded);
        }
    }

    return isValid;
};


internals.decodeURIComponent = function (value) {

    try {
        return decodeURIComponent(value);
    }
    catch (err) {
        return null;
    }
};


internals.Route.prototype._test = function (path, params, paramsArray) {

    var match = true;

    if (!this.params.length) {

        // Literal path

        match = (this.path === (this.server.settings.router.isCaseSensitive ? path : path.toLowerCase()));
    }
    else {

        // Parameterized path

        var paths = path.split('/');
        var pl = paths.length - 1;
        var sl = this._segments.length;
        var lastSegment = this._segments[sl - 1];

        if (pl === sl ||
            (pl === sl - 1 && (lastSegment.isEmptyOk || lastSegment.isWildcard)) ||
            (pl >= sl && lastSegment.isWildcard)) {

            for (var i = 0; match && i < sl; ++i) {
                var segment = this._segments[i];
                if (segment.isWildcard) {
                    match = internals.setParam(segment.name, paths.slice(i + 1).join('/'), params, paramsArray, true);
                }
                else if (segment.count) {
                    match = internals.setParam(segment.name, paths.slice(i + 1, i + 1 + segment.count).join('/'), params, paramsArray);
                    i += (segment.count - 1);
                }
                else if (segment.name) {
                    match = internals.setParam(segment.name, paths[i + 1], params, paramsArray, segment.isEmptyOk);
                }
                else {
                    match = (segment.literal === (this.server.settings.router.isCaseSensitive ? paths[i + 1] : paths[i + 1].toLowerCase()));
                }
            }
        }
        else {
            match = false;
        }
    }

    return match;
};


internals.Route.prototype.test = function (path) {

    return this._test(path, null, null);
};


exports.sort = function (a, b) {

    // Biased for less and shorter segments which are faster to compare

    var aFirst = -1;
    var bFirst = 1;

    // Prepare fingerprints

    var aFingers = a._segments;
    var bFingers = b._segments;

    var al = aFingers.length;
    var bl = bFingers.length;

    // Compare fingerprints

    if ((aFingers[al - 1].isWildcard) ^ (bFingers[bl - 1].isWildcard)) {
        return (aFingers[al - 1].isWildcard ? bFirst : aFirst);
    }

    var size = Math.min(al, bl);
    for (var i = 0; i < size; ++i) {

        var aSegment = aFingers[i];
        var bSegment = bFingers[i];

        if ((aSegment.isWildcard && bSegment.isWildcard) ||
            (aSegment.name && bSegment.name) ||
            (aSegment.literal == bSegment.literal)) {

            continue;
        }

        if (aSegment.isWildcard ||
            bSegment.isWildcard) {

            return (aSegment.isWildcard ? bFirst : aFirst);
        }

        if (aSegment.name ||
            bSegment.name) {

            if (aSegment.name) {
                return (al >= bl ? bFirst : aFirst);
            }
            else {
                return (bl < al ? bFirst : aFirst);
            }
        }

        if (al === bl) {
            if (aSegment.literal.length === bSegment.literal.length) {
                return (aSegment.literal > bSegment.literal ? bFirst : aFirst);
            }

            return (aSegment.literal.length > bSegment.literal.length ? bFirst : aFirst);
        }

        return (al > bl ? bFirst : aFirst);
    }

    return (al > bl ? bFirst : aFirst);
};


internals.notFound = function () {

    return function (request) {

        return request.reply(Boom.notFound());
    };
};