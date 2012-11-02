// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Redis = require(libPath + 'cache/redis');


require('../suite')(function (useRedis, useMongo) {

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
