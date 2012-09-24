// Load modules

var expect = require('chai').expect;
var Route = require('../../lib/route');


describe('Route', function() {
    var _serverDefaults = {
        router: {
            isTrailingSlashSensitive: false,            // Tread trailing '/' in path as different resources
            isCaseSensitive: true                       // Case-seinsitive paths
        },
        payload: {
            maxBytes: 1024 * 1024
        },
        cors: {
            origin: ['*'],
            maxAge: 86400,                              // One day
            headers: [
                'Authorization',
                'Content-Type',
                'If-None-Match'
            ],
            additionalHeaders: [],
            methods: [
                'GET',
                'HEAD',
                'POST',
                'PUT',
                'DELETE',
                'OPTIONS'
            ],
            additionalMethods: []
        },
        ext: {
            onRequest: null,
            onPreHandler: null,
            onPostHandler: null,
            onPostRoute: null,
            onUnknownRoute: null
        },
        errors: {
            format: null
        },
        monitor: false,
        authentication: false,
        cache: false,
        debug: false,
        docs: false
    };

    var _server = {
        settings: _serverDefaults
    };

    var _handler = function(request) {
        request.reply('ok');
    };

    it('throws an error if Route is constructed without new', function(done) {
        var fn = function() {
            Route({}, _server);
        };
        expect(fn).throws(Error, 'Route must be instantiated using new');
        done();
    });

    it('throws an error if the path is missing', function(done) {
        var fn = function() {
            var route = new Route({}, _server);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error if the path doesn\'t start with a /', function(done) {
        var fn = function() {
            var route = new Route({ path: 'test' }, _server);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error if the method is missing', function(done) {
        var fn = function() {
            var route = new Route({ path: '/test' }, _server);
        };
        expect(fn).throws(Error, 'Route options missing method');
        done();
    });

    it('doesn\'t throw an error when a method is present', function(done) {
        var fn = function() {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, _server);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error if the handler is missing', function(done) {
        var fn = function() {
            var route = new Route({ path: '/test', method: 'get', handler: null }, _server);
        };
        expect(fn).throws(Error, 'Handler must appear once and only once');
        done();
    });

    describe('#match', function() {
        it('returns true when called with a matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, _server);
            var request = {
                path: '/test',
                method: 'get'
            };

            expect(route.match(request)).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, _server);
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
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, _server);

            expect(route.test('/test')).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function(done) {
            var route = new Route({ path: '/test', method: 'get', handler: _handler }, _server);

            expect(route.test('/test2')).to.be.false;
            done();
        });
    });
});