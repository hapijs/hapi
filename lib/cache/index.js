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


Client.prototype.get = function (key, rules, callback) {

    var self = this;

    if (this.connection) {
        if (Rules.isCached(key, rules, 'server')) {
            this.connection.get(key, function (err, item, created) {

                if (err) {
                    // Connection error
                    return callback(err, null, false);
                }

                if (item) {
                    if (Rules.isExpired(key, rules, created) === false) {

                        // TODO: Implement stale

                        return callback(null, item, false);     // err, item, isStale
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
            // Not cachable
            return callback(null, null, false);
        }
    }
    else {
        // Disconnected
        return callback('Disconnected', null, false);
    }
};


Client.prototype.set = function (key, value, rules, callback) {

    if (this.connection) {
        var expiresInSec = Rules.expireInSec(key, rules);
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


exports.Set = Set = function (rules, cache) {

    this.cache = cache;
    this.rules = Rules.compile(rules);

    return this;
};


Set.prototype.get = function (key, callback) {

    if (this.cache) {
        this.cache.get(key, this.rules, callback);
    }
    else {
        callback();
    }
};


Set.prototype.set = function (key, value, callback) {

    if (this.cache) {
        this.cache.set(key, value, this.rules, callback);
    }
    else {
        callback();
    }
};


Set.prototype.drop = function (key, callback) {

    if (this.cache) {
        this.cache.drop(key, callback);
    }
    else {
        callback();
    }
};