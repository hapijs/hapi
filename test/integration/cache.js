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

    var server = new Hapi.Server(0, { debug: false, cache: [{ engine: 'memory', name: 'secondary' }] });

    server.helper('profile', function (id, next) {
        
        next({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    }, { cache: { expiresIn: 120000 } });
    
    var profileHandler = function (request, reply) {

        server.helpers.profile(0, reply);
    };

    var activeItemHandler = function (request, reply) {

        reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    };

    var cacheItemHandler = function (request, reply) {

        reply('hello');
    };

    var errorHandler = function (request, reply) {

        var error = new Error('myerror');
        error.statusCode = 500;

        reply(error);
    };

    server.route([
        { method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } },
        { method: 'GET', path: '/item', config: { handler: activeItemHandler, cache: { expiresIn: 120000 } } },
        { method: 'GET', path: '/item2', config: { handler: activeItemHandler } },
        { method: 'GET', path: '/item3', config: { handler: activeItemHandler, cache: { expiresIn: 120000 } } },
    ]);

    before(function (done) {

        server.start(done);
    });

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

    it('does not return max-age value when route is not cached', function (done) {

        server.inject('/item2', function (res) {

            expect(res.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('does not send cache headers for responses with status codes other than 200', function (done) {

        server.inject('/nocache', function (res) {

            expect(res.headers['cache-control']).to.equal('no-cache');
            done();
        });
    });

    it('caches using non default cache', function (done) {

        var server = new Hapi.Server(0, { cache: { name: 'primary', engine: 'memory' } });
        var _default = server.cache('a', { expiresIn: 2000 });
        var primary = server.cache('a', { expiresIn: 2000, cache: 'primary' });

        server.start(function (err) {

            expect(err).to.not.exist;

            _default.set('b', 1, null, function (err) {

                expect(err).to.not.exist;

                primary.set('b', 2, null, function (err) {

                    expect(err).to.not.exist;

                    _default.get('b', function (err, cached) {

                        expect(err).to.not.exist;
                        expect(cached.item).to.equal(1);

                        primary.get('b', function (err, cached) {

                            expect(err).to.not.exist;
                            expect(cached.item).to.equal(2);
                            done();
                        });
                    });
                });
            });
        });
    });
});
