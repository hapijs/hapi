// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../../lib-cov/' : '../../../lib/';
var Redis = require(libPath + 'cache/redis');


require('./suite')(function (useRedis) {

    if (useRedis) {
        describe('Redis', function() {

            it('throws an error if not created with new', function(done) {

                var fn = function () {

                    var redis = Redis.Connection();
                };

                expect(fn).to.throw(Error);
                done();
            });

            describe('#start', function() {

                it('sets client to when the connection succeeds', function(done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.start(function(err, result) {

                        expect(err).to.not.exist;
                        expect(result).to.not.exist;
                        expect(redis.client).to.exist;
                        done();
                    });
                });

                it('returns an error when connection fails', function(done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6380
                    };

                    var redis = new Redis.Connection(options);

                    redis.start(function(err, result) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(redis.client).to.not.exist;
                        done();
                    });
                });
            });

            describe('#validateSegmentName', function() {

                it('returns an error when the name is empty', function(done) {

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

                it('returns an error when the name has a null character', function(done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    var result = redis.validateSegmentName('\0test');

                    expect(result).to.be.instanceOf(Error);
                    done();
                });

                it('returns null when there aren\'t any errors', function(done) {

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

            describe('#get', function() {

                it('passes an error to the callback when the connection is closed', function(done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.get('test', function(err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });

                it('is able to retrieve an object thats stored when connection is started', function(done) {

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

                    redis.start(function() {

                        redis.set(key, 'myvalue', 200, function(err) {

                            expect(err).to.not.exist;
                            redis.get(key, function(err, result) {

                                expect(err).to.not.exist;
                                expect(result.item).to.equal('myvalue');
                                done();
                            });
                        });
                    });
                });

                it('returns null when unable to find the item', function(done) {

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

                    redis.start(function() {

                        redis.get(key, function(err, result) {

                            expect(err).to.not.exist;
                            expect(result).to.not.exist;
                            done();
                        });
                    });
                });
            });

            describe('#set', function() {

                it('passes an error to the callback when the connection is closed', function(done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.set('test1', 'test1', 3600, function(err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });
            });

            describe('#drop', function() {

                it('passes an error to the callback when the connection is closed', function(done) {

                    var options = {
                        host: '127.0.0.1',
                        port: 6379
                    };

                    var redis = new Redis.Connection(options);

                    redis.drop('test2', function(err) {

                        expect(err).to.exist;
                        expect(err).to.be.instanceOf(Error);
                        expect(err.message).to.equal('Connection not started');
                        done();
                    });
                });
            });
        });
    }
});
