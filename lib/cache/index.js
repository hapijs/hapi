// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Utils = require('../utils');
var Rules = require('./rules');
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

        if (Rules.getTtl(rule, created) > 0) {

            // TODO: Implement stale

            return callback(null, { item: item, created: created, isStale: false });
        }
        else {
            // Expired
            return callback(null, null);
        }
    });
};


internals.Client.prototype.set = function (key, value, rule, callback) {

    if (!this.connection) {
        // Disconnected
        callback(new Error('Disconnected'));
    }

    var expiresInSec = Rules.getTtl(rule);
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
        self.cache = cache;
        self.rule = Rules.compile(config);

        var modes = (config.mode || 'server+client').split('+');
        modes.forEach(function (mode) {

            self.mode[mode] = true;
        });

        Utils.assert(!self.mode.server || this.cache, 'No cache configured for server-side caching');
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



