// Load modules

var expect = require('chai').expect;
var Cache = process.env.TEST_COV ? require('../../lib-cov/cache/index') : require('../../lib/cache/index');
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

        var client = new Cache.Client(options);
        expect(client).to.exist;

        var fn = function() {
            redisMock.verify();
        };

        expect(fn).to.not.throw(Error);
        require.cache[require.resolve('redis')] = null;
        done();
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
            var rule = Cache.compile(config);

            expect(rule.mode.server).to.equal(true);
            expect(rule.mode.client).to.equal(true);
            expect(Object.keys(rule.mode).length).to.equal(2);

            done();
        });

        it('is disabled when mode is none', function (done) {
            var config = {
                mode: 'none'
            };
            var rule = Cache.compile(config);

            expect(Object.keys(rule.mode).length).to.equal(0);

            done();
        });

        it('is disabled when mode is none', function (done) {
            var config = {
                mode: 'none',
                expiresInSec: 50
            };
            var fn = function () {
                Cache.compile(config);
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
                Cache.compile(config);
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

        it('returns the correct number when using a future expiresAt', function(done) {
            var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            var hours = twoHoursAgo.getHours();
            var minutes = '' + twoHoursAgo.getMinutes();
            var created = twoHoursAgo.getTime() + (60 * 60 * 1000);
            minutes = minutes.length === 1 ? '0' + minutes : minutes;

            var config = {
                expiresAt: hours + ':' + minutes
            };

            var rule = Cache.compile(config);
            var ttl = Cache.ttl(rule, created);

            expect(ttl).to.be.closeTo(22 * 60 * 60 * 1000, 60 * 1000);
            done();
        });

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

    describe('Stale', function() {

        describe('#compile', function() {

            it('throws an error if has only staleTimeoutMSec or staleInSec', function(done) {
                var config = {
                    mode: 'server',
                    staleInSec: 30,
                    expiresInSec: 60
                };

                var fn = function() {
                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('doesn\'t throw an error if has both staleTimeoutMSec and staleInSec', function(done) {
                var config = {
                    mode: 'server',
                    staleInSec: 30,
                    staleTimeoutMSec: 300,
                    expiresInSec: 60
                };

                var fn = function() {
                    Cache.compile(config);
                };
                expect(fn).to.not.throw(Error);
                done();
            });

            it('throws an error if trying to use stale caching on the client', function(done) {
                var config = {
                    mode: 'client',
                    staleInSec: 30,
                    expiresInSec: 60,
                    staleTimeoutMSec: 300
                };

                var fn = function() {
                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('converts the stale time to ms', function(done) {
                var config = {
                    mode: 'server+client',
                    staleInSec: 30,
                    expiresInSec: 60,
                    staleTimeoutMSec: 300
                };

                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(config.staleInSec * 1000);
                done();
            });

            it('throws an error if staleTimeoutMSec is greater than expiresInSec', function(done) {
                var config = {
                    mode: 'client',
                    staleInSec: 2,
                    expiresInSec: 1,
                    staleTimeoutMSec: 3000
                };

                var fn = function() {
                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('throws an error if staleInSec is greater than expiresInSec', function(done) {
                var config = {
                    mode: 'client',
                    staleInSec: 1,
                    expiresInSec: 60,
                    staleTimeoutMSec: 30
                };

                var fn = function() {
                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });
        });
    });
});

