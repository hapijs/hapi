// Load modules

var Lab = require('lab');
var Hapi = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Helper', function () {

    it('reuses cached helper value', function (done) {

        var gen = 0;
        var helper = function (id, next) {

            return next({ id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.helper('test', helper, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.helpers.test(1, function (result) {

                expect(result.gen).to.equal(0);

                server.helpers.test(1, function (result) {

                    expect(result.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('generates new value after cache drop', function (done) {

        var gen = 0;
        var helper = function (id, next) {

            return next({ id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.helper('dropTest', helper, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.helpers.dropTest(2, function (result) {

                expect(result.gen).to.equal(0);
                server.helpers.dropTest.cache.drop(2, function (err) {

                    expect(err).to.not.exist;

                    server.helpers.dropTest(2, function (result) {

                        expect(result.gen).to.equal(1);
                        done();
                    });
                });
            });
        });
    });

    it('errors on invalid drop key', function (done) {

        var gen = 0;
        var helper = function (id, next) {

            return next({ id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.helper('dropErrTest', helper, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.helpers.dropErrTest.cache.drop(function () {}, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    it('throws an error when name is not a string', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.helper(0, function () { });
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when method is not a function', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.helper('user', 'function');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when options is not an object', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.helper('user', function () { }, 'options');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when options.generateKey is not a function', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.helper('user', function () { }, { generateKey: 'function' });
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when options.cache is not valid', function (done) {

        var fn = function () {

            var server = new Hapi.Server({ cache: 'memory' });
            server.helper('user', function () { }, { cache: { x: 'y' } });
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('returns a valid result when calling a helper without using the cache', function (done) {

        var server = new Hapi.Server();
        server.helper('user', function (id, next) { return next({ id: id }); });
        server.helpers.user(4, function (result) {

            expect(result.id).to.equal(4);
            done();
        });
    });

    it('returns a valid result when calling a helper when using the cache', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            server.helper('user', function (id, str, next) { return next({ id: id, str: str }); }, { cache: { expiresIn: 1000 } });
            server.helpers.user(4, 'something', function (result) {

                expect(result.id).to.equal(4);
                expect(result.str).to.equal('something');
                done();
            });
        });
    });

    it('returns an error result when calling a helper that returns an error', function (done) {

        var server = new Hapi.Server();
        server.helper('user', function (id, next) { return next(new Error()); });
        server.helpers.user(4, function (result) {

            expect(result instanceof Error).to.equal(true);
            done();
        });
    });

    it('returns a different result when calling a helper without using the cache', function (done) {

        var server = new Hapi.Server();
        var gen = 0;
        server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); });
        server.helpers.user(4, function (result1) {

            expect(result1.id).to.equal(4);
            expect(result1.gen).to.equal(1);
            server.helpers.user(4, function (result2) {

                expect(result2.id).to.equal(4);
                expect(result2.gen).to.equal(2);
                done();
            });
        });
    });

    it('returns a valid result when calling a helper using the cache', function (done) {

        var server = new Hapi.Server(0, { cache: 'memory' });

        var gen = 0;
        server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });

        server.start(function () {

            var id = Math.random();
            server.helpers.user(id, function (result1) {

                expect(result1.id).to.equal(id);
                expect(result1.gen).to.equal(1);
                server.helpers.user(id, function (result2) {

                    expect(result2.id).to.equal(id);
                    expect(result2.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('supports empty key helper', function (done) {

        var server = new Hapi.Server(0, { cache: 'memory' });

        var gen = 0;
        var terms = 'I agree to give my house';
        server.helper('tos', function (next) { return next({ gen: gen++, terms: terms }); }, { cache: { expiresIn: 2000 } });

        server.start(function () {

            server.helpers.tos(function (result1) {

                expect(result1.terms).to.equal(terms);
                expect(result1.gen).to.equal(0);
                server.helpers.tos(function (result2) {

                    expect(result2.terms).to.equal(terms);
                    expect(result2.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('returns valid results when calling a helper (with different keys) using the cache', function (done) {

        var server = new Hapi.Server(0, { cache: 'memory' });
        var gen = 0;
        server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
        server.start(function () {
            
            var id1 = Math.random();
            server.helpers.user(id1, function (result1) {

                expect(result1.id).to.equal(id1);
                expect(result1.gen).to.equal(1);
                var id2 = Math.random();
                server.helpers.user(id2, function (result2) {

                    expect(result2.id).to.equal(id2);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });
    });

    it('returns new object (not cached) when second key generation fails when using the cache', function (done) {

        var server = new Hapi.Server(0, { cache: 'memory' });
        var id1 = Math.random();
        var gen = 0;
        var helper = function (id, next) {

            if (typeof id === 'function') {
                id = id1;
            }

            return next({ id: id, gen: ++gen });
        };

        server.helper([{ name: 'user', method: helper, options: { cache: { expiresIn: 2000 } } }]);

        server.start(function () {

            server.helpers.user(id1, function (result1) {

                expect(result1.id).to.equal(id1);
                expect(result1.gen).to.equal(1);

                server.helpers.user(function () { }, function (result2) {

                    expect(result2.id).to.equal(id1);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });
    });

    it('returns a user record using helper', function (done) {

        var server = new Hapi.Server();

        server.helper('user', function (id, next) {

            return next({ id: id, name: 'Bob' });
        });

        server.route({
            method: 'GET',
            path: '/user/{id}',
            config: {
                pre: [
                    'user(params.id)'
                ],
                handler: function (request, reply) {

                    return reply(request.pre.user);
                }
            }
        });

        server.inject('/user/5', function (res) {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('returns a user name using multiple helpers', function (done) {

        var server = new Hapi.Server();

        server.helper('user', function (id, next) {

            return next({ id: id, name: 'Bob' });
        });

        server.helper('name', function (user, next) {

            return next(user.name);
        });

        server.route({
            method: 'GET',
            path: '/user/{id}/name',
            config: {
                pre: [
                    'user(params.id)',
                    'name(pre.user)'
                ],
                handler: function (request, reply) {

                    return reply(request.pre.name);
                }
            }
        });

        server.inject('/user/5/name', function (res) {

            expect(res.result).to.equal('Bob');
            done();
        });
    });
});