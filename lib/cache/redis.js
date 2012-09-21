// Load modules

var Redis = require('redis');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Server class creation. the valid options are include: port, host

exports.create = function (options) {

    var instance = {
        settings: options,
        client: null,
        initialize: function (callback) {

            instance.client = Redis.createClient(instance.settings.port, instance.settings.host)

            // Listen to errors

            var wasHandled = false;

            instance.client.on('error', function (err) {

                if (wasHandled === false) {
                    wasHandled = true;
                    return callback(err);
                }
            });

            // Wait for connection

            instance.client.on('connect', function () {

                if (wasHandled === false) {
                    wasHandled = true;
                    return callback(null);
                }
            });
        },

        public: {
            start: function (callback) {

                if (!instance.client) {
                    instance.initialize(function (err) {

                        return callback(err);
                    });
                }
                else {
                    return callback('Client already started');
                }
            },

            stop: function () {

                if (instance.client) {
                    instance.client.quit();
                    instance.client = null;
                }
            },

            get: function (key, callback) {

                if (instance.client) {
                    instance.client.get(key, function (err, item) {

                        if (err) {
                            return callback(err, null, null);
                        }

                        if (item) {
                            var envelope = null;
                            try {
                                envelope = JSON.parse(item);
                            }
                            catch (e) {}

                            if (envelope) {
                                if (envelope.payload &&
                                    envelope.created) {

                                    return callback(null, envelope.payload, envelope.created);
                                }
                                else {
                                    return callback('Incorrect envelope structure', null, null);
                                }
                            }
                            else {
                                return callback('Bad envelope content', null, null);
                            }
                        }
                        else {
                            return callback(null, null, null);
                        }
                    });
                }
                else {
                    return callback('Client not started', null, null);
                }
            },

            set: function (key, value, expiresInSec, callback) {

                if (instance.client) {
                    var now = Date.now();
                    var envelope = {
                        payload: value,
                        created: now
                    };

                    instance.client.set(key, JSON.stringify(envelope), function (err, result) {

                        if (err) {
                            return callback(err);
                        }

                        if (expiresInSec > 0) {
                            instance.client.expire(key, expiresInSec, function () {

                                return callback(null);
                            });
                        }
                        else {
                            return callback(null);
                        }
                    });
                }
                else {
                    return callback('Client not started');
                }
            },

            drop: function (key, callback) {

                if (instance.client) {
                    instance.client.del(key, function (err) {

                        return callback(err);
                    });
                }
                else {
                    return callback('Client not started');
                }
            }
        }
    };

    return instance.public;
};



