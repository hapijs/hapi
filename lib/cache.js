/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules


// Declare internals

var internals = {};


exports.Set = Set = function (config, client) {

    this.client = client;
    this.rule = this.client.compile(config);

    return this;
};


Set.prototype.get = function (key, callback) {

    this.client.get(key, this.rule, callback);
};


Set.prototype.set = function (key, value, callback) {

    this.client.get(key, value, this.rule, callback);
};


Set.prototype.drop = function (key, callback) {

    this.client.drop(key, callback);
};

