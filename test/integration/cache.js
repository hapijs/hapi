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

    var server = null;

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

        var cacheable = new Hapi.response.Text('hello');
        cacheable._code = 200;

        request.reply(cacheable);
    };

    var errorHandler = function (request) {

        var error = new Error('myerror');
        error.code = 500;

        request.reply(error);
    };

    function setupServer(done) {

        server = new Hapi.Server('0.0.0.0', 0, { debug: false });

        server.route([
            { method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler, cache: { expiresIn: 120000 } } },
            { method: 'GET', path: '/item2', config: { handler: activeItemHandler } },
            { method: 'GET', path: '/item3', config: { handler: activeItemHandler, cache: { expiresIn: 120000 } } },
            { method: 'GET', path: '/cache', config: { handler: cacheItemHandler, cache: { mode: 'client+server', expiresIn: 120000 } } },
            { method: 'GET', path: '/error', config: { handler: errorHandler, cache: { mode: 'client+server', expiresIn: 120000 } } },
            { method: 'GET', path: '/clientserver', config: { handler: profileHandler, cache: { mode: 'client+server', expiresIn: 120000 } } },
            { method: 'GET', path: '/serverclient', config: { handler: profileHandler, cache: { mode: 'server+client', expiresIn: 120000 } } }
        ]);

        server.start(done);
    }

    before(setupServer);

    it('returns max-age value when route uses default cache rules', function (done) {

        server.inject('/profile', function (res) {

            expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
            done();
        });
    });

    it('returns max-age value when route uses client cache mode', function (done) {

        server.inject('/profile', function (res) {

            expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
            done();
        });
    });

    it('doesn\'t return max-age value when route is not cached', function (done) {

        server.inject('/item2', function (res) {

            expect(res.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('doesn\'t cache error responses', function (done) {

        server.inject('/error', function () {

            server.pack._cache.get({ segment: '/error', id: '/error' }, function (err, cached) {

                expect(cached).to.not.exist;
                done();
            });
        });
    });

    it('doesn\'t send cache headers for responses with status codes other than 200', function (done) {

        server.inject('/nocache', function (res) {

            expect(res.headers['cache-control']).to.equal('no-cache');
            done();
        });
    });

    it('caches responses with status codes of 200', function (done) {

        server.inject('/cache', function () {

            server.pack._cache.get({ segment: '/cache', id: '/cache' }, function (err, cached) {

                expect(cached).to.exist;
                done();
            });
        });
    });

    it('caches server+client the same as client+server', function (done) {

        server.inject('/serverclient', function (res1) {

            server.pack._cache.get({ segment: '/serverclient', id: '/serverclient' }, function (err1, cached1) {

                expect(cached1).to.exist;
                expect(res1.headers['cache-control']).to.equal('max-age=120, must-revalidate');


                server.inject('/clientserver', function (res2) {

                    server.pack._cache.get({ segment: '/clientserver', id: '/clientserver' }, function (err2, cached2) {

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
