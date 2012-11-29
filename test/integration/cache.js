// Load modules

var expect = require('chai').expect;
var Stream = require('stream');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


describe('Cache', function() {

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:17785';

    var profileHandler = function (request) {

        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    };

    var activeItemHandler = function (request) {

        request.reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    };

    var cacheItemHandler = function (request) {

        var cacheable = new Hapi.Response.Text('hello');
        cacheable._code = 200;

        request.reply(cacheable);
    };

    var badHandler = function (request) {

        request.reply(new Stream);
    };

    var errorHandler = function (request) {

        var error = new Error('myerror');
        error.code = 500;

        request.reply(error);
    };

    var notCacheableHandler = function (request) {

        var response = new Hapi.Response.Direct(request)
            .type('text/plain')
            .bytes(13)
            .ttl(1000)
            .write('!hola ')
            .write('amigos!');

        request.reply(response);
    };

    function setupServer(done) {

        _server = new Hapi.Server('0.0.0.0', 17785, { cache: { engine: 'memory' } });

        _server.addRoutes([
            { method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/item2', config: { handler: activeItemHandler, cache: { mode: 'none' } } },
            { method: 'GET', path: '/item3', config: { handler: activeItemHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/bad', config: { handler: badHandler, cache: { expiresIn: 120000 } } },
            { method: 'GET', path: '/cache', config: { handler: cacheItemHandler, cache: { expiresIn: 120000, strict: true } } },
            { method: 'GET', path: '/error', config: { handler: errorHandler, cache: { expiresIn: 120000, strict: true } } },
            { method: 'GET', path: '/notcacheablenostrict', config: { handler: notCacheableHandler, cache: { expiresIn: 120000, strict: false } } }
        ]);

        done();
    }

    function makeRequest(path, callback) {

        var next = function(res) {

            return callback(res);
        };

        _server.inject({
            method: 'get',
            url: _serverUrl + path
        }, next);
    }

    function parseHeaders(res) {

        var headersObj = {};
        var headers = res._header.split('\r\n');

        for (var i = 0, il = headers.length; i < il; i++) {
            var header = headers[i].split(':');
            var headerValue = header[1] ? header[1].trim() : '';
            headersObj[header[0]] = headerValue;
        }

        return headersObj;
    }

    before(setupServer);

    it('returns max-age value when route uses default cache rules', function(done) {

        makeRequest('/profile', function(rawRes) {

            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Cache-Control']).to.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('returns max-age value when route uses client cache mode', function(done) {

        makeRequest('/profile', function(rawRes) {

            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Cache-Control']).to.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('doesn\'t return max-age value when route is not cached', function(done) {

        makeRequest('/item2', function(rawRes) {

            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Cache-Control']).to.not.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('throws error when returning a stream in a cached endpoint handler', function (done) {

        function test() {

            makeRequest('/bad', function (rawRes) {});
        }

        expect(test).to.throw(Error);
        done();
    });

    it('doesn\'t cache error responses', function(done) {

        makeRequest('/error', function() {

            _server.cache.get({ segment: '/error', id: '/error' }, function(err, cached) {

                expect(cached).to.not.exist;
                done();
            });
        });
    });

    it('doesn\'t send cache headers for responses with status codes other than 200', function(done) {

        makeRequest('/nocache', function(res) {

            expect(res.headers['Cache-Control']).to.equal('no-cache');
            done();
        });
    });

    it('caches responses with status codes of 200', function(done) {

        makeRequest('/cache', function() {

            _server.cache.get({ segment: '/cache', id: '/cache' }, function(err, cached) {

                expect(cached).to.exist;
                done();
            });
        });
    });

    it('doesn\'t throw an error when requesting a non-strict route that is not cacheable', function(done) {

        makeRequest('/notcacheablenostrict', function(res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('throws an error when requesting a strict cached route that is not cacheable', function(done) {

        var server = new Hapi.Server('0.0.0.0', 18885, { cache: { engine: 'memory' } });
        server.addRoute({ method: 'GET', path: '/notcacheable', config: { handler: notCacheableHandler, cache: { expiresIn: 120000, strict: true } } });

        var fn = function() {

            server.inject({
                method: 'get',
                url: 'http://127.0.0.1:18885/notcacheable'
            });
        };

        expect(fn).to.throw(Error, 'Attempted to cache non-cacheable item');
        done();
    });
});
