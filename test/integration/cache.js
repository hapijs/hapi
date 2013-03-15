// Load modules

var Lab = require('lab');
var Stream = require('stream');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Cache', function () {

    var _server = null;

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

        var response = new Hapi.Response.Raw(request)
            .type('text/plain')
            .bytes(13)
            .ttl(1000);

        response.begin(function (err) {

            response.write('!hola ')
                    .write('amigos!');

            request.reply(response);
        });
    };

    function setupServer(done) {

        _server = new Hapi.Server('0.0.0.0', 0, { cache: { engine: 'memory' } });

        _server.route([
            { method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { mode: 'client', expiresIn: 120000, privacy: 'private' } } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/item2', config: { handler: activeItemHandler, cache: { mode: 'none' } } },
            { method: 'GET', path: '/item3', config: { handler: activeItemHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/bad', config: { handler: badHandler, cache: { expiresIn: 120000 } } },
            { method: 'GET', path: '/cache', config: { handler: cacheItemHandler, cache: { expiresIn: 120000, strict: true } } },
            { method: 'GET', path: '/error', config: { handler: errorHandler, cache: { expiresIn: 120000, strict: true } } },
            { method: 'GET', path: '/notcacheablenostrict', config: { handler: notCacheableHandler, cache: { expiresIn: 120000, strict: false } } },
            { method: 'GET', path: '/clientserver', config: { handler: profileHandler, cache: { mode: 'client+server', expiresIn: 120000 } } },
            { method: 'GET', path: '/serverclient', config: { handler: profileHandler, cache: { mode: 'server+client', expiresIn: 120000 } } }
        ]);

        _server.start(done);
    }

    var makeRequest = function (path, callback) {

        _server.inject({
            method: 'get',
            url: path
        }, callback);
    };

    before(setupServer);

    it('returns max-age value when route uses default cache rules', function (done) {

        makeRequest('/profile', function (rawRes) {

            expect(rawRes.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
            done();
        });
    });

    it('returns max-age value when route uses client cache mode', function (done) {

        makeRequest('/profile', function (rawRes) {

            expect(rawRes.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
            done();
        });
    });

    it('doesn\'t return max-age value when route is not cached', function (done) {

        makeRequest('/item2', function (rawRes) {

            expect(rawRes.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('throws error when returning a stream in a cached endpoint handler', function (done) {

        function test() {

            makeRequest('/bad', function (rawRes) { });
        }

        expect(test).to.throw(Error);
        done();
    });

    it('doesn\'t cache error responses', function (done) {

        makeRequest('/error', function () {

            _server.cache.get({ segment: '/error', id: '/error' }, function (err, cached) {

                expect(cached).to.not.exist;
                done();
            });
        });
    });

    it('doesn\'t send cache headers for responses with status codes other than 200', function (done) {

        makeRequest('/nocache', function (res) {

            expect(res.headers['cache-control']).to.equal('no-cache');
            done();
        });
    });

    it('caches responses with status codes of 200', function (done) {

        makeRequest('/cache', function () {

            _server.cache.get({ segment: '/cache', id: '/cache' }, function (err, cached) {

                expect(cached).to.exist;
                done();
            });
        });
    });

    it('doesn\'t throw an error when requesting a non-strict route that is not cacheable', function (done) {

        makeRequest('/notcacheablenostrict', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('throws an error when requesting a strict cached route that is not cacheable', function (done) {

        var server = new Hapi.Server('0.0.0.0', 18885, { cache: { engine: 'memory' } });
        server.route({ method: 'GET', path: '/notcacheable', config: { handler: notCacheableHandler, cache: { expiresIn: 120000, strict: true } } });

        var fn = function () {

            server.inject({
                method: 'get',
                url: 'http://127.0.0.1:18885/notcacheable'
            });
        };

        expect(fn).to.throw(Error, 'Attempted to cache non-cacheable item');
        done();
    });

    it('caches server+client the same as client+server', function (done) {

        makeRequest('/serverclient', function (res1) {

            _server.cache.get({ segment: '/serverclient', id: '/serverclient' }, function (err1, cached1) {

                expect(cached1).to.exist;
                expect(res1.headers['cache-control']).to.equal('max-age=120, must-revalidate');


                makeRequest('/clientserver', function (res2) {

                    _server.cache.get({ segment: '/clientserver', id: '/clientserver' }, function (err2, cached2) {

                        expect(cached2).to.exist;
                        expect(res2.headers['cache-control']).to.equal('max-age=120, must-revalidate');
                        expect(cached1.item.payload).to.equal(cached2.item.payload);
                        done();
                    });
                });
            });
        });
    });
});
