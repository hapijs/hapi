// Load modules

var expect = require('chai').expect;
var Cache = process.env.TEST_COV ? require('../../lib-cov/cache/index') : require('../../lib/cache/index');
var Server = process.env.TEST_COV ? require('../../lib-cov/server') : require('../../lib/server');
var Defaults = process.env.TEST_COV ? require('../../lib-cov/defaults') : require('../../lib/defaults');
var Sinon = require('sinon');

describe('Client', function() {

    it('throws an error if not using the redis engine', function(done) {
        var fn = function() {
            var options = {
                engine: 'bob'
            };

            var client = new Cache.Client(options);
        };

        expect(fn).to.throw(Error);
        done();
    });

    it('creates a new connection when using redis', function(done) {
        var redisMock = Sinon.mock(require('redis'));
        require.cache[require.resolve('redis')] = redisMock;

        var options = {
            engine: 'redis'
        };

        var client = new Cache.Client('test', options);
        expect(client).to.exist;

        var fn = function() {
            redisMock.verify();
        };

        expect(fn).to.not.throw(Error);
        require.cache[require.resolve('redis')] = null;
        done();
    });

    it('returns not found on get when using null key', function (done) {
        var client = new Cache.Client('test', Defaults.cache);
        client.get(null, function (err, result) {

            expect(err).to.equal(null);
            expect(result).to.equal(null);
            done();
        });
    });

    it('returns error on set when using null key', function (done) {
        var client = new Cache.Client('test', Defaults.cache);
        client.set(null, {}, 1000, function (err) {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });

    it('returns error on drop when using null key', function (done) {
        var client = new Cache.Client('test', Defaults.cache);
        client.drop(null, function (err) {

            expect(err instanceof Error).to.equal(true);
            done();
        });
    });
});

describe('Cache Rules', function() {

    describe('#compile', function() {

        it('compiles a single rule', function(done) {
            var config = {
                expiresInSec: 50
            } ;
            var rule = Cache.compile(config);

            expect(rule.expiresIn).to.equal(config.expiresInSec * 1000);

            done();
        });

        it('is enabled for both client and server by defaults', function (done) {
            var config = {
                expiresInSec: 50
            };
            var cache = new Cache.Policy('test', config, {});

            expect(cache.isMode('server')).to.equal(true);
            expect(cache.isMode('client')).to.equal(true);
            expect(Object.keys(cache.rule.mode).length).to.equal(2);

            done();
        });

        it('is disabled when mode is none', function (done) {
            var config = {
                mode: 'none'
            };
            var cache = new Cache.Policy('test', config, {});

            expect(cache.isEnabled()).to.equal(false);
            expect(Object.keys(cache.rule.mode).length).to.equal(0);

            done();
        });

        it('throws an error when mode is none and config has other options set', function (done) {
            var config = {
                mode: 'none',
                expiresInSec: 50
            };
            var fn = function () {
                var cache = new Cache.Policy('test', config, {});
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('assigns the expiresInSec when the rule is cached', function(done) {
            var config = {
                expiresInSec: 50
            } ;
            var rule = Cache.compile(config);

            expect(rule.expiresIn).to.equal(config.expiresInSec * 1000);

            done();
        });

        it('throws an error when parsing a rule with both expiresAt and expiresInSec', function (done) {
            var config = {
                expiresAt: 50,
                expiresInSec: '02:00'
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when parsing a rule with niether expiresAt or expiresInSec', function (done) {
            var config = {
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when parsing a bad expiresAt value', function (done) {
            var config = {
                expiresAt: function () { }
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleInSec is used without staleTimeoutMSec', function (done) {
            var config = {
                expiresAt: '03:00',
                staleInSec: 1000
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeoutMSec is used without staleInSec', function (done) {
            var config = {
                expiresAt: '03:00',
                staleTimeoutMSec: 100
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleInSec is greater than a day and using expiresAt', function (done) {
            var config = {
                expiresAt: '03:00',
                staleInSec: 100000,
                staleTimeoutMSec: 500
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleInSec is greater than expiresInSec', function (done) {
            var config = {
                expiresInSec: 500,
                staleInSec: 1000,
                staleTimeoutMSec: 500
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeoutMSec is greater than expiresInSec', function (done) {
            var config = {
                expiresInSec: 500,
                staleInSec: 100,
                staleTimeoutMSec: 500000
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeoutMSec is greater than expiresInSec - staleInSec', function (done) {
            var config = {
                expiresInSec: 30,
                staleInSec: 20,
                staleTimeoutMSec: 10000
            };
            var fn = function () {
                Cache.compile(config);
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('throws an error when staleTimeoutMSec is used without server mode', function (done) {
            var config = {
                mode: 'client',
                expiresInSec: 1000,
                staleInSec: 500,
                staleTimeoutMSec: 500
            };
            var fn = function () {
                var cache = new Cache.Policy('test', config, {});
            };

            expect(fn).to.throw(Error);

            done();
        });

        it('returns rule when staleInSec is less than expiresInSec', function(done) {
            var config = {
                expiresInSec: 1000,
                staleInSec: 500,
                staleTimeoutMSec: 500
            };
            var rule = Cache.compile(config);

            expect(rule.staleIn).to.equal(500 * 1000);
            expect(rule.expiresIn).to.equal(1000 * 1000);

            done();
        });

        it('returns rule when staleInSec is less than 24 hours and using expiresAt', function(done) {
            var config = {
                expiresAt: '03:00',
                staleInSec: 5000,
                staleTimeoutMSec: 500
            };
            var rule = Cache.compile(config);

            expect(rule.staleIn).to.equal(5000 * 1000);

            done();
        });
    });

    describe('#ttl', function() {

        it('returns zero when a rule is expired', function(done) {
            var config = {
                expiresInSec: 50
            };
            var rule = Cache.compile(config);
            var created = new Date(Date.now());
            created = created.setMinutes(created.getMinutes() - 5);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.be.equal(0);
            done();
        });

        it('returns a positive number when a rule is not expired', function(done) {
            var config = {
                expiresInSec: 50
            };
            var rule = Cache.compile(config);
            var created = new Date(Date.now());

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct expires time when no created time is provided', function(done) {
            var config = {
                expiresInSec: 50
            };
            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule);
            expect(ttl).to.equal(50000);
            done();
        });

        it('returns 0 when created several days ago and expiresAt is used', function(done) {
            var config = {
                expiresAt: '13:00'
            };
            var created = new Date(Date.now());
            created.setHours(15);
            created = new Date(created.setDate(created.getDay() - 4)).getTime();
            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns the 0 when created several days ago and expiresAt is used with an hour before the created hour', function(done) {
            var config = {
                expiresAt: '12:00'
            };
            var created = new Date(Date.now());
            created.setHours(10);
            created = new Date(created.setDate(created.getDay() - 4)).getTime();
            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.equal(0);
            done();
        });

        it('returns a positive number when using a future expiresAt', function(done) {
            var hour = new Date(Date.now() + 60 * 60 * 1000).getHours();

            var config = {
                expiresAt: hour + ':00'
            };

            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

/*        it('returns the correct number when using a future expiresAt', function(done) {
            var hour = new Date(Date.now() - 2 * 60 * 60 * 1000).getHours();

            var config = {
                expiresAt: hour + ':00'
            };
            var created = new Date(Date.now());
            created.setHours(hour + 1);
            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.be.closeTo(22 * 60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });
        */
        it('returns correct number when using an expiresAt time tomorrow', function(done) {
            var hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

            var config = {
                expiresAt: hour + ':00'
            };

            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule);
            expect(ttl).to.be.closeTo(23 * 60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });

        it('returns correct number when using a created time from yesterday and expires in 2 hours', function(done) {
            var hour = new Date(Date.now() + 2 * 60 * 60 * 1000).getHours();

            var config = {
                expiresAt: hour + ':00'
            };
            var created = new Date(Date.now());
            created.setHours(new Date(Date.now()).getHours() - 22);

            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.be.closeTo(60 * 60 * 1000, 60 * 60 * 1000);
            done();
        });
    });
});


describe('Stale', function () {

    it('returns stale object then fresh object based on timing when calling a helper using the cache with stale config', function (done) {

        var options = {
            cache: {
                expiresInSec: 2,
                staleInSec: 1,
                staleTimeoutMSec: 100
            }
        };

        var gen = 0;
        var method = function (id, next) {

            setTimeout(function () {

                return next({ id: id, gen: ++gen });
            }, 110);
        };

        var server = new Server('0.0.0.0', 8097, { cache: true });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            result1.gen.should.be.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    result2.gen.should.be.equal(1);     // Stale
                    setTimeout(function () {

                        server.helpers.user(id, function (result3) {

                            result3.gen.should.be.equal(2);     // Fresh
                            done();
                        });
                    }, 50);
                });
            }, 1010);
        });
    });

    it('returns stale object then invalidate cache on error when calling a helper using the cache with stale config', function (done) {

        var options = {
            cache: {
                expiresInSec: 2,
                staleInSec: 1,
                staleTimeoutMSec: 100
            }
        };

        var gen = 0;
        var method = function (id, next) {

            setTimeout(function () {

                if (gen !== 1) {
                    return next({ id: id, gen: ++gen });
                }
                else {
                    ++gen;
                    return next(new Error());
                }
            }, 110);
        };

        var server = new Server('0.0.0.0', 8097, { cache: true });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            result1.gen.should.be.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    // Generates a new one in background which will produce Error and clear the cache

                    result2.gen.should.be.equal(1);     // Stale

                    setTimeout(function () {

                        server.helpers.user(id, function (result3) {

                            result3.gen.should.be.equal(3);     // Fresh
                            done();
                        });
                    }, 50);
                });
            }, 1010);
        });
    });

    it('returns fresh object calling a helper using the cache with stale config', function (done) {

        var options = {
            cache: {
                expiresInSec: 2,
                staleInSec: 1,
                staleTimeoutMSec: 100
            }
        };

        var gen = 0;
        var method = function (id, next) {

            return next({ id: id, gen: ++gen });
        };

        var server = new Server('0.0.0.0', 8097, { cache: true });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            result1.gen.should.be.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    result2.gen.should.be.equal(2);     // Fresh

                    setTimeout(function () {

                        server.helpers.user(id, function (result3) {

                            result3.gen.should.be.equal(2);     // Fresh
                            done();
                        });
                    }, 50);
                });
            }, 1010);
        });
    });

    it('returns a valid result when calling a helper using the cache with bad cache connection', function (done) {

        var server = new Server('0.0.0.0', 8097, { cache: true });
        server.cache.stop();
        var gen = 0;
        server.addHelper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresInSec: 2 } });
        var id = Math.random();
        server.helpers.user(id, function (result1) {

            result1.id.should.be.equal(id);
            result1.gen.should.be.equal(1);
            server.helpers.user(id, function (result2) {

                result2.id.should.be.equal(id);
                result2.gen.should.be.equal(2);
                done();
            });
        });
    });
});

