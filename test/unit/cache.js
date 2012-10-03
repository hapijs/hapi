// Load modules

var expect = require('chai').expect;
var Cache = process.env.TEST_COV ? require('../../lib-cov/cache/index') : require('../../lib/cache/index');
var Rules = process.env.TEST_COV ? require('../../lib-cov/cache/rules') : require('../../lib/cache/rules');
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
                mode: 'none',
                expiresInSec: 50
            } ;
            var rule = Rules.compile(config);

            expect(rule.mode).to.equal(config.mode);
            expect(rule.expiresInSec).to.not.exist;

            done();
        });

        it('assigns the expiresInSec when the rule is cached', function(done) {
            var config = {
                mode: 'server',
                expiresInSec: 50
            } ;
            var rule = Rules.compile(config);

            expect(rule.mode).to.equal(config.mode);
            expect(rule.expiresInSec).to.equal(config.expiresInSec);

            done();
        });

        it('doesn\'t allow a single rule to contain a match', function(done) {
            var config = {
                mode: 'server',
                expiresInSec: 50,
                match: /test/
            } ;
            var rule = Rules.compile(config);

            expect(rule).to.be.an.instanceOf(Error);

            done();
        });

        it('each rule in an array of rules must contain a match property', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50
            }, {
                mode: 'server+headers',
                expiresInSec: 40
            }];
            var rules = Rules.compile(config);

            expect(rules).to.be.an.instanceOf(Error);

            done();
        });

        it('compiles an array of rules', function(done) {
            var config = [{
                mode: 'none',
                expiresInSec: 50,
                match: /test/
            }, {
                mode: 'server+headers',
                expiresInSec: 40,
                match: /test2/
            }];
            var rules = Rules.compile(config);

            expect(rules[0].mode).to.equal('none');
            expect(rules[1].mode).to.equal('server+headers');
            expect(rules[0].expiresInSec).to.not.exist;
            expect(rules[1].expiresInSec).to.equal(40);

            done();
        });

        it('each rule must have a regex match property', function(done) {
            var config = [{
                mode: 'headers',
                expiresInSec: 50,
                match: function() {}
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: function() {}
            }];
            var rules = Rules.compile(config);

            expect(rules).to.be.an.instanceOf(Error);

            done();
        });

        it('returns an error when parsing a bad expiresAt value', function(done) {
            var config = [{
                mode: 'server',
                expiresAt: 50,
                match: function() {}
            }, {
                mode: 'server',
                expiresAt: 40,
                match: function() {}
            }];
            var rules = Rules.compile(config);

            expect(rules).to.be.an.instanceOf(Error);

            done();
        });
    });

    describe('#match', function() {

        it('returns a rule that has a matching key', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50,
                match: /test/
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: /test2/
            }];
            var rules = Rules.compile(config);
            var rule = Rules.match('test', rules);

            expect(rule.expiresInSec).to.equal(50);
            done();
        });

        it('returns a null when no matching rule is found', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50,
                match: /^test$/
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: /^test2$/
            }];
            var rules = Rules.compile(config);
            var rule = Rules.match('test3', rules);

            expect(rule).to.not.exist;
            done();
        });
    });

    describe('#isCached', function() {

        it('returns true when a matching rule is cached', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50,
                match: /test$/
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: /test2$/
            }];
            var rules = Rules.compile(config);
            var isCached = Rules.isCached('test', rules, 'server');

            expect(isCached).to.be.true;
            done();
        });

        it('returns false when a matching rule is not cached', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50,
                match: /^test$/
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: /^test2$/
            }];
            var rules = Rules.compile(config);
            var isCached = Rules.isCached('test', rules);

            expect(isCached).to.be.false;
            done();
        });
    });

    describe('#isExpired', function() {

        it('returns true when a matching rule is expired', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50,
                match: /test$/
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: /test2$/
            }];
            var rules = Rules.compile(config);
            var created = new Date(Date.now());
            created = created.setMinutes(created.getMinutes() - 5);

            var isExpired = Rules.isExpired('test', rules, created);
            expect(isExpired).to.be.true;
            done();
        });

        it('returns false when a matching rule is not expired', function(done) {
            var config = [{
                mode: 'server',
                expiresInSec: 50,
                match: /test$/
            }, {
                mode: 'server',
                expiresInSec: 40,
                match: /test2$/
            }];
            var rules = Rules.compile(config);
            var created = new Date(Date.now());
            created = created.setSeconds(created.getSeconds() - 5);

            var isExpired = Rules.isExpired('test', rules, created);
            expect(isExpired).to.be.false;
            done();
        });
    });
});