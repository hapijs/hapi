// Load modules

var expect = require('chai').expect;
var Route = process.env.TEST_COV ? require('../../lib-cov/route') : require('../../lib/route');
var ServerMock = require('./mocks/server');


describe('Route', function() {

    var _handler = function(request) {
        request.reply('ok');
    };

    it('throws an error if constructed without new', function(done) {
        var fn = function() {
            Route({}, ServerMock);
        };
        expect(fn).throws(Error, 'Route must be instantiated using new');
        done();
    });

    it('throws an error if the path is missing', function(done) {
        var fn = function() {
            var route = new Route({}, ServerMock);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error if the path doesn\'t start with a /', function(done) {
        var fn = function() {
            var route = new Route({ path: 'test' }, ServerMock);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error if the method is missing', function(done) {
        var fn = function() {
            var route = new Route({ path: '/test' }, ServerMock);
        };
        expect(fn).throws(Error, 'Route options missing method');
        done();
    });

    it('doesn\'t throw an error when a method is present', function(done) {
        var fn = function() {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error if the handler is missing', function(done) {
        var fn = function() {
            var route = new Route({ path: '/test', method: 'get', handler: null }, ServerMock);
        };
        expect(fn).throws(Error, 'Handler must appear once and only once');
        done();
    });

    describe('#match', function() {
        it('returns true when called with a matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);
            var request = {
                path: '/test',
                method: 'get'
            };

            expect(route.match(request)).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);
            var request = {
                path: '/test2',
                method: 'get'
            };

            expect(route.match(request)).to.be.false;
            done();
        });
    });

    describe('#test', function() {
        it('returns true when called with a matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);

            expect(route.test('/test')).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);

            expect(route.test('/test2')).to.be.false;
            done();
        });
    });
});