// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var Mongodb = require('mongodb');
var libPath = process.env.TEST_COV ? '../../../lib-cov/' : '../../../lib/';
var Mongo = require(libPath + 'cache/mongo');


require('./suite')(function (useRedis, useMongo) {

    if (useMongo) {
        describe('Mongo', function () {

            before(function (done) {

                var db = new Mongodb.Db('unit-testing', new Mongodb.Server('127.0.0.1', 27017, { auto_reconnect: false, poolSize: 4 }), { safe: false });
                db.open(function (err, db) {

                    db.dropDatabase(function (err, done) {

                        db.addUser('tester', 'secret', function (err, result) {

                            expect(err).to.not.exist;
                            db.close();
                        });
                    });
                });
                done();
            });

            it('throws an error if not created with new', function (done) {

                var fn = function () {

                    var mongo = Mongo.Connection();
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('throws an error when using a reserved partition name', function (done) {

                var fn = function () {

                    var options = {
                        partition: 'admin'
                    };

                    var mongo = new Mongo.Connection(options);
                };

                expect(fn).to.throw(Error, 'Cache partition name cannot be "admin", "local", or "config" when using MongoDB');
                done();
            });

            describe('#start', function () {

                it('returns an error when authentication fails', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5,
                        username: 'bob'
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        done();
                    });
                });

                it('connects with authentication', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5,
                        username: 'tester',
                        password: 'secret'
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function (err) {

                        expect(err).to.not.exist;
                        done();
                    });
                });

                it('sets isReady to true when the connection succeeds', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function (err) {

                        expect(err).to.not.exist;
                        expect(mongo.isReady()).to.be.true;
                        done();
                    });
                });
            });

            describe('#validateSegmentName', function () {

                it('returns an error when the name is empty', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    var result = mongo.validateSegmentName('');

                    expect(result).to.be.instanceOf(Error);
                    expect(result.message).to.equal('Empty string');
                    done();
                });

                it('returns an error when the name has a null character', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    var result = mongo.validateSegmentName('\0test');

                    expect(result).to.be.instanceOf(Error);
                    done();
                });

                it('returns an error when the name starts with system.', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    var result = mongo.validateSegmentName('system.');

                    expect(result).to.be.instanceOf(Error);
                    done();
                });

                it('returns an error when the name has a $ character', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    var result = mongo.validateSegmentName('te$t');

                    expect(result).to.be.instanceOf(Error);
                    done();
                });

                it('returns an error when the name is too long', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    var result = mongo.validateSegmentName('0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789');

                    expect(result).to.be.instanceOf(Error);
                    done();
                });

                it('returns null when the name is valid', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    var result = mongo.validateSegmentName('hereisavalidname');

                    expect(result).to.not.exist;
                    done();
                });
            });

            describe('#getCollection', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.getCollection('test', function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not ready');
                        done();
                    });
                });

                it('passes a collection to the callback', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.getCollection('test', function (err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.exist;
                            done();
                        });
                    });
                });

                it('passes an error to the callback when there is an error getting the collection', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.getCollection('', function (err, result) {

                            expect(err).to.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });

                it('passes an error to the callback when the collection is null', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        var collectionStub = Sinon.stub(mongo.client, 'collection');
                        collectionStub.withArgs('testcollection').callsArgWith(1, null, null);

                        mongo.getCollection('testcollection', function (err, result) {

                            expect(err).to.exist;
                            expect(result).to.not.exist;
                            expect(err.message).to.equal('Received null collection object');
                            collectionStub.restore();
                            done();
                        });
                    });
                });
            });

            describe('#get', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.get('test', function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('passes a null item to the callback when it doesn\'t exist', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.get({ segment: 'test0', id: 'test0' }, function (err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });

                it('is able to retrieve an object thats stored when connection is started', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var key = {
                        id: 'test',
                        segment: 'test'
                    };

                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.set(key, 'myvalue', 200, function (err) {

                            expect(err).to.not.exist;
                            mongo.get(key, function (err, result) {

                                expect(err).to.not.exist;
                                expect(result.item).to.equal('myvalue');
                                done();
                            });
                        });
                    });
                });

                it('passes an error to the callback when there is an error finding the item', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'test',
                        segment: 'test'
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.get(key, function (err, result) {

                            expect(err).to.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });

                it('passes an error to the callback when there is an error returned from getting an item', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.collections.testerr = {
                        findOne: function (item, callback) {

                            return callback(new Error('test'));
                        }
                    };

                    mongo.get(key, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('test');
                        expect(result).to.not.exist;
                        done();
                    });
                });

                it('passes an error to the callback when there is an issue with the record structure', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.collections.testerr = {
                        findOne: function (item, callback) {

                            return callback(null, { value: false });
                        }
                    };

                    mongo.get(key, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('Incorrect record structure');
                        expect(result).to.not.exist;
                        done();
                    });
                });

                it('passes an error to the callback when there is an issue parsing the record value', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.collections.testerr = {
                        findOne: function (item, callback) {

                            return callback(null, { value: 'test', stored: true });
                        }
                    };

                    mongo.get(key, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('Bad value content');
                        expect(result).to.not.exist;
                        done();
                    });
                });
            });

            describe('#set', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.set({ id: 'test1', segment: 'test1' }, 'test1', 3600, function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('doesn\'t return an error when the set succeeds', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.set({ id: 'test1', segment: 'test1' }, 'test1', 3600, function (err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });

                it('passes an error to the callback when there is an error returned from setting an item', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.getCollection = function (item, callback) {

                        return callback(new Error('test'));
                    };

                    mongo.set(key, true, 0, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('test');
                        expect(result).to.not.exist;
                        done();
                    });
                });

                it('passes an error to the callback when there is an error returned from calling update', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.getCollection = function (item, callback) {

                        return callback(null, {
                            update: function (criteria, record, options, cb) {

                                return cb(new Error('test'));
                            }
                        });
                    };

                    mongo.set(key, true, 0, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('test');
                        expect(result).to.not.exist;
                        done();
                    });
                });
            });

            describe('#drop', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.drop({ id: 'test2', segment: 'test2' }, function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('doesn\'t return an error when the drop succeeds', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27017,
                        poolSize: 5
                    };
                    var mongo = new Mongo.Connection(options);

                    mongo.start(function () {

                        mongo.drop({ id: 'test2', segment: 'test2' }, function (err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });

                it('passes an error to the callback when there is an error returned from dropping an item', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.getCollection = function (item, callback) {

                        return callback(new Error('test'));
                    };

                    mongo.drop(key, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('test');
                        expect(result).to.not.exist;
                        done();
                    });
                });

                it('passes an error to the callback when there is an error returned from calling remove', function (done) {

                    var options = {
                        partition: 'unit-testing',
                        host: '127.0.0.1',
                        port: 27018,
                        poolSize: 5
                    };
                    var key = {
                        id: 'testerr',
                        segment: 'testerr'
                    };
                    var mongo = new Mongo.Connection(options);
                    mongo.client = true;
                    mongo.isConnected = true;

                    mongo.getCollection = function (item, callback) {

                        return callback(null, {
                            remove: function (criteria, safe, cb) {

                                return cb(new Error('test'));
                            }
                        });
                    };

                    mongo.drop(key, function (err, result) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('test');
                        expect(result).to.not.exist;
                        done();
                    });
                });
            });
        });
    }
});
