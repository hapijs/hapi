/*
* Copyright (c) 2012 Walmart. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Redis = require('redis');
var Utils = require('../utils');


// Declare internals

var internals = {};


// Server class creation. the valid options are include: port, address

exports.create = function (options) {

    var instance = {

        settings: options,
        client: null,

        initialize: function (callback) {

            instance.client = Redis.createClient(instance.settings.port, instance.settings.address)

            // Listen to errors

            var wasHandled = false;

            instance.client.on('error', function (err) {

                if (wasHandled === false) {

                    wasHandled = true;
                    callback(err);
                }
            });

            // Wait for connection

            instance.client.on('connect', function () {

                if (wasHandled === false) {

                    wasHandled = true;
                    callback(null);
                }
            });
        },

        public: {

            start: function (callback) {

                if (instance.client === null) {

                    instance.initialize(function (err) {

                        callback(err);
                    });
                }
                else {

                    callback('Client already started');
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

                        if (err === null) {

                            if (item) {

                                var envelope = null;
                                try {

                                    envelope = JSON.parse(item);
                                }
                                catch (e) {
                                }

                                if (envelope) {

                                    if (envelope.payload &&
                                        envelope.created) {

                                        callback(null, envelope.payload, envelope.created);
                                    }
                                    else {

                                        callback('Incorrect envelope structure', null, null);
                                    }
                                }
                                else {

                                    callback('Bad envelope content', null, null);
                                }
                            }
                            else {

                                callback(null, null, null);
                            }
                        }
                        else {

                            callback(err, null, null);
                        }
                    });
                }
                else {

                    callback('Client not started', null, null);
                }
            },

            set: function (key, value, expiresInSec, callback) {

                if (instance.client) {

                    var now = Utils.getTimestamp();
                    var envelope = {

                        payload: value,
                        created: now
                    };

                    instance.client.set(key, JSON.stringify(envelope), function (err, result) {

                        if (err === null) {

                            if (expiresInSec > 0) {

                                instance.client.expire(key, expiresInSec, function () {

                                    callback(null);
                                });
                            }
                            else {

                                callback(null);
                            }
                        }
                        else {

                            callback(err);
                        }
                    });
                }
                else {

                    callback('Client not started');
                }
            },

            drop: function (key, callback) {

                if (instance.client) {

                    instance.client.del(key, function (err) {

                        callback(err);
                    });
                }
                else {

                    callback('Client not started');
                }
            }
        }
    };

    return instance.public;
};



