// Load modules

var Redis = require('redis');
var Utils = require('../utils');


// Declare internals

var internals = {};


exports.Connection = internals.Connection = function (options) {

    Utils.assert(this.constructor === internals.Connection, 'Redis cache client must be instantiated using new');

    this.settings = options;
    this.client = null;
    return this;
};


internals.Connection.prototype.start = function (callback) {

    if (this.client) {
        return callback(new Error('Connection already established'));
    }

    this.client = Redis.createClient(this.settings.port, this.settings.host);

    // Listen to errors

    var wasHandled = false;

    this.client.on('error', function (err) {

        if (wasHandled === false) {
            wasHandled = true;
            return callback(err);
        }
    });

    // Wait for connection

    this.client.on('connect', function () {

        if (wasHandled === false) {
            wasHandled = true;
            return callback();
        }
    });
};


internals.Connection.prototype.stop = function () {

    if (this.client) {
        this.client.quit();
        this.client = null;
    }
};


internals.Connection.prototype.get = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.client.get(this.generateKey(key), function (err, result) {

        if (err) {
            return callback(err);
        }

        if (!result) {
            return callback(null, null);
        }

        var envelope = null;
        try {
            envelope = JSON.parse(result);
        }
        catch (e) { }

        if (!envelope) {
            return callback(new Error('Bad envelope content'));
        }

        if (!envelope.item ||
            !envelope.stored) {

            return callback(new Error('Incorrect envelope structure'));
        }

        return callback(null, envelope);
    });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    var self = this;

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    if (!ttl ||
        ttl <= 0) {

        return callback(new Error('Cannot set item forever (ttl: ' + ttl + ')'));
    }

    var envelope = {
        item: value,
        stored: Date.now(),
        ttl: ttl
    };

    var cacheKey = this.generateKey(key);
    this.client.set(cacheKey, JSON.stringify(envelope), function (err, result) {

        if (err) {
            return callback(err);
        }
        
        self.client.expire(cacheKey, Math.max(1, Math.floor(ttl / 1000)), function () {        // Use 'pexpire' with ttl in Redis 2.6.0

            return callback();
        });
    });
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.client.del(this.generateKey(key), function (err) {

        return callback(err);
    });
};


internals.Connection.prototype.generateKey = function (key) {

    return encodeURIComponent(this.settings.partition) + ':' + encodeURIComponent(key.segment) + ':' + encodeURIComponent(key.id);
};

