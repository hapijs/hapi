// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Utils = require('../utils');
var Redis = require('./redis');
var Stale = require('./stale');


// Declare internals

var internals = {
    day: 24 * 60 * 60 * 1000
};


exports.Client = internals.Client = function (partition, options) {

    var self = this;

    Utils.assert(this.constructor === internals.Client, 'Cache client must be instantiated using new');
    Utils.assert(partition, 'Invalid partition configuration');
    Utils.assert(partition.match(/:/g) === null, 'Partition includes an illegal charactger (:)');

    this.partition = partition;
    this.settings = options;

    // Create internal connection

    var imp = (this.settings.engine === 'redis' ? Redis : null);
    Utils.assert(imp, 'Unknown cache engine type');

    this.connection = new imp.Connection({
        host: this.settings.host,
        port: this.settings.port
    });

    this.connection.start(function (err) {

        self.emit('ready', err);
    });

    return this;
};

NodeUtil.inherits(internals.Client, Events.EventEmitter);


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

    this.connection.get(this.partition + ':' + key, function (err, result) {

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

    this.connection.set(this.partition + ':' + key, value, ttl, callback);
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

    this.connection.drop(this.partition + ':' + key, callback);           // Always drop, regardless of caching rules
};


exports.Policy = internals.Policy = function (segment, config, cache) {

    Utils.assert(this.constructor === internals.Policy, 'Cache Policy must be instantiated using new');
    Utils.assert(segment, 'Invalid segment configuration');
    Utils.assert(segment.match(/:/g) === null, 'Segment includes an illegal charactger (:)');

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

    this._cache.get(this._segment + ':' + key, function (err, cached) {

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

    ttl = ttl || exports.ttl(this.rule);
    this._cache.set(this._segment + ':' + key, value, ttl, callback);
};


internals.Policy.prototype.drop = function (key, callback) {

    this._cache.drop(this._segment + ':' + key, callback);
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
    *       expiresInSec: 30,
    *       expiresAt: '13:00',
    *       staleInSec: 20,
    *       staleTimeoutMSec: 500
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

    Utils.assert(!!config.expiresInSec ^ !!config.expiresAt, 'Rule must include one of expiresInSec or expiresAt but not both');                                                // XOR
    Utils.assert(!config.expiresAt || !config.staleInSec || config.staleInSec < 86400, 'staleInSec must be less than 86400 seconds (one day) when using expiresAt');
    Utils.assert(!config.expiresInSec || !config.staleInSec || config.staleInSec < config.expiresInSec, 'staleInSec must be less than expiresInSec');
    Utils.assert(!(!!config.staleInSec ^ !!config.staleTimeoutMSec), 'Rule must include both of staleInSec and staleTimeoutMSec or none');                                      // XNOR
    Utils.assert(!config.staleTimeoutMSec || !config.expiresInSec || config.staleTimeoutMSec < config.expiresInSec * 1000, 'staleTimeoutMSec must be less than expiresInSec');
    Utils.assert(!config.staleTimeoutMSec || !config.expiresInSec || config.staleTimeoutMSec < (config.expiresInSec - config.staleInSec) * 1000, 'staleTimeoutMSec must be less than the delta between expiresInSec and staleInSec');

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

        // expiresInSec

        rule.expiresIn = config.expiresInSec * 1000;
    }

    // Stale

    if (config.staleInSec) {
        Utils.assert(rule.mode.server, 'Cannot use stale options without server-side caching');
        rule.staleIn = config.staleInSec * 1000;
        rule.staleTimeout = config.staleTimeoutMSec;
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


