// Load modules

var MongoDB = require('mongodb');
var Utils = require('../utils');


// Declare internals

var internals = {
    defaults: {
        host: '127.0.0.1',
        port: 27017,
        poolSize: 5
    }
};


exports.Connection = internals.Connection = function (partition, options) {

    Utils.assert(this.constructor === internals.Connection, 'MongoDB cache client must be instantiated using new');

    this.settings = options;
    this.client = null;
    this.isReady = false;
    this.collections = {};
    this.partition = partition;
    return this;
};

/*
Database names: 

- empty string is not valid 
- cannot contain space, ".", "$", "/", "\\" or "\0" 
- should be all lowercase 
- limited to 64 bytes (after conversion to UTF-8) 
- admin, local and config are reserved 

Collection names: 

- empty string is not valid 
- cannot contain "\0" 
- avoid creating any collections with "system." prefix 
- user created collections should not contain "$" in the name 

Also, the sum of the database name + collection name + 1 is limited to 
121 bytes (in practice stay below 100).
*/

internals.Connection.prototype.start = function (callback) {

    var self = this;

    if (this.client) {
        return callback(new Error('Connection already established'));
    }

    var server = new MongoDB.Server(this.settings.host || internals.defaults.host, this.settings.port || internals.defaults.port, { auto_reconnect: true, poolSize: this.settings.poolSize || internals.defaults.poolSize });
    this.client = new MongoDB.Db('hapi'/*this.partition*/, server, { safe: true });

    this.client.open(function (err, client) {

        if (err) {
            return callback(new Error('Failed opening connection'));
        }

        if (self.settings.username) {
            self.client.authenticate(self.settings.username, self.settings.password, function (err, result) {

                if (err ||
                    !result) {

                    self.stop();
                    return callback(new Error('Database authentication error: ' + (err ? JSON.stringify(err) : 'failed')));
                }

                self.isReady = true;
                return callback();
            });
        }
        else {
            self.isReady = true;
            return callback();
        }
    });
};


internals.Connection.prototype.getCollection = function (name, callback) {

    var self = this;

    if (!this.isReady) {
        return callback(new Error('Connection not ready'));
    }

    if (this.collections[name]) {
        return callback(null, this.collections[name]);
    }

    // Fetch collection

    this.client.collection(name, function (err, collection) {

        if (err) {
            return callback(err);
        }

        if (!collection) {
            return callback(new Error('Received null collection object'));
        }

        // Found

        self.collections[name] = collection;
        return callback(null, collection);
    });
};


internals.Connection.prototype.stop = function () {

    if (this.client) {
        this.client.close();
        this.client = null;
        this.collections = {};
        this.isReady = false;
    }
};


internals.Connection.prototype.get = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.getCollection(key.segment, function (err, collection) {

        if (err) {
            return callback(err);
        }

        var criteria = { key: key.id };
        collection.findOne(criteria, function (err, record) {

            if (err) {
                return callback(err);
            }

            if (!record) {
                return callback(null, null);
            }

            if (!record.value ||
                !record.stored) {

                return callback(new Error('Incorrect record structure'));
            }

            var value = null;
            try {
                value = JSON.parse(record.value);
            }
            catch (e) { }

            if (!value) {
                return callback(new Error('Bad value content'));
            }

            var envelope = {
                item: value,
                stored: record.stored.getTime(),
                ttl: (record.ttl instanceof MongoDB.Long ? record.ttl.toNumber : record.ttl)
            };

            return callback(null, envelope);
        });
    });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    if (!ttl ||
        ttl <= 0) {

        return callback(new Error('Cannot set item forever (ttl: ' + ttl + ')'));
    }

    this.getCollection(key.segment, function (err, collection) {

        if (err) {
            return callback(err);
        }

        var record = {
            key: key.id,
            value: JSON.stringify(value),
            stored: new Date(),
            ttl: ttl
        };

        var criteria = { key: key.id };
        collection.update(criteria, record, { upsert: true, safe: true }, function (err, count) {

            if (err) {
                return callback(err);
            }

            return callback();
        });
    });
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.client) {
        return callback(new Error('Connection not started'));
    }

    this.getCollection(key.segment, function (err, collection) {

        if (err) {
            return callback(err);
        }

        var criteria = { key: key.id };
        collection.remove(criteria, { safe: true }, function (err, count) {

            if (err) {
                return callback(err);
            }

            return callback();
        });
    });
};


