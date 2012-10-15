// Load modules

var Utils = require('../utils');
var Log = require('../log');
var Stale = require('./stale');
var Redis = require('./redis');
var Mongo = require('./mongo');


// Declare internals

var internals = {
    day: 24 * 60 * 60 * 1000
};


exports.Client = internals.Client = function (server) {

    var self = this;

    var options = server.settings.cache;
    var partition = options.partition || server.settings.name;

    Utils.assert(this.constructor === internals.Client, 'Cache client must be instantiated using new');
    Utils.assert(partition, 'Invalid partition configuration');

    this.settings = options;

    // Create internal connection

    var implementation = null;
    if (this.settings.engine === 'redis') {
        implementation = Redis;
    }
    else if (this.settings.engine === 'mongo') {
        implementation = Mongo;
    }

    Utils.assert(implementation, 'Unknown cache engine type');

    this.connection = new implementation.Connection(partition, this.settings);
    this.connection.start(function (err) {

        if (err) {
            Log.event(['cache', 'error', this.settings.engine], 'Failed initializing cache engine');
        }
    });

    return this;
};


internals.Client.prototype.stop = function () {

    if (this.connection) {
        this.connection.stop();
    }
};


internals.Client.prototype.get = function (key, callback) {

    var self = this;


    if (key === null) {
        // null key not allowed
        return callback(null, null);
    }

    if (!this.connection) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    this.connection.get(key, function (err, result) {

        if (err) {
            // Connection error
            return callback(err);
        }

        if (!result ||
            !result.item) {

            // Not found
            return callback(null, null);
        }

        var now = Date.now();
        var expires = result.stored + result.ttl;
        var ttl = expires - now;
        if (ttl <= 0) {
            // Expired
            return callback(null, null);
        }

        // Valid

        var cached = {
            item: result.item,
            stored: result.stored,
            ttl: ttl
        };

        return callback(null, cached);
    });
};


internals.Client.prototype.set = function (key, value, ttl, callback) {

    if (key === null) {
        // null key not allowed
        return callback(new Error('null key not allowed'));
    }

    if (!this.connection) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    if (ttl <= 0) {
        // Not cachable (or bad rules)
        return callback();
    }

    this.connection.set(key, value, ttl, callback);
};


internals.Client.prototype.drop = function (key, callback) {

    if (key === null) {
        // null key not allowed
        return callback(new Error('null key not allowed'));
    }

    if (!this.connection) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    this.connection.drop(key, callback);           // Always drop, regardless of caching rules
};


exports.Policy = internals.Policy = function (segment, config, cache) {

    Utils.assert(this.constructor === internals.Policy, 'Cache Policy must be instantiated using new');
    Utils.assert(segment, 'Invalid segment configuration');

    this._segment = segment;
    this._cache = cache;
    this.rule = exports.compile(config);

    Utils.assert(!this.isMode('server') || this._cache, 'No cache configured for server-side caching');

    return this;
};


internals.Policy.prototype.isMode = function (mode) {

    return this.rule.mode[mode] === true;        // Can be undefined
};


internals.Policy.prototype.isEnabled = function () {

    return Object.keys(this.rule.mode).length > 0;
};


internals.Policy.prototype.get = function (key, callback) {

    var self = this;

    if (!this.isMode('server')) {
        return callback(null, null);
    }

    this._cache.get({ segment: this._segment, id: key }, function (err, cached) {

        if (err) {
            return callback(err);
        }

        if (cached) {
            var age = Date.now() - cached.stored;
            cached.isStale = age >= self.rule.staleIn;
        }

        return callback(null, cached);
    });
};


internals.Policy.prototype.set = function (key, value, ttl, callback) {

    if (!this.isMode('server')) {
        return callback(null);
    }

    ttl = ttl || exports.ttl(this.rule);
    this._cache.set({ segment: this._segment, id: key }, value, ttl, callback);
};


internals.Policy.prototype.drop = function (key, callback) {

    if (!this.isMode('server')) {
        return callback(null);
    }

    this._cache.drop({ segment: this._segment, id: key }, callback);
};


internals.Policy.prototype.ttl = function (created) {

    return exports.ttl(this.rule, created);
};


internals.Policy.prototype.getOrGenerate = function (key, logFunc, generateFunc, callback) {

    Stale.process(this, key, logFunc, this._segment, generateFunc, callback);
};


exports.compile = function (config) {
    /*
    *   {
    *       mode: 'server+client',
    *       expiresIn: 30000,
    *       expiresAt: '13:00',
    *       staleIn: 20000,
    *       staleTimeout: 500
    *   }
    */

    var rule = {
        mode: {}
    };

    if (!config) {
        return rule;
    }

    // Mode

    var modes = (config.mode || 'server+client').split('+');
    modes.forEach(function (mode) {

        if (mode !== 'none') {
            rule.mode[mode] = true;
        }
    });

    if (Object.keys(rule.mode).length === 0) {
        Utils.assert(Object.keys(config).length === 1, 'Cannot configure cache rules when mode is none');
        return rule;
    }

    // Validate rule

    Utils.assert(!!config.expiresIn ^ !!config.expiresAt, 'Rule must include one of expiresIn or expiresAt but not both');                                                // XOR
    Utils.assert(!config.expiresAt || !config.staleIn || config.staleIn < 86400000, 'staleIn must be less than 86400000 milliseconds (one day) when using expiresAt');
    Utils.assert(!config.expiresIn || !config.staleIn || config.staleIn < config.expiresIn, 'staleIn must be less than expiresIn');
    Utils.assert(!(!!config.staleIn ^ !!config.staleTimeout), 'Rule must include both of staleIn and staleTimeout or none');                                      // XNOR
    Utils.assert(!config.staleTimeout || !config.expiresIn || config.staleTimeout < config.expiresIn, 'staleTimeout must be less than expiresIn');
    Utils.assert(!config.staleTimeout || !config.expiresIn || config.staleTimeout < (config.expiresIn - config.staleIn), 'staleTimeout must be less than the delta between expiresIn and staleIn');

    // Expiration

    if (config.expiresAt) {

        // expiresAt

        var time = /^(\d\d?):(\d\d)$/.exec(config.expiresAt);
        Utils.assert(time && time.length === 3, 'Invalid time string for expiresAt: ' + config.expiresAt);

        rule.expiresAt = {
            hours: parseInt(time[1], 10),
            minutes: parseInt(time[2], 10)
        };
    }
    else {

        // expiresIn

        rule.expiresIn = config.expiresIn;
    }

    // Stale

    if (config.staleIn) {
        Utils.assert(rule.mode.server, 'Cannot use stale options without server-side caching');
        rule.staleIn = config.staleIn;
        rule.staleTimeout = config.staleTimeout;
    }

    return rule;
};


exports.ttl = function (rule, created) {

    var now = Date.now();
    created = created || now;
    var age = now - created;

    if (age < 0) {
        return 0;                                                                   // Created in the future, assume expired/bad
    }

    if (rule.expiresIn) {
        var ttl = rule.expiresIn - age;
        return (ttl > 0 ? ttl : 0);                                                // Can be negative
    }

    if (rule.expiresAt) {
        if (created !== now &&
            now - created > internals.day) {                                        // If the item was created more than a 24 hours ago

            return 0;
        }

        var expiresAt = new Date(created);                                          // Assume everything expires in relation to now
        expiresAt.setHours(rule.expiresAt.hours);
        expiresAt.setMinutes(rule.expiresAt.minutes);
        expiresAt.setSeconds(0);

        var expiresIn = expiresAt.getTime() - created;
        if (expiresIn <= 0) {
            expiresIn += internals.day;                                             // Time passed for today, move to tomorrow
        }

        return expiresIn - age;
    }

    return 0;                                                                       // Bad rule
};


