// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Utils = require('../utils');
var Rules = require('./rules');
var Redis = require('./redis');


// Declare internals

var internals = {};


exports.Client = Client = function (options) {

    var self = this;

    this.settings = options;

    // Create internal connection

    var imp = (this.settings.engine === 'redis' ? Redis : null);
    Utils.assert(imp, 'Unknown cache engine type');

    this.connection = imp.create({
        host: this.settings.host,
        port: this.settings.port
    });

    this.connection.start(function (err) {

        self.emit('ready', err);
    });

    return this;
};

NodeUtil.inherits(Client, Events.EventEmitter);


Client.prototype.stop = function () {

    if (this.connection) {
        this.connection.stop();
    }
};


Client.prototype.get = function (key, rule, callback) {

    var self = this;

    if (this.connection) {
        this.connection.get(key, function (err, item, created) {

            if (err) {
                // Connection error
                return callback(err, null, false);
            }

            if (item) {
                if (Rules.isExpired(rule, created) === false) {

                    // TODO: Implement stale

                    return callback(null, { item: item, created: created }, false);     // err, item, isStale
                }
                else {
                    // Expired
                    return callback(null, null, false);
                }
            }
            else {
                // Not found
                return callback(null, null, false);
            }
        });
    }
    else {
        // Disconnected
        return callback('Disconnected', null, false);
    }
};


Client.prototype.set = function (key, value, rule, callback) {

    if (this.connection) {
        var expiresInSec = Rules.expireInSec(rule);
        if (expiresInSec !== null) {
            this.connection.set(key, value, expiresInSec, callback);
        }
        else {
            // Not cachable (or bad rules)
            callback(null);
        }
    }
    else {
        // Disconnected
        callback('Disconnected');
    }
};


Client.prototype.drop = function (key, callback) {

    if (this.connection) {
        this.connection.drop(key, callback);           // Always drop, regardless of caching rules
    }
    else {
        // Disconnected
        callback('Disconnected');
    }
};


exports.Set = Set = function (config, cache) {

    var self = this;
    var parseMode = function (modeString) {
        self.modeConfig = {};
        var modes = modeString.split('+');
        modes.forEach(function(mode) {
            self.modeConfig[mode] = true;
        });
    };

    if (config) {
        self.cache = cache;
        self.rule = Rules.compile(config);
        parseMode(config.mode || 'server+client');
    }
    else {
        this.modeConfig = {};
    }

    if (self.modeConfig.server === true) {
        Utils.assert(this.cache, 'No cache configured for server');
    }

    return this;
};


Set.prototype.isMode = function(mode) {

    return this.modeConfig[mode] === true;
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