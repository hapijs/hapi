'use strict';

// Load modules

const CatboxMemory = require('catbox-memory');
const Code = require('code');
const Hapi = require('..');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Methods', () => {

    it('registers a method', (done) => {

        const add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('add', add);

        server.methods.add(1, 5, (err, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(6);
            done();
        });
    });

    it('registers a method with leading _', (done) => {

        const _add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('_add', _add);

        server.methods._add(1, 5, (err, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(6);
            done();
        });
    });

    it('registers a method with leading $', (done) => {

        const $add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('$add', $add);

        server.methods.$add(1, 5, (err, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(6);
            done();
        });
    });

    it('registers a method with _', (done) => {

        const _add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('add_._that', _add);

        server.methods.add_._that(1, 5, (err, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(6);
            done();
        });
    });

    it('registers a method with $', (done) => {

        const $add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('add$.$that', $add);

        server.methods.add$.$that(1, 5, (err, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(6);
            done();
        });
    });

    it('registers a method (no callback)', (done) => {

        const add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('add', add, { callback: false });

        expect(server.methods.add(1, 5)).to.equal(6);
        done();
    });

    it('registers a method (promise)', (done) => {

        const add = function (a, b) {

            return new Promise((resolve, reject) => {

                return resolve(a + b);
            });
        };

        const server = new Hapi.Server();
        server.method('add', add, { callback: false });

        server.methods.add(1, 5).then((result) => {

            expect(result).to.equal(6);
            done();
        });
    });

    it('registers a method with nested name', (done) => {

        const add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('tools.add', add);

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.tools.add(1, 5, (err, result) => {

                expect(err).to.not.exist();
                expect(result).to.equal(6);
                done();
            });
        });
    });

    it('registers a method with bind and callback', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const context = { name: 'Bob' };
        const method = function (id, next) {

            return next(null, { id: id, name: this.name });
        };

        server.method('user', method, { bind: context });

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

        server.inject('/user/5', (res) => {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('registers two methods with shared nested name', (done) => {

        const add = function (a, b, next) {

            return next(null, a + b);
        };

        const sub = function (a, b, next) {

            return next(null, a - b);
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('tools.add', add);
        server.method('tools.sub', sub);

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.tools.add(1, 5, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1).to.equal(6);
                server.methods.tools.sub(1, 5, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2).to.equal(-4);
                    done();
                });
            });
        });
    });

    it('throws when registering a method with nested name twice', (done) => {

        const add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('tools.add', add);
        expect(() => {

            server.method('tools.add', add);
        }).to.throw('Server method function name already exists: tools.add');

        done();
    });

    it('throws when registering a method with name nested through a function', (done) => {

        const add = function (a, b, next) {

            return next(null, a + b);
        };

        const server = new Hapi.Server();
        server.method('add', add);
        expect(() => {

            server.method('add.another', add);
        }).to.throw('Invalid segment another in reach path  add.another');

        done();
    });

    it('calls non cached method multiple times', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method);

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('caches method value', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('caches method value (no callback)', (done) => {

        let gen = 0;
        const method = function (id) {

            return { id: id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, callback: false });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('caches method value (promise)', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return new Promise((resolve, reject) => {

                if (id === 2) {
                    return reject(new Error('boom'));
                }

                return resolve({ id: id, gen: gen++ });
            });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, callback: false });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(0);

                    server.methods.test(2, (err, result3) => {

                        expect(err).to.exist();
                        expect(err.message).to.equal('boom');
                        done();
                    });
                });
            });
        });
    });

    it('reuses cached method value with custom key function', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        const server = new Hapi.Server();
        server.connection();

        const generateKey = function (id) {

            return '' + (id + 1);
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey: generateKey });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('errors when custom key function return null', (done) => {

        const method = function (id, next) {

            return next(null, { id: id });
        };

        const server = new Hapi.Server();
        server.connection();

        const generateKey = function (id) {

            return null;
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey: generateKey });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid method key when invoking: test');
                done();
            });
        });
    });

    it('does not cache when custom key function returns a non-string', (done) => {

        const method = function (id, next) {

            return next(null, { id: id });
        };

        const server = new Hapi.Server();
        server.connection();

        const generateKey = function (id) {

            return 123;
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey: generateKey });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Invalid method key when invoking: test');
                done();
            });
        });
    });

    it('does not cache value when ttl is 0', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: gen++ }, 0);
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('generates new value after cache drop', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('dropTest', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.dropTest(2, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(0);
                server.methods.dropTest.cache.drop(2, (err) => {

                    expect(err).to.not.exist();

                    server.methods.dropTest(2, (err, result2) => {

                        expect(err).to.not.exist();
                        expect(result2.gen).to.equal(1);
                        done();
                    });
                });
            });
        });
    });

    it('errors on invalid drop key', (done) => {

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: gen++ });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('dropErrTest', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            const invalid = () => { };
            server.methods.dropErrTest.cache.drop(invalid, (err) => {

                expect(err).to.exist();
                done();
            });
        });
    });

    it('reports cache stats for each method', (done) => {

        const method = function (id, next) {

            return next(null, { id: id });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { cache: { generateTimeout: 10 } });
        server.method('test2', method, { cache: { generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err) => {

                expect(err).to.not.exist();
                expect(server.methods.test.cache.stats.gets).to.equal(1);
                expect(server.methods.test2.cache.stats.gets).to.equal(0);
                done();
            });
        });
    });

    it('throws an error when name is not a string', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.method(0, () => { });
        }).to.throw('name must be a string');
        done();
    });

    it('throws an error when name is invalid', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('0', () => { });
        }).to.throw('Invalid name: 0');

        expect(() => {

            const server = new Hapi.Server();
            server.method('a..', () => { });
        }).to.throw('Invalid name: a..');

        expect(() => {

            const server = new Hapi.Server();
            server.method('a.0', () => { });
        }).to.throw('Invalid name: a.0');

        expect(() => {

            const server = new Hapi.Server();
            server.method('.a', () => { });
        }).to.throw('Invalid name: .a');

        done();
    });

    it('throws an error when method is not a function', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('user', 'function');
        }).to.throw('method must be a function');
        done();
    });

    it('throws an error when options is not an object', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('user', () => { }, 'options');
        }).to.throw(/Invalid method options \(user\)/);
        done();
    });

    it('throws an error when options.generateKey is not a function', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('user', () => { }, { generateKey: 'function' });
        }).to.throw(/Invalid method options \(user\)/);
        done();
    });

    it('throws an error when options.cache is not valid', (done) => {

        expect(() => {

            const server = new Hapi.Server({ cache: CatboxMemory });
            server.method('user', () => { }, { cache: { x: 'y', generateTimeout: 10 } });
        }).to.throw(/Invalid cache policy configuration/);
        done();
    });

    it('throws an error when generateTimeout is not present', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.method('test', () => { }, { cache: {} });
        }).to.throw('Method caching requires a timeout value in generateTimeout: test');

        done();
    });

    it('allows generateTimeout to be false', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.method('test', () => { }, { cache: { generateTimeout: false } });
        }).to.not.throw();

        done();
    });

    it('returns a valid result when calling a method without using the cache', (done) => {

        const server = new Hapi.Server();

        const method = function (id, next) {

            return next(null, { id: id });
        };

        server.method('user', method);
        server.methods.user(4, (err, result) => {

            expect(err).to.not.exist();
            expect(result.id).to.equal(4);
            done();
        });
    });

    it('returns a valid result when calling a method when using the cache', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.initialize((err) => {

            expect(err).to.not.exist();

            const method = function (id, str, next) {

                return next(null, { id: id, str: str });
            };

            server.method('user', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });
            server.methods.user(4, 'something', (err, result) => {

                expect(err).to.not.exist();
                expect(result.id).to.equal(4);
                expect(result.str).to.equal('something');
                done();
            });
        });
    });

    it('returns an error result when calling a method that returns an error', (done) => {

        const server = new Hapi.Server();

        const method = function (id, next) {

            return next(new Error());
        };

        server.method('user', method);
        server.methods.user(4, (err, result) => {

            expect(err).to.exist();
            done();
        });
    });

    it('returns a different result when calling a method without using the cache', (done) => {

        const server = new Hapi.Server();

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: ++gen });
        };

        server.method('user', method);
        server.methods.user(4, (err, result1) => {

            expect(err).to.not.exist();
            expect(result1.id).to.equal(4);
            expect(result1.gen).to.equal(1);
            server.methods.user(4, (err, result2) => {

                expect(err).to.not.exist();
                expect(result2.id).to.equal(4);
                expect(result2.gen).to.equal(2);
                done();
            });
        });
    });

    it('returns a valid result when calling a method using the cache', (done) => {

        const server = new Hapi.Server({ cache: CatboxMemory });
        server.connection();

        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: ++gen });
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            const id = Math.random();
            server.methods.user(id, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.id).to.equal(id);
                expect(result1.gen).to.equal(1);
                server.methods.user(id, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.id).to.equal(id);
                    expect(result2.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('returns timeout when method taking too long using the cache', (done) => {

        const server = new Hapi.Server({ cache: CatboxMemory });
        server.connection();

        let gen = 0;
        const method = function (id, next) {

            setTimeout(() => {

                return next(null, { id: id, gen: ++gen });
            }, 5);
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 3 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            const id = Math.random();
            server.methods.user(id, (err, result1) => {

                expect(err.output.statusCode).to.equal(503);

                setTimeout(() => {

                    server.methods.user(id, (err, result2) => {

                        expect(err).to.not.exist();
                        expect(result2.id).to.equal(id);
                        expect(result2.gen).to.equal(1);
                        done();
                    });
                }, 3);
            });
        });
    });

    it('supports empty key method', (done) => {

        const server = new Hapi.Server({ cache: CatboxMemory });
        server.connection();

        let gen = 0;
        const terms = 'I agree to give my house';
        const method = function (next) {

            return next(null, { gen: gen++, terms: terms });
        };

        server.method('tos', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.tos((err, result1) => {

                expect(err).to.not.exist();
                expect(result1.terms).to.equal(terms);
                expect(result1.gen).to.equal(0);
                server.methods.tos((err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.terms).to.equal(terms);
                    expect(result2.gen).to.equal(0);
                    done();
                });
            });
        });
    });

    it('returns valid results when calling a method (with different keys) using the cache', (done) => {

        const server = new Hapi.Server({ cache: CatboxMemory });
        server.connection();
        let gen = 0;
        const method = function (id, next) {

            return next(null, { id: id, gen: ++gen });
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });
        server.initialize((err) => {

            expect(err).to.not.exist();

            const id1 = Math.random();
            server.methods.user(id1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.id).to.equal(id1);
                expect(result1.gen).to.equal(1);
                const id2 = Math.random();
                server.methods.user(id2, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.id).to.equal(id2);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });
    });

    it('errors when key generation fails', (done) => {

        const server = new Hapi.Server({ cache: CatboxMemory });
        server.connection();

        const method = function (id, next) {

            return next(null, { id: id });
        };

        server.method([{ name: 'user', method: method, options: { cache: { expiresIn: 2000, generateTimeout: 10 } } }]);

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.user(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.id).to.equal(1);

                const invalid = function () { };

                server.methods.user(invalid, (err, result2) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Invalid method key when invoking: user');
                    done();
                });
            });
        });
    });

    it('sets method bind without cache', (done) => {

        const method = function (id, next) {

            return next(null, { id: id, gen: this.gen++ });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { bind: { gen: 7 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(7);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(8);
                    done();
                });
            });
        });
    });

    it('sets method bind with cache', (done) => {

        const method = function (id, next) {

            return next(null, { id: id, gen: this.gen++ });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { bind: { gen: 7 }, cache: { expiresIn: 1000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(7);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(7);
                    done();
                });
            });
        });
    });

    it('shallow copies bind config', (done) => {

        const bind = { gen: 7 };
        const method = function (id, next) {

            return next(null, { id: id, gen: this.gen++, bound: (this === bind) });
        };

        const server = new Hapi.Server();
        server.connection();
        server.method('test', method, { bind: bind, cache: { expiresIn: 1000, generateTimeout: 10 } });

        server.initialize((err) => {

            expect(err).to.not.exist();

            server.methods.test(1, (err, result1) => {

                expect(err).to.not.exist();
                expect(result1.gen).to.equal(7);
                expect(result1.bound).to.equal(true);

                server.methods.test(1, (err, result2) => {

                    expect(err).to.not.exist();
                    expect(result2.gen).to.equal(7);
                    done();
                });
            });
        });
    });

    describe('_add()', () => {

        it('normalizes no callback into callback (direct)', (done) => {

            const add = function (a, b) {

                return a + b;
            };

            const server = new Hapi.Server();
            server.method('add', add, { callback: false });
            const result = server.methods.add(1, 5);
            expect(result).to.equal(6);
            done();
        });

        it('normalizes no callback into callback (direct error)', (done) => {

            const add = function (a, b) {

                return new Error('boom');
            };

            const server = new Hapi.Server();
            server.method('add', add, { callback: false });
            const result = server.methods.add(1, 5);
            expect(result).to.be.instanceof(Error);
            expect(result.message).to.equal('boom');
            done();
        });

        it('normalizes no callback into callback (direct throw)', (done) => {

            const add = function (a, b) {

                throw new Error('boom');
            };

            const server = new Hapi.Server();
            server.method('add', add, { callback: false });
            expect(() => {

                server.methods.add(1, 5);
            }).to.throw('boom');
            done();
        });

        it('normalizes no callback into callback (normalized)', (done) => {

            const add = function (a, b) {

                return a + b;
            };

            const server = new Hapi.Server();
            server.method('add', add, { callback: false });

            server._methods._normalized.add(1, 5, (err, result) => {

                expect(err).to.not.exist();
                expect(result).to.equal(6);
                done();
            });
        });

        it('normalizes no callback into callback (normalized error)', (done) => {

            const add = function (a, b) {

                return new Error('boom');
            };

            const server = new Hapi.Server();
            server.method('add', add, { callback: false });

            server._methods._normalized.add(1, 5, (err, result) => {

                expect(err).to.exist();
                expect(err.message).to.equal('boom');
                done();
            });
        });

        it('normalizes no callback into callback (normalized throw)', (done) => {

            const add = function (a, b) {

                throw new Error('boom');
            };

            const server = new Hapi.Server();
            server.method('add', add, { callback: false });

            server._methods._normalized.add(1, 5, (err, result) => {

                expect(err).to.exist();
                expect(err.message).to.equal('boom');
                done();
            });
        });
    });

    it('normalizes no callback into callback (cached)', (done) => {

        const add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('add', add, { cache: { expiresIn: 10, generateTimeout: 10 }, callback: false });

        server._methods._normalized.add(1, 5, (err, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(6);
            done();
        });
    });

    it('normalizes no callback into callback (cached error)', (done) => {

        const add = function (a, b) {

            return new Error('boom');
        };

        const server = new Hapi.Server();
        server.method('add', add, { cache: { expiresIn: 10, generateTimeout: 10 }, callback: false });

        server._methods._normalized.add(1, 5, (err, result) => {

            expect(err).to.exist();
            expect(err.message).to.equal('boom');
            done();
        });
    });

    it('normalizes no callback into callback (cached throw)', (done) => {

        const add = function (a, b) {

            throw new Error('boom');
        };

        const server = new Hapi.Server();
        server.method('add', add, { cache: { expiresIn: 10, generateTimeout: 10 }, callback: false });

        server._methods._normalized.add(1, 5, (err, result) => {

            expect(err).to.exist();
            expect(err.message).to.equal('boom');
            done();
        });
    });

    it('throws an error if unknown keys are present when making a server method using an object', (done) => {

        const fn = function () { };
        const server = new Hapi.Server();

        expect(() => {

            server.method({
                name: 'fn',
                method: fn,
                cache: {}
            });
        }).to.throw();

        done();
    });
});
