// Load modules

var Lab = require('lab');
var Stream = require('stream');
var Hapi = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Cache', function () {

    it('returns max-age value when route uses default cache rules', function (done) {

        var server = new Hapi.Server(0, { cache: [{ engine: 'catbox-memory', name: 'secondary' }] });

        server.method('profile', function (id, next) {

            next(null, {
                'id': 'fa0dbda9b1b',
                'name': 'John Doe'
            });
        }, { cache: { expiresIn: 120000 } });

        var profileHandler = function (request, reply) {

            server.methods.profile(0, reply);
        };

        server.route({ method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } });
        server.start(function () {

            server.inject('/profile', function (res) {

                expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
                done();
            });
        });
    });

    it('returns max-age value when route uses client cache mode', function (done) {

        var server = new Hapi.Server(0);

        server.method('profile', function (id, next) {

            next(null, {
                'id': 'fa0dbda9b1b',
                'name': 'John Doe'
            });
        }, { cache: { expiresIn: 120000 } });

        var profileHandler = function (request, reply) {

            server.methods.profile(0, reply);
        };

        server.route({ method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } });
        server.start(function () {

            server.inject('/profile', function (res) {

                expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
                done();
            });
        });
    });

    it('does not return max-age value when route is not cached', function (done) {

        var server = new Hapi.Server(0);
        var activeItemHandler = function (request, reply) {

            reply({
                'id': '55cf687663',
                'name': 'Active Item'
            });
        };

        server.route({ method: 'GET', path: '/item2', config: { handler: activeItemHandler } });
        before(function (done) {

            server.start(done);
        });

        server.inject('/item2', function (res) {

            expect(res.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
            done();
        });
    });

    it('does not send cache headers for responses with status codes other than 200', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            server.inject('/nocache', function (res) {

                expect(res.headers['cache-control']).to.equal('no-cache');
                done();
            });
        });
    });

    it('caches using non default cache', function (done) {

        var server = new Hapi.Server(0, { cache: { name: 'primary', engine: 'catbox-memory' } });
        var defaults = server.cache('a', { expiresIn: 2000 });
        var primary = server.cache('a', { expiresIn: 2000, cache: 'primary' });

        server.start(function (err) {

            expect(err).to.not.exist;

            defaults.set('b', 1, null, function (err) {

                expect(err).to.not.exist;

                primary.set('b', 2, null, function (err) {

                    expect(err).to.not.exist;

                    defaults.get('b', function (err, cached) {

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

    it('throws when allocating an invalid cache segment', function (done) {

        var server = new Hapi.Server();

        function fn() {
            server.cache('a', { expiresAt: '12:00', expiresIn: 1000 });
        }

        expect(fn).throws(Error);

        done();
    });

    it('allows allocating a cache segment with empty options', function (done) {

        var server = new Hapi.Server();
        
        function fn() {
            server.cache('a', {});
        }

        expect(fn).to.not.throw(Error);

        done();
    });
});
