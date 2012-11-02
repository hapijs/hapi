// Load modules

var Utils = require('../utils');


// Declare internals

var internals = {};


exports.Connection = internals.Connection = function (options) {

    Utils.assert(this.constructor === internals.Connection, 'Memory cache client must be instantiated using new');

    this.settings = options;
    this.cache = null;
    return this;
};


internals.Connection.prototype.start = function (callback) {

    if (!this.cache) {
        this.cache = {};
    }

    return callback();
};


internals.Connection.prototype.stop = function () {

    this.cache = null;
    return;
};


internals.Connection.prototype.isReady = function () {

    return (!!this.cache);
};


internals.Connection.prototype.validateSegmentName = function (name) {

    if (!name) {
        return new Error('Empty string');
    }

    if (name.indexOf('\0') !== -1) {
        return new Error('Includes null character');
    }

    return null;
};


internals.Connection.prototype.get = function (key, callback) {

    if (!this.cache) {
        return callback(new Error('Connection not started'));
    }

    var segment = this.cache[key.segment];
    if (!segment) {
        return callback(null, null);
    }

    var envelope = segment[key.id];
    if (!envelope) {
        return callback(null, null);
    }

    return callback(null, envelope);
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    if (!this.cache) {
        return callback(new Error('Connection not started'));
    }

    var envelope = {
        item: value,
        stored: Date.now(),
        ttl: ttl
    };

    this.cache[key.segment] = this.cache[key.segment] || {};
    var segment = this.cache[key.segment];

    segment[key.id] = envelope;
    return callback(null);
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.cache) {
        return callback(new Error('Connection not started'));
    }

    var segment = this.cache[key.segment];
    if (segment) {
        delete segment[key.id];
    }

    return callback();
};


