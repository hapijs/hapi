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

    var that = this;

    this.settings = options;

    // Compile rules

    this.rules = Rules.compile(this.settings.rules);
    if (this.rules instanceof Error) {

        Utils.abort('Bad rule: ' + this.rules.message);
    };

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

        that.emit('ready', err);
    });

    return this;
};

NodeUtil.inherits(Client, Events.EventEmitter);


Client.prototype.stop = function () {

    if (this.connection) {

        this.connection.stop();
    }
};


Client.prototype.get = function (/* key, rule, callback */) {

    var that = this;

    var key = arguments[0];
    var rule = (arguments.length === 3 ? arguments[1] : null);
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1])

    if (this.connection) {

        if (Rules.isCached(key, rule || this.rules)) {

            this.connection.get(key, function (err, item, created) {

                if (err === null) {

                    if (item) {

                        if (Rules.isExpired(key, rule || that.rules, created) === false) {

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


Client.prototype.set = function (/* key, value, rule, callback */) {

    var key = arguments[0];
    var value = arguments[1];
    var rule = (arguments.length === 4 ? arguments[2] : null);
    var callback = (arguments.length === 4 ? arguments[3] : arguments[2])

    if (this.connection) {

        var expiresInSec = Rules.expireInSec(key, rule || this.rules);
        if (expiresInSec !== null) {

            this.connection.set(key, value, expiresInSec, callback);
        }
        else {

            // Not cachable (or bad rule)
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


Client.prototype.compile = function (rule) {

    return Rules.compile(rule);
};


exports.Set = Set = function (config, cache) {

    this.cache = cache;
    this.rule = this.cache.compile(config);

    return this;
};


Set.prototype.get = function (key, callback) {

    this.cache.get(key, this.rule, callback);
};


Set.prototype.set = function (key, value, callback) {

    this.cache.get(key, value, this.rule, callback);
};


Set.prototype.drop = function (key, callback) {

    this.cache.drop(key, callback);
};

