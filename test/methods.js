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


describe('Method', function () {

    it('registers a method', function (done) {

        var add = function (a, b, next) {

            return next(null, a + b);
        };

        var server = new Hapi.Server(0);
        server.method('add', add);

        server.start(function () {

            server.methods.add(1, 5, function (err, result) {

                expect(result).to.equal(6);
                done();
            });
        });
    });

    it('registers a method with nested name', function (done) {

        var add = function (a, b, next) {

            return next(null, a + b);
        };

        var server = new Hapi.Server(0);
        server.method('tools.add', add);

        server.start(function () {

            server.methods.tools.add(1, 5, function (err, result) {

                expect(result).to.equal(6);
                done();
            });
        });
    });

    it('registers two methods with shared nested name', function (done) {

        var add = function (a, b, next) {

            return next(null, a + b);
        };

        var sub = function (a, b, next) {

            return next(null, a - b);
        };

        var server = new Hapi.Server(0);
        server.method('tools.add', add);
        server.method('tools.sub', sub);

        server.start(function () {

            server.methods.tools.add(1, 5, function (err, result) {

                expect(result).to.equal(6);
                server.methods.tools.sub(1, 5, function (err, result) {

                    expect(result).to.equal(-4);
                    done();
                });
            });
        });
    });

    it('throws when registering a method with nested name twice', function (done) {

        var add = function (a, b, next) {

            return next(null, a + b);
        };

        var server = new Hapi.Server(0);
        server.method('tools.add', add);
        expect(function () {

            server.method('tools.add', add);
        }).to.throw('Server method function name already exists');

        done();
    });

    it('throws when registering a method with name nested through a function', function (done) {

        var add = function (a, b, next) {

            return next(null, a + b);
        };

        var server = new Hapi.Server(0);
        server.method('add', add);
        expect(function () {

            server.method('add.another', add);
        }).to.throw('Invalid segment another in reach path  add.another');

        done();
    });

    it('reuses cached method value', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(0);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('reuses cached method value with custom key function', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { cache: { expiresIn: 1000 }, generateKey: function (id) { return '' + (id + 1); } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(0);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('does not cache when custom key function return null', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { cache: { expiresIn: 1000 }, generateKey: function (id) { return null; } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(0);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('does not cache when custom key function returns a non-string', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { cache: { expiresIn: 1000 }, generateKey: function (id) { return id + 1; } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(0);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('does not cache value when ttl is 0', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ }, 0);
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(0);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('generates new value after cache drop', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('dropTest', method, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.methods.dropTest(2, function (err, result) {

                expect(result.gen).to.equal(0);
                server.methods.dropTest.cache.drop(2, function (err) {

                    expect(err).to.not.exist;

                    server.methods.dropTest(2, function (err, result) {

                        expect(result.gen).to.equal(1);
                        done();
                    });
                });
            });
        });
    });

    it('errors on invalid drop key', function (done) {

        var gen = 0;
        var method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('dropErrTest', method, { cache: { expiresIn: 1000 } });

        server.start(function () {

            server.methods.dropErrTest.cache.drop(function () {}, function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    it('throws an error when name is not a string', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.method(0, function () { });
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when name is invalid', function (done) {

        expect(function () {

            var server = new Hapi.Server();
            server.method('0', function () { });
        }).to.throw(Error);

        expect(function () {

            var server = new Hapi.Server();
            server.method('a..', function () { });
        }).to.throw(Error);

        expect(function () {

            var server = new Hapi.Server();
            server.method('a.0', function () { });
        }).to.throw(Error);

        expect(function () {

            var server = new Hapi.Server();
            server.method('.a', function () { });
        }).to.throw(Error);

        done();
    });

    it('throws an error when fn is not a function', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.method('user', 'function');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when options is not an object', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.method('user', function () { }, 'options');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when options.generateKey is not a function', function (done) {

        var fn = function () {

            var server = new Hapi.Server();
            server.method('user', function () { }, { generateKey: 'function' });
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when options.cache is not valid', function (done) {

        var fn = function () {

            var server = new Hapi.Server({ cache: 'catbox-memory' });
            server.method('user', function () { }, { cache: { x: 'y' } });
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('returns a valid result when calling a method without using the cache', function (done) {

        var server = new Hapi.Server();
        server.method('user', function (id, next) { return next(null, { id: id }); });
        server.methods.user(4, function (err, result) {

            expect(result.id).to.equal(4);
            done();
        });
    });

    it('returns a valid result when calling a method when using the cache', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            server.method('user', function (id, str, next) { return next(null, { id: id, str: str }); }, { cache: { expiresIn: 1000 } });
            server.methods.user(4, 'something', function (err, result) {

                expect(result.id).to.equal(4);
                expect(result.str).to.equal('something');
                done();
            });
        });
    });

    it('returns an error result when calling a method that returns an error', function (done) {

        var server = new Hapi.Server();
        server.method('user', function (id, next) { return next(new Error()); });
        server.methods.user(4, function (err, result) {

            expect(err).to.exist;
            done();
        });
    });

    it('returns a different result when calling a method without using the cache', function (done) {

        var server = new Hapi.Server();
        var gen = 0;
        server.method('user', function (id, next) { return next(null, { id: id, gen: ++gen }); });
        server.methods.user(4, function (err, result1) {

            expect(result1.id).to.equal(4);
            expect(result1.gen).to.equal(1);
            server.methods.user(4, function (err, result2) {

                expect(result2.id).to.equal(4);
                expect(result2.gen).to.equal(2);
                done();
            });
        });
    });

    it('returns a valid result when calling a method using the cache', function (done) {

        var server = new Hapi.Server(0, { cache: 'catbox-memory' });

        var gen = 0;
        server.method('user', function (id, next) { return next(null, { id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });

        server.start(function () {

            var id = Math.random();
            server.methods.user(id, function (err, result1) {

                expect(result1.id).to.equal(id);
                expect(result1.gen).to.equal(1);
                server.methods.user(id, function (err, result2) {

                    expect(result2.id).to.equal(id);
                    expect(result2.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('supports empty key method', function (done) {

        var server = new Hapi.Server(0, { cache: 'catbox-memory' });

        var gen = 0;
        var terms = 'I agree to give my house';
        server.method('tos', function (next) { return next(null, { gen: gen++, terms: terms }); }, { cache: { expiresIn: 2000 } });

        server.start(function () {

            server.methods.tos(function (err, result1) {

                expect(result1.terms).to.equal(terms);
                expect(result1.gen).to.equal(0);
                server.methods.tos(function (err, result2) {

                    expect(result2.terms).to.equal(terms);
                    expect(result2.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('returns valid results when calling a method (with different keys) using the cache', function (done) {

        var server = new Hapi.Server(0, { cache: 'catbox-memory' });
        var gen = 0;
        server.method('user', function (id, next) { return next(null, { id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
        server.start(function () {
            
            var id1 = Math.random();
            server.methods.user(id1, function (err, result1) {

                expect(result1.id).to.equal(id1);
                expect(result1.gen).to.equal(1);
                var id2 = Math.random();
                server.methods.user(id2, function (err, result2) {

                    expect(result2.id).to.equal(id2);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });
    });

    it('returns new object (not cached) when second key generation fails when using the cache', function (done) {

        var server = new Hapi.Server(0, { cache: 'catbox-memory' });
        var id1 = Math.random();
        var gen = 0;
        var method = function (id, next) {

            if (typeof id === 'function') {
                id = id1;
            }

            return next(null, { id: id, gen: ++gen });
        };

        server.method([{ name: 'user', fn: method, options: { cache: { expiresIn: 2000 } } }]);

        server.start(function () {

            server.methods.user(id1, function (err, result1) {

                expect(result1.id).to.equal(id1);
                expect(result1.gen).to.equal(1);

                server.methods.user(function () { }, function (err, result2) {

                    expect(result2.id).to.equal(id1);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });
    });

    it('sets method bind without cache', function (done) {

        var method = function (id, next) {

            return next(null, { id: id, gen: this.gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { bind: { gen: 7 } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(7);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(8);
                    done();
                });
            });
        });
    });

    it('sets method bind with cache', function (done) {

        var method = function (id, next) {

            return next(null, { id: id, gen: this.gen++ });
        };

        var server = new Hapi.Server(0);
        server.method('test', method, { bind: { gen: 7 }, cache: { expiresIn: 1000 } });

        server.start(function () {

            server.methods.test(1, function (err, result) {

                expect(result.gen).to.equal(7);

                server.methods.test(1, function (err, result) {

                    expect(result.gen).to.equal(7);
                    done();
                });
            });
        });
    });
});
