// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Utils = require('../utils');
var Redis = require('./redis');


// Declare internals

var internals = {
    day: 24 * 60 * 60 * 1000
};


exports.Client = internals.Client = function (options) {

    var self = this;

    Utils.assert(this.constructor === internals.Client, 'Cache client must be instantiated using new');

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


internals.Client.prototype.get = function (key, rule, callback) {

    var self = this;

    if (!this.connection) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    this.connection.get(key, function (err, item, created) {

        if (err) {
            // Connection error
            return callback(err);
        }

        if (!item) {
            // Not found
            return callback(null, null);
        }

        var ttl = exports.ttl(rule, created);
        if (ttl > 0) {

            var isStale = Date.now() - created >= rule.staleIn;

            var cached = {
                item: item,
                created: created,
                ttl: ttl,
                isStale: isStale
            };

            return callback(null, cached);
        }

        // Expired
        return callback(null, null);
    });
};


internals.Client.prototype.set = function (key, value, rule, callback) {

    if (!this.connection) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    var ttl = exports.ttl(rule);
    if (!ttl) {
        // Not cachable (or bad rules)
        return callback();
    }

    this.connection.set(key, value, ttl, callback);
};


internals.Client.prototype.drop = function (key, callback) {

    if (!this.connection) {
        // Disconnected
        return callback(new Error('Disconnected'));
    }

    this.connection.drop(key, callback);           // Always drop, regardless of caching rules
};


exports.Set = Set = function (config, cache) {

    this._cache = cache;
    this.rule = exports.compile(config);

    Utils.assert(!this.isMode('server') || this._cache, 'No cache configured for server-side caching');

    return this;
};


Set.prototype.isMode = function (mode) {

    return this.rule.mode[mode] === true;        // Can be undefined
};


Set.prototype.get = function (key, callback) {

    this._cache.get(key, this.rule, callback);
};


Set.prototype.set = function (key, value, callback) {

    this._cache.set(key, value, this.rule, callback);
};


Set.prototype.drop = function (key, callback) {

    this._cache.drop(key, callback);
};


Set.prototype.ttl = function (created) {

    return exports.ttl(this.rule, created);
};


exports.compile = function (config) {
    /*
    *   {
    *       mode: 'server+client',
    *       expiresInSec: 30,
    *       expiresAt: '13:00',
    *       staleInSec: 20,
    *       staleTimeoutMSec: 500       // Used in Request
    *   }
    */

    var rule = {
        mode: {}
    };

    if (!config) {
        return rule;
    }

    // Validate rule

    Utils.assert(!!config.expiresInSec ^ !!config.expiresAt, 'Rule must include one of expiresInSec or expiresAt but not both');                                                // XOR
    Utils.assert(!config.expiresAt || !config.staleInSec || config.staleInSec < 86400, 'staleInSec must be less than 86400 seconds (one day) when using expiresAt');
    Utils.assert(!config.expiresInSec || !config.staleInSec || config.staleInSec < config.expiresInSec, 'staleInSec must be less than expiresInSec');
    Utils.assert(!(!!config.staleInSec ^ !!config.staleTimeoutMSec), 'Rule must include both of staleInSec and staleTimeoutMSec or none');                                      // XNOR
    Utils.assert(!config.staleTimeoutMSec || !config.expiresInSec || config.staleTimeoutMSec < config.expiresInSec * 1000, 'staleTimeoutMSec must be less than expiresInSec');
    Utils.assert(!config.staleTimeoutMSec || !config.expiresInSec || config.staleTimeoutMSec < (config.expiresInSec - config.staleInSec) * 1000, 'staleTimeoutMSec must be less than the delta between expiresInSec and staleInSec');

    // Mode

    var modes = (config.mode || 'server+client').split('+');
    modes.forEach(function (mode) {

        rule.mode[mode] = true;
    });

    // Expiration

    if (config.expiresAt) {

        // expiresAt

        var time = /^(\d\d?):(\d\d)$/.exec(config.expiresAt);
        Utils.assert(time && time.length === 3, 'Invalid time string for expiresAt');

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
            now - created > internals.day) {                                // If the item was created more than a 24 hours ago

            return 0;
        }

        var expiresAt = new Date(created);                                          // Assume everything expires in relation to now
        expiresAt.setHours(rule.expiresAt.hours);
        expiresAt.setMinutes(rule.expiresAt.minutes);
        expiresAt.setSeconds(0);

        var expiresIn = expiresAt.getTime() - created;
        if (expiresIn <= 0) {
            expiresIn += internals.day;                                       // Time passed for today, move to tomorrow
        }

        return expiresIn - age;
    }

    return 0;                                                                       // Bad rule
};


