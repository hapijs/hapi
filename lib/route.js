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
var Handler = require('./handler');


// Declare internals

var internals = {};


exports = module.exports = internals.Route = function (options, server, env) {

    var self = this;

    // Setup and validate route configuration

    Utils.assert(options.handler || (options.config && options.config.handler), 'Missing or undefined handler:', options.path);
    Utils.assert(!!options.handler ^ !!(options.config && options.config.handler), 'Handler must only appear once:', options.path);            // XOR
    Utils.assert(options.path.match(internals.Route.pathRegex.validatePath), 'Invalid path:', options.path);
    Utils.assert(options.path.match(internals.Route.pathRegex.validatePathEncoded) === null, 'Path cannot contain encoded non-reserved path characters:', options.path);

    this.settings = Utils.clone(options.config) || {};
    this.settings.handler = this.settings.handler || options.handler;

    Utils.assert((typeof this.settings.handler === 'function') ^ !!this.settings.handler.proxy ^ !!this.settings.handler.file ^ !!this.settings.handler.directory ^ !!this.settings.handler.view ^ (this.settings.handler === 'notFound'), 'Handler must be a function or equal notFound or be an object with a proxy, file, directory, or view:', options.path);
    Utils.assert(!this.settings.bind || typeof this.settings.handler === 'function', 'Cannot set route bind when handler is not a function:', options.path);

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

    this.settings.payload.maxBytes = this.settings.payload.maxBytes || this.server.settings.payload.maxBytes;

    if (this.settings.payload.multipart) {
        if (typeof this.settings.payload.multipart === 'string') {
            this.settings.payload.multipart = { mode: this.settings.payload.multipart };
        }

        if (this.server.settings.payload.multipart) {
            this.settings.payload.multipart = Utils.applyToDefaults(this.server.settings.payload.multipart, this.settings.payload.multipart);
        }
    }
    else {
        this.settings.payload.multipart = this.server.settings.payload.multipart;
    }

    Utils.assert(!this.settings.validate.payload || !this.settings.payload.mode || this.settings.payload.mode === 'parse', 'Route payload must be set to \'parse\' when payload validation enabled:', options.path);
    Utils.assert(!this.settings.jsonp || typeof this.settings.jsonp === 'string', 'Bad route JSONP parameter name:', options.path);

    // Authentication configuration

    this.settings.auth = this.server._auth.setupRoute(this.settings.auth);

    // Cache

    if (this.settings.cache) {
        Utils.assert(this.method === 'get', 'Only GET routes can use a cache:', options.path);

        this.settings.cache.mode = (this.settings.cache.mode || 'client').split('+');
        var modes = {};
        this.settings.cache.mode.forEach(function (mode) {

            Utils.assert(mode === 'client' || mode === 'server', 'Unknown cache mode:', mode, 'in:', options.path);
            modes[mode] = true;
        });

        this.settings.cache.mode = modes;
        Utils.assert(!this.settings.cache.segment || this.settings.cache.mode.server, 'Cannot set cache segment without server-side caching:', options.path);
        Utils.assert(!this.settings.cache.privacy || this.settings.cache.mode.client, 'Cannot set cache privacy setting without client-side caching:', options.path);
        this.settings.cache.privacy = this.settings.cache.privacy || 'default';
        this.cache = (this.settings.cache.mode.server ? this.server.pack._provisionCache(this.settings.cache, 'route', this.fingerprint, this.settings.cache.segment) :
                                                        new Catbox.Policy(this.settings.cache.expiresIn || this.settings.cache.expiresAt ? { expiresIn: this.settings.cache.expiresIn, expiresAt: this.settings.cache.expiresAt, staleIn: this.settings.cache.staleIn, staleTimeout: this.settings.cache.staleTimeout } : {}));
    }
    else {
        this.settings.cache = { mode: {} };
        this.cache = new Catbox.Policy();
    }

    // Prerequisites

    this.prerequisites = Handler.prerequisites(this.settings.pre, server);

    // Object handler

    if (typeof this.settings.handler === 'object') {
        if (this.settings.handler.proxy) {
            this.proxy = this.settings.handler.proxy;
            this.settings.handler = Proxy.handler(this.settings.handler.proxy, this);
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

    var validate = function (type, root) {

        // null, undefined, true - anything allowed
        // false, {} - nothing allowed
        // {...} - ... allowed

        root = root || self.settings.validate;
        return root[type] !== null &&
               root[type] !== undefined &&
               root[type] !== true;
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
    cycle.push(Handler.execute);                                     // Must not call next() with an Error
    cycle.push('onPostHandler');                                     // An error from here on will override any result set in handler()

    if (validate('response', this.settings) &&
        this.settings.response.sample !== 0 &&
        this.settings.response.sample !== false) {

        cycle.push(Validation.response);
    }

    // 'onPreResponse'

    return cycle;
};


internals.pathRegex = function () {

    /*
        /path/{param}/path/{param?}
        /path/{param*2}/path
        /path/{param*2}
        /path/x{param}x
        /{param*}
    */

    var empty = '(^\\/$)';

    var legalChars = '[\\w\\!\\$&\'\\(\\)\\*\\+\\,;\\=\\:@\\-\\.~]';
    var encoded = '%[A-F0-9]{2}';

    var literalChar = '(?:' + legalChars + '|' + encoded + ')';
    var literal = literalChar + '+';
    var literalOptional = literalChar + '*';

    var midParam = '(\\{\\w+(\\*[1-9]\\d*)?\\})';                                   // {p}, {p*2}
    var endParam = '(\\/(\\{\\w+((\\*([1-9]\\d*)?)|(\\?))?\\})?)?';                 // {p}, {p*2}, {p*}, {p?}
    var mixParam = '(\\{\\w+\\??\\})';                                              // {p}, {p?}

    var literalParam = '(' + literal + mixParam + literalOptional + ')|(' + literalOptional + mixParam + literal + ')';

    var segmentContent = '(' + literal + '|' + midParam + '|' + literalParam + ')';
    var segment = '\\/' + segmentContent;
    var segments = '(' + segment + ')*';

    var path = '(^' + segments + endParam + '$)';

    var parseParam = '^(' + literalOptional + ')' + '\\{(\\w+)(?:(\\*)(\\d+)?)?(\\?)?\\}' + '(' + literalOptional + ')$';

    var expressions = {
        parseParam: new RegExp(parseParam),                                        // $1: literal-pre, $2: name, $3: *, $4: segments, $5: empty-ok, $6: literal-post
        validatePath: new RegExp(empty + '|' + path),
        validatePathEncoded: /%(?:2[146-9A-E]|3[\dABD]|4[\dA-F]|5[\dAF]|6[1-9A-F]|7[\dAE])/g
    };

    return expressions;
};


internals.Route.pathRegex = internals.pathRegex();


internals.Route.prototype._parsePath = function () {

    this._segments = [];

    // Split on /

    var path = '';
    var segments = this.settings.path.split('/');
    var params = {};
    var fingers = [];

    for (var i = 1, il = segments.length; i < il; ++i) {                            // Skip first empty segment
        var segment = segments[i];
        var param = segment.match(internals.Route.pathRegex.parseParam);
        if (param) {

            // Parameter

            path += '/' + segment;
            var pre = param[1];
            var name = param[2];
            var isMulti = !!param[3];
            var multiCount = param[4] && parseInt(param[4], 10);
            var isEmptyOk = !!param[5];
            var post = param[6];

            Utils.assert(!params[name], 'Cannot repeat the same parameter name:', name, 'in:', this.settings.path);
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
                fingers.push(pre + '?' + post);
                var segmentMeta = {
                    name: name,
                    isEmptyOk: isEmptyOk
                };

                if (pre || post) {
                    segmentMeta.mixed = true;
                    segmentMeta.pre = pre;
                    segmentMeta.post = post;
                    segmentMeta.extract = new RegExp('^' + Utils.escapeRegex(pre) + '(.' + (isEmptyOk ? '*' : '+') + ')' + Utils.escapeRegex(post) + '$');
                }

                this._segments.push(segmentMeta);
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
        params) {

        var decoded = internals.decodeURIComponent(value || '');
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
                    if (segment.extract) {
                        var partial = paths[i + 1].match(segment.extract);
                        if (!partial) {
                            match = false;
                        }
                        else {
                            match = internals.setParam(segment.name, partial[1], params, paramsArray, segment.isEmptyOk);
                        }
                    }
                    else {
                        match = internals.setParam(segment.name, paths[i + 1], params, paramsArray, segment.isEmptyOk);
                    }
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

        // Equal

        if ((aSegment.isWildcard && bSegment.isWildcard) ||
            (aSegment.name && bSegment.name && !aSegment.isWildcard && !bSegment.isWildcard && !aSegment.mixed && !bSegment.mixed) ||
            (aSegment.literal !== undefined && aSegment.literal === bSegment.literal)) {

            continue;
        }

        // One is wildcard

        if (aSegment.isWildcard) {
            return bFirst;
        }
        else if (bSegment.isWildcard) {
            return aFirst;
        }

        // One is parameter -or- both and at least one is mixed

        if (aSegment.name) {
            if (bSegment.name &&
                al === bl) {

                var mixed = internals.compareMixed(aSegment, bSegment);
                if (mixed === 0) {
                    continue;
                }

                return mixed;
            }
            else {
                return (al >= bl ? bFirst : aFirst);        // Bias to literal over parameter
            }
        }
        else if (bSegment.name) {
            break;
        }

        // Both literal but different

        if (al === bl) {
            if (aSegment.literal.length === bSegment.literal.length) {
                return (aSegment.literal > bSegment.literal ? bFirst : aFirst);
            }

            return (aSegment.literal.length > bSegment.literal.length ? bFirst : aFirst);
        }

        // Less segments win

        break;
    }

    return (al > bl ? bFirst : aFirst);
};


internals.compareMixed = function (aSegment, bSegment, p) {

    p = p || 0;
    if (p === 3) {
        return 0;
    }

    var aFirst = -1;
    var bFirst = 1;

    var prop = ['mixed', 'pre', 'post'][p];
    var ap = aSegment[prop];
    var bp = bSegment[prop];

    if (ap === bp) {
        return internals.compareMixed(aSegment, bSegment, p + 1);
    }
    else {
        if (ap) {
            if (bp) {
                if (ap.length === bp.length) {
                    return (ap > bp ? bFirst : aFirst);
                }
                else {
                    return (ap.length > bp.length ? aFirst : bFirst);
                }
            }
            else {
                return aFirst;
            }
        }
        else {
            return bFirst;
        }
    }
};


internals.notFound = function () {

    return function (request, reply) {

        return reply(Boom.notFound());
    };
};