// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../../lib-cov') : require('../../../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Stale', function () {

    it('returns stale object then fresh object based on timing when calling a helper using the cache with stale config', function (done) {

        var options = {
            cache: {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5
            }
        };

        var gen = 0;
        var method = function (id, next) {

            setTimeout(function () {

                return next({ id: id, gen: ++gen });
            }, 6);
        };

        var server = new Hapi.Server('0.0.0.0', 8097, { cache: 'memory' });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            expect(result1.gen).to.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    expect(result2.gen).to.equal(1);     // Stale
                    setTimeout(function () {

                        server.helpers.user(id, function (result3) {

                            expect(result3.gen).to.equal(2);     // Fresh
                            done();
                        });
                    }, 3);
                });
            }, 21);
        });
    });

    it('returns stale object then invalidate cache on error when calling a helper using the cache with stale config', function (done) {

        var options = {
            cache: {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 5
            }
        };

        var gen = 0;
        var method = function (id, next) {

            setTimeout(function () {

                if (gen !== 1) {
                    return next({ id: id, gen: ++gen });
                }
                else {
                    ++gen;
                    return next(new Error());
                }
            }, 6);
        };

        var server = new Hapi.Server('0.0.0.0', 8097, { cache: 'memory' });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            expect(result1.gen).to.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    // Generates a new one in background which will produce Error and clear the cache

                    if (result2.gen !== undefined) {
                        expect(result2.gen).to.equal(1);     // Stale
                    }

                    setTimeout(function () {

                        server.helpers.user(id, function (result3) {

                            expect(result3.gen).to.equal(3);     // Fresh
                            done();
                        });
                    }, 3);
                });
            }, 21);
        });
    });

    it('returns fresh object calling a helper using the cache with stale config', function (done) {

        var options = {
            cache: {
                expiresIn: 100,
                staleIn: 20,
                staleTimeout: 10
            }
        };

        var gen = 0;
        var method = function (id, next) {

            return next({ id: id, gen: ++gen });
        };

        var server = new Hapi.Server('0.0.0.0', 8097, { cache: 'memory' });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            expect(result1.gen).to.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    expect(result2.gen).to.equal(2);     // Fresh

                    setTimeout(function () {

                        server.helpers.user(id, function (result3) {

                            expect(result3.gen).to.equal(2);     // Fresh
                            done();
                        });
                    }, 1);
                });
            }, 21);
        });
    });

    it('returns a valid result when calling a helper using the cache with bad cache connection', function (done) {

        var server = new Hapi.Server('0.0.0.0', 8097, { cache: 'memory' });
        server.cache.stop();
        var gen = 0;
        server.addHelper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
        var id = Math.random();
        server.helpers.user(id, function (result1) {

            expect(result1.id).to.equal(id);
            expect(result1.gen).to.equal(1);
            server.helpers.user(id, function (result2) {

                expect(result2.id).to.equal(id);
                expect(result2.gen).to.equal(2);
                done();
            });
        });
    });

    it('returns error when calling a helper using the cache with stale config when arrives within stale timeout', function (done) {

        var options = {
            cache: {
                expiresIn: 30,
                staleIn: 20,
                staleTimeout: 5
            }
        };

        var gen = 0;
        var method = function (id, next) {

            if (gen !== 1) {
                return next({ id: id, gen: ++gen });
            }
            else {
                ++gen;
                return next(new Error());
            }
        };

        var server = new Hapi.Server('0.0.0.0', 8097, { cache: 'memory' });
        server.addHelper('user', method, options);

        var id = Math.random();
        server.helpers.user(id, function (result1) {

            expect(result1.gen).to.equal(1);     // Fresh
            setTimeout(function () {

                server.helpers.user(id, function (result2) {

                    // Generates a new one which will produce Error

                    expect(result2).to.instanceof(Error);     // Stale
                    done();
                });
            }, 21);
        });
    });
});

