// Load modules

var Boom = require('boom');
var Catbox = require('catbox');
var Auth = require('./auth');
var Files = require('./files');
var Proxy = require('./proxy');
var Utils = require('./utils');
var Views = require('./views');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, server) {

    var self = this;

    // Setup and validate route configuration

    var settings = Utils.clone(options);        // Options can be reused

    Utils.assert(this.constructor === internals.Route, 'Route must be instantiated using new');
    Utils.assert(settings.path, 'Route options missing path');
    Utils.assert(settings.path.match(internals.Route.validatePathRegex), 'Invalid path: ' + settings.path);
    Utils.assert(settings.path.match(internals.Route.validatePathEncodedRegex) === null, 'Path cannot contain encoded non-reserved path characters');
    Utils.assert(settings.method, 'Route options missing method');

    this.server = server;
    this.method = settings.method.toLowerCase();
    this.path = settings.path;
    this.config = Utils.applyToDefaults(server.settings.router.routeDefaults, settings.config || {});
    this.config.method = this.method;                           // Expose method in config

    this.config.plugins = this.config.plugins || {};            // Route-specific plugins config, namespaced using plugin name
    this.config.app = this.config.app || {};                    // Route-specific application config

    Utils.assert(this.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(!!settings.handler ^ !!this.config.handler, 'Handler must appear once and only once');         // XOR
    this.config.handler = this.config.handler || settings.handler;

    Utils.assert((typeof this.config.handler === 'function') ^ !!this.config.handler.proxy ^ !!this.config.handler.file ^ !!this.config.handler.directory ^ !!this.config.handler.view ^ (this.config.handler === 'notFound'), 'Handler must be a function or equal notFound or be an object with a proxy, file, directory, or view');

    // Payload configuration ('stream', 'raw', 'parse')
    // Default is 'parse' for POST and PUT otherwise 'stream'

    this.config.validate = this.config.validate || {};
    Utils.assert(!this.config.validate.schema || !this.config.payload || this.config.payload === 'parse', 'Route payload must be set to \'parse\' when schema validation enabled');

    this.config.payload = this.config.payload ||
                          (this.config.validate.schema || this.method === 'post' || this.method === 'put' ? 'parse' : 'stream');
    Utils.assert(['stream', 'raw', 'parse'].indexOf(this.config.payload) !== -1, 'Unknown route payload mode: ' + this.config.payload);

    // Authentication configuration

    this.config.auth = this.config.auth || {};
    this.config.auth.mode = this.config.auth.mode || (server.auth ? 'required' : 'none');
    this.config.auth.payload = this.config.auth.payload || 'none';
    Utils.assert(['required', 'optional', 'try', 'none'].indexOf(this.config.auth.mode) !== -1, 'Unknown authentication mode: ' + this.config.auth.mode);

    if (this.config.auth.mode !== 'none') {

        // Authentication enabled

        Utils.assert(server.auth, 'Route requires authentication but none configured');
        Utils.assert(!this.config.auth.entity || ['user', 'app', 'any'].indexOf(this.config.auth.entity) !== -1, 'Unknown authentication entity type: ' + this.config.auth.entity);

        Utils.assert(!(this.config.auth.strategy && this.config.auth.strategies), 'Route can only have a auth.strategy or auth.strategies (or use the default) but not both');
        this.config.auth.strategies = this.config.auth.strategies || [this.config.auth.strategy || 'default'];
        delete this.config.auth.strategy;
        var hasValidatePayload = false;

        this.config.auth.strategies.forEach(function (strategy) {

            Utils.assert(server.auth.strategies[strategy], 'Unknown authentication strategy: ' + strategy);
            hasValidatePayload = hasValidatePayload || typeof server.auth.strategies[strategy].validatePayload === 'function';
            Utils.assert(self.config.auth.payload !== 'required' || hasValidatePayload, 'Payload validation can only be required when all strategies support it');
        });

        Utils.assert(this.config.auth.payload === 'none' || hasValidatePayload, 'Payload validation can only be configured for strategies that support it');
    }
    else {
        // No authentication
        Utils.assert(Utils.matchKeys(this.config.auth, ['strategy', 'strategies', 'entity', 'tos', 'scope']).length === 0, 'Route auth is off but auth is configured');
    }

    // Parse path

    this._generateRegex();      // Sets this.regexp, this.params, this.fingerprint

    // Cache

    Utils.assert(!this.config.cache || this.config.cache.mode === 'none' || this.method === 'get', 'Only GET routes can use a cache');
    if (this.config.cache &&
        this.config.cache.mode !== 'none') {

        this.config.cache.segment = this.config.cache.segment || this.fingerprint;
    }
    this.cache = new Catbox.Policy(this.config.cache, this.server.cache);

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

    this.prerequisites = [];
    if (this.config.pre) {
        for (var i = 0, il = this.config.pre.length; i < il; ++i) {

            var pre = (typeof this.config.pre[i] === 'object' ? this.config.pre[i] : { method: this.config.pre[i] });
            Utils.assert(pre.method, 'Prerequisite config missing method');
            Utils.assert(typeof pre.method === 'function' || typeof pre.method === 'string', 'Prerequisite method must be a function or helper name');

            pre.mode = pre.mode || 'serial';
            Utils.assert(pre.mode === 'serial' || pre.mode === 'parallel', 'Unknown prerequisite mode: ' + pre.mode);

            if (typeof pre.method === 'string') {
                var preMethodParts = pre.method.match(/^(\w+)(?:\s*)\((\s*\w+(?:\.\w+)*\s*(?:\,\s*\w+(?:\.\w+)*\s*)*)?\)$/);
                Utils.assert(preMethodParts, 'Invalid prerequisite string method syntax');
                var helper = preMethodParts[1];
                Utils.assert(preMethodParts && this.server.helpers[helper], 'Unknown server helper method in prerequisite string');
                pre.assign = pre.assign || helper;
                var helperArgs = preMethodParts[2].split(/\s*\,\s*/);

                pre.method = function (request, next) {

                    var args = [];
                    helperArgs.forEach(function (arg) {

                        args.push(Utils.reach(request, arg));
                    });

                    args.push(next);
                    request.server.helpers[helper].apply(null, args);
                };
            }

            this.prerequisites.push(pre);
        }
    }

    // Object handler

    if (typeof this.config.handler === 'object') {

        Utils.assert(!!this.config.handler.proxy ^ !!this.config.handler.file ^ !!this.config.handler.directory ^ !!this.config.handler.view, 'Object handler must include one and only one of proxy, file, directory or view');

        if (this.config.handler.proxy) {
            this.proxy = new Proxy(this.config.handler.proxy, this);
            this.config.handler = this.proxy.handler();
        }
        else if (this.config.handler.file) {
            this.config.handler = Files.fileHandler(this, this.config.handler.file);
        }
        else if (this.config.handler.directory) {
            this.config.handler = Files.directoryHandler(this, this.config.handler.directory);
        }
        else if (this.config.handler.view) {
            this.config.handler = Views.handler(this, this.config.handler.view);
        }
    }
    else if (this.config.handler === 'notFound') {
        this.config.handler = internals.notFound();
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

