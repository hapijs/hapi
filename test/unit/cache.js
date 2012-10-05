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

            expect(rule.expiresInSec).to.equal(config.expiresInSec);

            done();
        });

        it('assigns the expiresInSec when the rule is cached', function(done) {
            var config = {
                expiresInSec: 50
            } ;
            var rule = Cache.compile(config);

            expect(rule.expiresInSec).to.equal(config.expiresInSec);

            done();
        });

        it('returns an error when parsing a bad expiresAt value', function(done) {
            var config = {
                expiresAt: function() { }
            };
            var rule = Cache.compile(config);

            expect(rule).to.be.an.instanceOf(Error);

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
            expect(ttl).to.equal(50);
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
            var hour = new Date(Date.now()).getHours() + 1;

            var config = {
                expiresAt: hour + ':00'
            };

            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule);
            expect(ttl).to.be.greaterThan(0);
            done();
        });

        it('returns the correct number when using a future expiresAt', function(done) {
            var hour = new Date(Date.now()).getHours() - 2;

            var config = {
                expiresAt: hour + ':00'
            };
            var created = new Date(Date.now());
            created.setHours(hour + 1);
            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.be.closeTo(22 * 60 * 60, 60 * 60);
            done();
        });

        it('returns correct number when using an expiresAt time tomorrow', function(done) {
            var hour = new Date(Date.now()).getHours() - 1;

            var config = {
                expiresAt: hour + ':00'
            };

            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule);
            expect(ttl).to.be.closeTo(23 * 60 * 60, 60 * 60);
            done();
        });

        it('returns correct number when using a created time from yesterday and expires in 2 hours', function(done) {
            var hour = new Date(Date.now()).getHours() + 2;

            var config = {
                expiresAt: hour + ':00'
            };
            var created = new Date(Date.now());
            created.setHours(new Date(Date.now()).getHours() - 22);

            var rule = Cache.compile(config);

            var ttl = Cache.ttl(rule, created);
            expect(ttl).to.be.closeTo(60 * 60, 60 * 60);
            done();
        });
    });
});