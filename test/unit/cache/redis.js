// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');
var Redis = process.env.TEST_COV ? require('../../../lib-cov/cache/redis') : require('../../../lib/cache/redis');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


require('./suite')(function (useRedis) {

    if (useRedis) {
        describe('Redis', function () {

            it('throws an error if not created with new', function (done) {

                var fn = function () {

                    var redis = Redis.Connection();
                };

                expect(fn).to.throw(Error);
                done();
            });

            describe('#start', function () {

                it('sets client to when the connection succeeds', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.start(function (err, result) {

                        expect(err).to.not.exist;
                        expect(result).to.not.exist;
                        expect(redis.client).to.exist;
                        done();
                    });
                });

                it('returns an error when connection fails', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6380
                    };

                    var redis = new Redis.Connection(options);

                    redis.start(function (err, result) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(redis.client).to.not.exist;
                        done();
                    });
                });
            });

            describe('#validateSegmentName', function () {

                it('returns an error when the name is empty', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    var result = redis.validateSegmentName('');

                    expect(result).to.be.instanceOf(Error);
                    expect(result.message).to.equal('Empty string');
                    done();
                });

                it('returns an error when the name has a null character', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    var result = redis.validateSegmentName('\0test');

                    expect(result).to.be.instanceOf(Error);
                    done();
                });

                it('returns null when there aren\'t any errors', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    var result = redis.validateSegmentName('valid');

                    expect(result).to.not.be.instanceOf(Error);
                    expect(result).to.equal(null);
                    done();
                });
            });

            describe('#get', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.get('test', function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('passes an error to the callback when there is an error returned from getting an item', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);
                    redis.client = {
                        get: function (item, callback) {

                            callback(new Error());
                        }
                    };

                    redis.get('test', function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        done();
                    });
                });

                it('passes an error to the callback when there is an error parsing the result', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);
                    redis.client = {
                        get: function (item, callback) {

                            callback(null, 'test');
                        }
                    };

                    redis.get('test', function (err) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('Bad envelope content');
                        done();
                    });
                });

                it('passes an error to the callback when there is an error with the envelope structure', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);
                    redis.client = {
                        get: function (item, callback) {

                            callback(null, '{ "item": "false" }');
                        }
                    };

                    redis.get('test', function (err) {

                        expect(err).to.exist;
                        expect(err.message).to.equal('Incorrect envelope structure');
                        done();
                    });
                });

                it('is able to retrieve an object thats stored when connection is started', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379,
                        partition: 'wwwtest'
                    };
                    var key = {
                        id: 'test',
                        segment: 'test'
                    };

                    var redis = new Redis.Connection(options);

                    redis.start(function () {

                        redis.set(key, 'myvalue', 200, function (err) {

                            expect(err).to.not.exist;
                            redis.get(key, function (err, result) {

                                expect(err).to.not.exist;
                                expect(result.item).to.equal('myvalue');
                                done();
                            });
                        });
                    });
                });

                it('returns null when unable to find the item', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379,
                        partition: 'wwwtest'
                    };
                    var key = {
                        id: 'notfound',
                        segment: 'notfound'
                    };

                    var redis = new Redis.Connection(options);

                    redis.start(function () {

                        redis.get(key, function (err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });
            });

            describe('#set', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.set('test1', 'test1', 3600, function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('passes an error to the callback when there is an error returned from setting an item', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);
                    redis.client = {
                        set: function (key, item, callback) {

                            callback(new Error());
                        }
                    };

                    redis.set('test', 'test', 3600, function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        done();
                    });
                });
            });

            describe('#drop', function () {

                it('passes an error to the callback when the connection is closed', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.drop('test2', function (err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('deletes the item from redis', function (done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);
                    redis.client = {
                        del: function (key, callback) {

                            callback(null, null);
                        }
                    };

                    redis.drop('test', function (err) {

                        expect(err).to.not.exist;
                        done();
                    });
                });
            });
        });
    }
});
