// Load modules

var Cache = require('./cache');
var Utils = require('./utils');
var Proxy = require('./proxy');
var File = require('./file');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, server) {

    var self = this;

    // Setup and validate route configuration

    var settings = Utils.clone(options);        // Options can be reused

    Utils.assert(this.constructor === internals.Route, 'Route must be instantiated using new');
    Utils.assert(settings.path, 'Route options missing path');
    Utils.assert(settings.path.match(internals.Route.validatePathRegex), 'Invalid path: ' + settings.path);
    Utils.assert(settings.method, 'Route options missing method');

    this.server = server;
    this.method = settings.method.toLowerCase();
    this.path = settings.path;
    this.config = Utils.applyToDefaults(server.routeDefaults, settings.config || {});

    Utils.assert(this.method !== 'head', 'Cannot add a HEAD route');
    Utils.assert(!!settings.handler ^ !!this.config.handler, 'Handler must appear once and only once');         // XOR
    this.config.handler = this.config.handler || settings.handler;

    Utils.assert((typeof this.config.handler === 'function') ^ !!this.config.handler.proxy ^ !!this.config.handler.file, 'Handler must be a function or an object with a proxy or an object with a file');

    // Payload configuration ('stream', 'raw', 'parse')
    // Default is 'parse' for POST and PUT otherwise 'stream'

    this.config.validate = this.config.validate || {};
    Utils.assert(!this.config.validate.schema || !this.config.payload || this.config.payload === 'parse', 'Route payload must be set to \'parse\' when schema validation enabled');

    this.config.payload = this.config.payload ||
                          (this.config.validate.schema || this.method === 'post' || this.method === 'put' ? 'parse' : 'stream');
    Utils.assert(['stream', 'raw', 'parse'].indexOf(this.config.payload) !== -1, 'Unknown route payload mode: ' + this.config.payload);

    // Authentication configuration

    this.config.auth = this.config.auth || {};
    this.config.auth.mode = this.config.auth.mode || (this.server.settings.auth ? 'required' : 'none');
    Utils.assert(['required', 'optional', 'none'].indexOf(this.config.auth.mode) !== -1, 'Unknown authentication mode: ' + this.config.auth.mode);
    Utils.assert(this.config.auth.mode === 'none' || this.server.settings.auth, 'Route requires authentication but none configured');
    Utils.assert(this.config.auth.mode === 'none' || !this.config.auth.entity || ['user', 'app', 'any'].indexOf(this.config.auth.entity) !== -1, 'Unknown authentication entity type: ' + this.config.auth.entity);

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

    // Proxy & File configuration

    if ((typeof this.config.handler === 'object') && !!this.config.handler.proxy) {
        this.proxy = new Proxy(this.config.handler.proxy, this);
        this.config.handler = this.proxy.handler();
    }
    else if ((typeof this.config.handler === 'object') && !!this.config.handler.file) {
        this.file = new File(this.config.handler.file);
        this.config.handler = this.file.handler();
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


internals.Route.prototype._generateRegex = function () {

    var trailingSlashOptional = !this.server.settings.router.isTrailingSlashSensitive;

    // Split on /

    var segments = this.path.split('/');
    var params = {};
    var pathRX = '';
    var fingerprint = '';

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
                    segmentRX += '((?:[^\\/]+)(?:\\/(?:[^\\/]+))*)';
                }
            }
            else {
                segmentRX += '([^\\/]+)';
            }

            if (isOptional ||
                (isMulti && !multiCount)) {

                if (trailingSlashOptional) {
                    pathRX += '(?:(?:\\/)|(?:' + segmentRX + '))?'
                }
                else {
                    pathRX += '(?:(?:\\/)|(?:' + segmentRX + '))';
                }
            }
            else {
                pathRX += segmentRX;
            }

            if (isMulti) {
                if (multiCount) {
                    for (var m = 0; m < multiCount; ++m) {
                        fingerprint += '/?';
                    }
                }
                else {
                    fingerprint += '/?*';
                }
            }
            else {
                fingerprint += '/?';
            }
        }
        else {

            // Literal

            if (segment) {
                pathRX += '\\/' + Utils.escapeRegex(segment);
                fingerprint += '/' + segment;
            }
            else {
                pathRX += '\\/';
                if (trailingSlashOptional) {
                    pathRX += '?';
                }

                fingerprint += '/';
            }
        }
    }

    if (this.server.settings.router.isCaseSensitive) {
        this.regexp = new RegExp('^' + pathRX + '$');
    }
    else {
        this.regexp = new RegExp('^' + pathRX + '$', 'i');
    }

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