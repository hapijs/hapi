'use strict';

// Load modules

const CatboxMemory = require('catbox-memory');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Methods', () => {

    it('registers a method', async () => {

        const add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('add', add);

        const result = server.methods.add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with leading _', async () => {

        const _add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('_add', _add);

        const result = server.methods._add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with leading $', async () => {

        const $add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('$add', $add);

        const result = server.methods.$add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with _', async () => {

        const _add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('add_._that', _add);

        const result = server.methods.add_._that(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with $', async () => {

        const $add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('add$.$that', $add);

        const result = server.methods.add$.$that(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method (promise)', async () => {

        const add = function (a, b) {

            return new Promise((resolve) => resolve(a + b));
        };

        const server = new Hapi.Server();
        server.method('add', add);

        const value = await server.methods.add(1, 5);
        expect(value).to.equal(6);
    });

    it('registers a method with nested name', async () => {

        const add = function (a, b) {

            return a + b;
        };

        const server = new Hapi.Server();
        server.method('tools.add', add);

        const result = server.methods.tools.add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers two methods with shared nested name', async () => {

        const add = function (a, b) {

            return a + b;
        };

        const sub = function (a, b) {

            return a - b;
        };

        const server = new Hapi.Server();
        server.method('tools.add', add);
        server.method('tools.sub', sub);

        const result1 = server.methods.tools.add(1, 5);
        expect(result1).to.equal(6);
        const result2 = server.methods.tools.sub(1, 5);
        expect(result2).to.equal(-4);
    });

    it('throws when registering a method with nested name twice', async () => {

        const server = new Hapi.Server();
        server.method('tools.add', Hoek.ignore);
        expect(() => {

            server.method('tools.add', Hoek.ignore);
        }).to.throw('Server method function name already exists: tools.add');
    });

    it('throws when registering a method with name nested through a function', async () => {

        const server = new Hapi.Server();
        server.method('add', Hoek.ignore);
        expect(() => {

            server.method('add.another', Hoek.ignore);
        }).to.throw('Invalid segment another in reach path  add.another');
    });

    it('calls non cached method multiple times', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.method('test', method);

        const result1 = server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const result2 = server.methods.test(1);
        expect(result2.gen).to.equal(1);
    });

    it('caches method value', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(0);
    });

    it('caches method value (async)', async () => {

        let gen = 0;
        const method = async function (id) {

            await Hoek.wait(1);
            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(0);
    });

    it('caches method value (promise)', async () => {

        let gen = 0;
        const method = function (id) {

            return new Promise((resolve, reject) => {

                if (id === 2) {
                    return reject(new Error('boom'));
                }

                return resolve({ id, gen: gen++ });
            });
        };

        const server = new Hapi.Server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(0);

        await expect(server.methods.test(2)).to.reject('boom');
    });

    it('reuses cached method value with custom key function', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();

        const generateKey = function (id) {

            return '' + (id + 1);
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(0);
    });

    it('errors when custom key function return null', async () => {

        const method = function (id) {

            return { id };
        };

        const server = new Hapi.Server();

        const generateKey = function (id) {

            return null;
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey });

        await server.initialize();
        await expect(server.methods.test(1)).to.reject('Invalid method key when invoking: test');
    });

    it('does not cache when custom key function returns a non-string', async () => {

        const method = function (id) {

            return { id };
        };

        const server = new Hapi.Server();

        const generateKey = function (id) {

            return 123;
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey });

        await server.initialize();
        await expect(server.methods.test(1)).to.reject('Invalid method key when invoking: test');
    });

    it('does not cache value when ttl is 0', async () => {

        let gen = 0;
        const method = function (id, flags) {

            flags.ttl = 0;
            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(1);
    });

    it('generates new value after cache drop', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.method('dropTest', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.dropTest(2);
        expect(result1.gen).to.equal(0);
        await server.methods.dropTest.cache.drop(2);
        const { value: result2 } = await server.methods.dropTest(2);
        expect(result2.gen).to.equal(1);
    });

    it('errors on invalid drop key', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = new Hapi.Server();
        server.method('dropErrTest', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const invalid = () => { };
        await expect(server.methods.dropErrTest.cache.drop(invalid)).to.reject();
    });

    it('reports cache stats for each method', async () => {

        const method = function (id) {

            return { id };
        };

        const server = new Hapi.Server();
        server.method('test', method, { cache: { generateTimeout: 10 } });
        server.method('test2', method, { cache: { generateTimeout: 10 } });

        await server.initialize();

        server.methods.test(1);
        expect(server.methods.test.cache.stats.gets).to.equal(1);
        expect(server.methods.test2.cache.stats.gets).to.equal(0);
    });

    it('throws an error when name is not a string', async () => {

        expect(() => {

            const server = new Hapi.Server();
            server.method(0, () => { });
        }).to.throw('name must be a string');
    });

    it('throws an error when name is invalid', async () => {

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
    });

    it('throws an error when method is not a function', async () => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('user', 'function');
        }).to.throw('method must be a function');
    });

    it('throws an error when options is not an object', async () => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('user', () => { }, 'options');
        }).to.throw(/Invalid method options \(user\)/);
    });

    it('throws an error when options.generateKey is not a function', async () => {

        expect(() => {

            const server = new Hapi.Server();
            server.method('user', () => { }, { generateKey: 'function' });
        }).to.throw(/Invalid method options \(user\)/);
    });

    it('throws an error when options.cache is not valid', async () => {

        expect(() => {

            const server = new Hapi.Server({ cache: CatboxMemory });
            server.method('user', () => { }, { cache: { x: 'y', generateTimeout: 10 } });
        }).to.throw(/Invalid cache policy configuration/);
    });

    it('throws an error when generateTimeout is not present', async () => {

        const server = new Hapi.Server();
        expect(() => {

            server.method('test', () => { }, { cache: {} });
        }).to.throw('Method caching requires a timeout value in generateTimeout: test');
    });

    it('allows generateTimeout to be false', async () => {

        const server = new Hapi.Server();
        expect(() => {

            server.method('test', () => { }, { cache: { generateTimeout: false } });
        }).to.not.throw();
    });

    it('returns timeout when method taking too long using the cache', async () => {

        const server = new Hapi.Server({ cache: CatboxMemory });

        let gen = 0;
        const method = async function (id) {

            await Hoek.wait(5);
            return { id, gen: ++gen };
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 3 } });

        await server.initialize();

        const id = Math.random();
        const err = await expect(server.methods.user(id)).to.reject();
        expect(err.output.statusCode).to.equal(503);

        await Hoek.wait(3);

        const { value: result2 } = await server.methods.user(id);
        expect(result2.id).to.equal(id);
        expect(result2.gen).to.equal(1);
    });

    it('supports empty key method', async () => {

        const server = new Hapi.Server({ cache: CatboxMemory });

        let gen = 0;
        const terms = 'I agree to give my house';
        const method = function () {

            return { gen: gen++, terms };
        };

        server.method('tos', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.tos();
        expect(result1.terms).to.equal(terms);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.tos();
        expect(result2.terms).to.equal(terms);
        expect(result2.gen).to.equal(0);
    });

    it('returns valid results when calling a method (with different keys) using the cache', async () => {

        const server = new Hapi.Server({ cache: CatboxMemory });
        let gen = 0;
        const method = function (id) {

            return { id, gen: ++gen };
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });
        await server.initialize();

        const id1 = Math.random();
        const { value: result1 } = await server.methods.user(id1);
        expect(result1.id).to.equal(id1);
        expect(result1.gen).to.equal(1);

        const id2 = Math.random();
        const { value: result2 } = await server.methods.user(id2);
        expect(result2.id).to.equal(id2);
        expect(result2.gen).to.equal(2);
    });

    it('errors when key generation fails', async () => {

        const server = new Hapi.Server({ cache: CatboxMemory });

        const method = function (id) {

            return { id };
        };

        server.method([{ name: 'user', method, options: { cache: { expiresIn: 2000, generateTimeout: 10 } } }]);

        await server.initialize();

        const { value: result1 } = await server.methods.user(1);
        expect(result1.id).to.equal(1);

        const invalid = function () { };
        await expect(server.methods.user(invalid)).to.reject('Invalid method key when invoking: user');
    });

    it('sets method bind without cache', async () => {

        const method = function (id) {

            return { id, gen: this.gen++ };
        };

        const server = new Hapi.Server();
        server.method('test', method, { bind: { gen: 7 } });

        const result1 = server.methods.test(1);
        expect(result1.gen).to.equal(7);

        const result2 = server.methods.test(1);
        expect(result2.gen).to.equal(8);
    });

    it('sets method bind with cache', async () => {

        const method = function (id) {

            return { id, gen: this.gen++ };
        };

        const server = new Hapi.Server();
        server.method('test', method, { bind: { gen: 7 }, cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(7);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(7);
    });

    it('shallow copies bind config', async () => {

        const bind = { gen: 7 };
        const method = function (id) {

            return { id, gen: this.gen++, bound: this === bind };
        };

        const server = new Hapi.Server();
        server.method('test', method, { bind, cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(7);
        expect(result1.bound).to.equal(true);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(7);
    });

    describe('_add()', () => {

        it('handles sync method', async () => {

            const add = function (a, b) {

                return a + b;
            };

            const server = new Hapi.Server();
            server.method('add', add);
            const result = server.methods.add(1, 5);
            expect(result).to.equal(6);
        });

        it('handles sync method (direct error)', async () => {

            const add = function (a, b) {

                return new Error('boom');
            };

            const server = new Hapi.Server();
            server.method('add', add);
            const result = server.methods.add(1, 5);
            expect(result).to.be.instanceof(Error);
            expect(result.message).to.equal('boom');
        });

        it('handles sync method (direct throw)', async () => {

            const add = function (a, b) {

                throw new Error('boom');
            };

            const server = new Hapi.Server();
            server.method('add', add);
            expect(() => {

                server.methods.add(1, 5);
            }).to.throw('boom');
        });
    });

    it('throws an error if unknown keys are present when making a server method using an object', async () => {

        const fn = function () { };
        const server = new Hapi.Server();

        expect(() => {

            server.method({
                name: 'fn',
                method: fn,
                cache: {}
            });
        }).to.throw();
    });
});
