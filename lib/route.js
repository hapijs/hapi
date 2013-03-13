// Load modules

var Boom = require('boom');
var Catbox = require('catbox');
var Auth = require('./auth');
var Files = require('./files');
var Proxy = require('./proxy');
var Schema = require('./schema');
var Utils = require('./utils');
var Views = require('./views');
var Request = require('./request');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, server, env) {

    var self = this;

    Utils.assert(this.constructor === internals.Route, 'Route must be instantiated using new');

    // Setup and validate route configuration

    Utils.assert(!!options.handler ^ !!(options.config && options.config.handler), 'Handler must appear once and only once');         // XOR

    this.settings = Utils.applyToDefaults(server.settings.router.routeDefaults, options.config || {});
    this.settings.handler = this.settings.handler || options.handler;

    Utils.assert((typeof this.settings.handler === 'function') ^ !!this.settings.handler.proxy ^ !!this.settings.handler.file ^ !!this.settings.handler.directory ^ !!this.settings.handler.view ^ (this.settings.handler === 'notFound'), 'Handler must be a function or equal notFound or be an object with a proxy, file, directory, or view');

    Schema.route(options, this.settings, function (err) {

        Utils.assert(!err, 'Route options are invalid: ' + err);
    });

    this.server = server;
    this.env = env || {};                                          // Plugin-specific environment
    this.method = options.method.toLowerCase();
    this.path = options.path;
    this.settings.method = this.method;                             // Expose method in settings

    Utils.assert(this.path.match(internals.Route.validatePathRegex), 'Invalid path: ' + this.path);
    Utils.assert(this.path.match(internals.Route.validatePathEncodedRegex) === null, 'Path cannot contain encoded non-reserved path characters');

    this.settings.plugins = this.settings.plugins || {};            // Route-specific plugins settings, namespaced using plugin name
    this.settings.app = this.settings.app || {};                    // Route-specific application settings

    // Payload configuration ('stream', 'raw', 'parse')
    // Default is 'parse' for POST and PUT otherwise 'stream'

    this.settings.validate = this.settings.validate || {};
    Utils.assert(!this.settings.validate.schema || !this.settings.payload || this.settings.payload === 'parse', 'Route payload must be set to \'parse\' when schema validation enabled');

    this.settings.payload = this.settings.payload ||
                            (this.settings.validate.schema || this.method === 'post' || this.method === 'put' ? 'parse' : 'stream');

    Utils.assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name');

    // Authentication configuration

    this.settings.auth = this.settings.auth || {};
    this.settings.auth.mode = this.settings.auth.mode || (server.auth ? 'required' : 'none');
    this.settings.auth.payload = this.settings.auth.payload || 'none';
    Utils.assert(['required', 'optional', 'try', 'none'].indexOf(this.settings.auth.mode) !== -1, 'Unknown authentication mode: ' + this.settings.auth.mode);

    if (this.settings.auth.mode !== 'none') {

        // Authentication enabled

        Utils.assert(server.auth, 'Route requires authentication but none configured');
        Utils.assert(!this.settings.auth.entity || ['user', 'app', 'any'].indexOf(this.settings.auth.entity) !== -1, 'Unknown authentication entity type: ' + this.settings.auth.entity);

        Utils.assert(!(this.settings.auth.strategy && this.settings.auth.strategies), 'Route can only have a auth.strategy or auth.strategies (or use the default) but not both');
        this.settings.auth.strategies = this.settings.auth.strategies || [this.settings.auth.strategy || 'default'];
        delete this.settings.auth.strategy;

        var hasAuthenticatePayload = false;
        this.settings.auth.strategies.forEach(function (strategy) {

            Utils.assert(server.auth.strategies[strategy], 'Unknown authentication strategy: ' + strategy);
            hasAuthenticatePayload = hasAuthenticatePayload || typeof server.auth.strategies[strategy].authenticatePayload === 'function';
            Utils.assert(self.settings.auth.payload !== 'required' || hasAuthenticatePayload, 'Payload validation can only be required when all strategies support it');
        });

        Utils.assert(this.settings.auth.payload === 'none' || hasAuthenticatePayload, 'Payload authentication requires at least one strategy with payload support');
    }
    else {
        // No authentication
        Utils.assert(Utils.matchKeys(this.settings.auth, ['strategy', 'strategies', 'entity', 'tos', 'scope']).length === 0, 'Route auth is off but auth is configured');
    }

    // Parse path

    this._generateRegex();      // Sets this.regexp, this.params, this.fingerprint

    // Cache

    Utils.assert(!this.settings.cache || this.settings.cache.mode === 'none' || this.method === 'get', 'Only GET routes can use a cache');
    if (this.settings.cache &&
        this.settings.cache.mode !== 'none') {

        this.settings.cache.segment = this.settings.cache.segment || this.fingerprint;
    }
    this.cache = new Catbox.Policy(this.settings.cache, this.server.cache);

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
        Utils.assert(pre.mode === 'serial' || pre.mode === 'parallel', 'Unknown prerequisite mode: ' + pre.mode);

        if (typeof pre.method === 'string') {
            var preMethodParts = pre.method.match(/^(\w+)(?:\s*)\((\s*\w+(?:\.\w+)*\s*(?:\,\s*\w+(?:\.\w+)*\s*)*)?\)$/);
            Utils.assert(preMethodParts, 'Invalid prerequisite string method syntax');
            var helper = preMethodParts[1];
            Utils.assert(preMethodParts && self.server.helpers[helper], 'Unknown server helper method in prerequisite string');
            pre.assign = pre.assign || helper;
            var helperArgs = preMethodParts[2].split(/\s*\,\s*/);

            pre.method = function (helper, helperArgs, request, next) {

                var args = [];
                helperArgs.forEach(function (arg) {

                    args.push(Utils.reach(request, arg));
                });

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

    return this;
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


internals.Route.prototype._generateRegex = function () {

    // Split on /

    var segments = this.path.split('/');
    var params = {};
    var pathRX = '';
    var fingers = [];

    var paramRegex = /^\{(\w+)(?:(\*)(\d+)?)?(\?)?\}$/;                             // $1: name, $2: *, $3: segments, $4: optional

    for (var i = 1, il = segments.length; i < il; ++i) {                            // Skip first empty segment
        var segment = segments[i];
        var param = segment.match(paramRegex);
        if (param) {

            // Parameter

            var name = param[1];
            var isMulti = !!param[2];
            var multiCount = param[3] && parseInt(param[3], 10);
            var isOptional = !!param[4];

            Utils.assert(!params[name], 'Cannot repeat the same parameter name');
            params[name] = true;

            var segmentRX = '\\/';
            if (isMulti) {
                if (multiCount) {
                    segmentRX += '((?:[^\\/]+)(?:\\/(?:[^\\/]+)){' + (multiCount - 1) + '})';
                }
                else {
                    segmentRX += '(.*)';
                }
            }
            else {
                segmentRX += '([^\\/]+)';
            }

            if (isOptional ||
                (isMulti && !multiCount)) {

                pathRX += '(?:(?:\\/)|(?:' + segmentRX + '))';
            }
            else {
                pathRX += segmentRX;
            }

            if (isMulti) {
                if (multiCount) {
                    for (var m = 0; m < multiCount; ++m) {
                        fingers.push('/?');
                    }
                }
                else {
                    fingers.push('/*');
                }
            }
            else {
                fingers.push('/?');
            }
        }
        else {

            // Literal

            if (segment) {
                pathRX += '\\/' + Utils.escapeRegex(segment);
                if (this.server.settings.router.isCaseSensitive) {
                    fingers.push('/' + segment);
                }
                else {
                    fingers.push('/' + segment.toLowerCase());
                }
            }
            else {
                pathRX += '\\/';
                fingers.push('/');
            }
        }
    }

    if (this.server.settings.router.isCaseSensitive) {
        this.regexp = new RegExp('^' + pathRX + '$');
    }
    else {
        this.regexp = new RegExp('^' + pathRX + '$', 'i');
    }

    this.fingerprint = fingers.join('');
    this._fingerprintParts = fingers;
    this.params = Object.keys(params);
};


internals.Route.prototype.match = function (request) {

    var match = this.regexp.exec(request.path);

    if (!match) {
        return false;
    }

    request.params = {};
    request._paramsArray = [];

    if (this.params.length > 0) {
        for (var i = 1, il = match.length; i < il; ++i) {
            var key = this.params[i - 1];
            if (key) {
                try {
                    request.params[key] = (typeof match[i] === 'string' ? decodeURIComponent(match[i]) : match[i]);
                    request._paramsArray.push(request.params[key]);
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


exports.sort = function (a, b) {

    // Biased for less and shorter segments which are faster to compare

    var aFirst = -1;
    var bFirst = 1;

    // Prepare fingerprints

    var aFingers = a._fingerprintParts;
    var bFingers = b._fingerprintParts;

    var al = aFingers.length;
    var bl = bFingers.length;

    // Comare fingerprints

    if ((aFingers[al - 1] === '/*') ^ (bFingers[bl - 1] === '/*')) {
        return (aFingers[al - 1] === '/*' ? bFirst : aFirst);
    }

    var size = Math.min(al, bl);
    for (var i = 0; i < size; ++i) {

        var aSegment = aFingers[i];
        var bSegment = bFingers[i];

        if (aSegment === bSegment) {
            continue;
        }

        if (aSegment === '/*' ||
            bSegment === '/*') {

            return (aSegment === '/*' ? bFirst : aFirst);
        }

        if (aSegment === '/?' ||
            bSegment === '/?') {

            if (aSegment === '/?') {
                return (al >= bl ? bFirst : aFirst);
            }
            else {
                return (bl < al ? bFirst : aFirst);
            }
        }

        if (al === bl) {
            if (aSegment.length === bSegment.length) {
                return (aSegment > bSegment ? bFirst : aFirst);
            }

            return (aSegment.length > bSegment.length ? bFirst : aFirst);
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
