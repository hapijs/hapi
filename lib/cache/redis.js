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

    this.client = Redis.createClient(this.settings.port, this.settings.host)

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

    this.client.get(key, function (err, item) {

        if (err) {
            return callback(err);
        }

        if (!item) {
            return callback(null, null);
        }

        var envelope = null;
        try {
            envelope = JSON.parse(item);
        }
        catch (e) { }

        if (envelope) {
            if (envelope.payload &&
                envelope.created) {

                return callback(null, envelope.payload, envelope.created);
            }
            else {
                return callback(new Error('Incorrect envelope structure'));
            }
        }
        else {
            return callback(new Error('Bad envelope content'));
        }
    });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    var self = this;

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    var envelope = {
        payload: value,
        created: Date.now()
    };

    this.client.set(key, JSON.stringify(envelope), function (err, result) {

        if (err) {
            return callback(err);
        }

        if (ttl) {
            self.client.expire(key, ttl * 1000, function () {

                return callback();
            });
        }
        else {
            return callback();
        }
    });
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.client.del(key, function (err) {

        return callback(err);
    });
};



