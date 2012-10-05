// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Utils = require('../utils');
var Redis = require('./redis');


// Declare internals

var internals = {};


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

            // TODO: Implement stale

            var cached = {
                item: item,
                created: created,
                ttl: ttl,
                isStale: false
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
        callback(new Error('Disconnected'));
    }

    var expiresInSec = exports.ttl(rule);
    if (expiresInSec !== null) {
        this.connection.set(key, value, expiresInSec, callback);
    }
    else {
        // Not cachable (or bad rules)
        callback();
    }
};


internals.Client.prototype.drop = function (key, callback) {

    if (!this.connection) {
        // Disconnected
        callback(new Error('Disconnected'));
    }

    this.connection.drop(key, callback);           // Always drop, regardless of caching rules
};


exports.Set = Set = function (config, cache) {

    var self = this;

    this.mode = {};

    if (config) {
        this.cache = cache;
        this.rule = exports.compile(config);
        Utils.assert(!(this.rule instanceof Error), 'Bad cache rule: ' + (this.rule ? this.rule.message : 'unknown'));

        var modes = (config.mode || 'server+client').split('+');
        modes.forEach(function (mode) {

            self.mode[mode] = true;
        });

        Utils.assert(!this.mode.server || this.cache, 'No cache configured for server-side caching');
    }

    return this;
};


Set.prototype.isMode = function (mode) {

    return this.mode[mode] === true;        // Can be undefined
};


Set.prototype.get = function (key, callback) {

    this.cache.get(key, this.rule, callback);
};


Set.prototype.set = function (key, value, callback) {

    this.cache.set(key, value, this.rule, callback);
};


Set.prototype.drop = function (key, callback) {

    this.cache.drop(key, callback);
};


Set.prototype.ttl = function (created) {

    return exports.ttl(this.rule, created);
};


exports.compile = function (config) {
    /*
    *   {
    *       expiresInSec: 30,
    *       expiresAt: '13:00',
    *       staleInSec: 20          // Not implemented
    *   }
    */

    var rule = {};

    // Validate expiration settings

    if (config.expiresInSec ||
        config.expiresAt) {

        if (config.expiresAt) {
            if (config.expiresInSec === undefined) {
                var time = /^(\d\d?):(\d\d)$/.exec(config.expiresAt);
                if (time &&
                    time.length === 3) {

                    rule.expiresAt = { hours: parseInt(time[1], 10), minutes: parseInt(time[2], 10) };
                }
                else {
                    return new Error('Invalid time string');
                }
            }
            else {
                return new Error('Cannot have both relative and absolute expiration');
            }
        }
        else {
            rule.expiresInSec = config.expiresInSec;
        }
    }

    return rule;
};


exports.ttl = function (rule, created) {

    var now = Date.now();
    created = created || now;
    var age = (now - created) / 1000;

    if (age < 0) {
        return 0;                                                                   // Created in the future, assume expired/bad
    }

    if (rule.expiresInSec) {
        var ttl = rule.expiresInSec - age;
        return (ttl > 0 ? ttl : 0);                                                // Can be negative
    }

    if (rule.expiresAt) {
        if (created !== now && (now - created) > (24 * 60 * 60 * 1000)) {           // If the item was created more than a 24 hours ago
            return 0;
        }

        var expiresAt = new Date(created);                                          // Assume everything expires in relation to now
        expiresAt.setHours(rule.expiresAt.hours);
        expiresAt.setMinutes(rule.expiresAt.minutes);
        expiresAt.setSeconds(0);

        var expiresInSec = (expiresAt.getTime() - created) / 1000;
        if (expiresInSec <= 0) {
            expiresInSec += 24 * 60 * 60;                                           // Time passed for today, move to tomorrow
        }

        return expiresInSec - age;
    }

    return 0;                                                                       // Bad rule
};


