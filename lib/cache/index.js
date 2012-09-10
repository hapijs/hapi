/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

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

    var imp = (this.settings.engineType === 'redis' ? Redis : null);
    if (imp === null) {

        Utils.abort('Unknown cache engine type');
    }

    this.connection = imp.create({

        port: this.settings.port,
        address: this.settings.address
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

        if (Rules.isCached(key, rules)) {

            this.connection.get(key, function (err, item, created) {

                if (err === null) {

                    if (item) {

                        if (Rules.isExpired(key, rules, created) === false) {

                            // TODO: Implement stale

                            callback(null, item, false);     // err, item, isStale
                        }
                        else {

                            // Expired
                            callback(null, null, false);
                        }
                    }
                    else {

                        // Not found
                        callback(null, null, false);
                    }
                }
                else {

                    // Connection error
                    callback(err, null, false);
                }
            });
        }
        else {

            // Not cachable
            callback(null, null, false);
        }
    }
    else {

        // Disconnected
        callback('Disconnected', null, false);
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

    this.cache.get(key, this.rules, callback);
};


Set.prototype.set = function (key, value, callback) {

    this.cache.set(key, value, this.rules, callback);
};


Set.prototype.drop = function (key, callback) {

    this.cache.drop(key, callback);
};

