'use strict';

const Catbox = require('@hapi/catbox');
const CatboxMemory = require('@hapi/catbox-memory');
const Code = require('@hapi/code');
const Hapi = require('..');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Methods', () => {

    it('registers a method', () => {

        const add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method('add', add);

        const result = server.methods.add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method (object)', () => {

        const add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method({ name: 'add', method: add });

        const result = server.methods.add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with leading _', () => {

        const _add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method('_add', _add);

        const result = server.methods._add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with leading $', () => {

        const $add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method('$add', $add);

        const result = server.methods.$add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with _', () => {

        const _add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method('add_._that', _add);

        const result = server.methods.add_._that(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method with $', () => {

        const $add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method('add$.$that', $add);

        const result = server.methods.add$.$that(1, 5);
        expect(result).to.equal(6);
    });

    it('registers a method (promise)', async () => {

        const add = function (a, b) {

            return new Promise((resolve) => resolve(a + b));
        };

        const server = Hapi.server();
        server.method('add', add);

        const value = await server.methods.add(1, 5);
        expect(value).to.equal(6);
    });

    it('registers a method with nested name', () => {

        const add = function (a, b) {

            return a + b;
        };

        const server = Hapi.server();
        server.method('tools.add', add);

        const result = server.methods.tools.add(1, 5);
        expect(result).to.equal(6);
    });

    it('registers two methods with shared nested name', () => {

        const add = function (a, b) {

            return a + b;
        };

        const sub = function (a, b) {

            return a - b;
        };

        const server = Hapi.server();
        server.method('tools.add', add);
        server.method('tools.sub', sub);

        const result1 = server.methods.tools.add(1, 5);
        expect(result1).to.equal(6);
        const result2 = server.methods.tools.sub(1, 5);
        expect(result2).to.equal(-4);
    });

    it('throws when registering a method with nested name twice', () => {

        const server = Hapi.server();
        server.method('tools.add', Hoek.ignore);
        expect(() => {

            server.method('tools.add', Hoek.ignore);
        }).to.throw('Server method function name already exists: tools.add');
    });

    it('throws when registering a method with name nested through a function', () => {

        const server = Hapi.server();
        server.method('add', Hoek.ignore);
        expect(() => {

            server.method('add.another', Hoek.ignore);
        }).to.throw('Invalid segment another in reach path  add.another');
    });

    it('calls non cached method multiple times', () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = Hapi.server();
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

        const server = Hapi.server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const result2 = await server.methods.test(1);
        expect(result2.gen).to.equal(0);
    });

    it('emits a cache policy event on cached methods with default cache provision', async () => {

        const method = function (id) {

            return { id };
        };

        const server = Hapi.server();
        const cachePolicyEvent = server.events.once('cachePolicy');

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        const [policy, cacheName, segment] = await cachePolicyEvent;
        expect(policy).to.be.instanceOf(Catbox.Policy);
        expect(cacheName).to.equal(undefined);
        expect(segment).to.equal('#test');
    });

    it('emits a cache policy event on cached methods with named cache provision', async () => {

        const method = function (id) {

            return { id };
        };

        const server = Hapi.server();
        await server.cache.provision({ provider: CatboxMemory, name: 'named' });
        const cachePolicyEvent = server.events.once('cachePolicy');

        server.method('test', method, { cache: { cache: 'named', expiresIn: 1000, generateTimeout: 10 } });

        const [policy, cacheName, segment] = await cachePolicyEvent;
        expect(policy).to.be.instanceOf(Catbox.Policy);
        expect(cacheName).to.equal('named');
        expect(segment).to.equal('#test');
    });

    it('caches method value (async)', async () => {

        let gen = 0;
        const method = async function (id) {

            await Hoek.wait(1);
            return { id, gen: gen++ };
        };

        const server = Hapi.server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const result2 = await server.methods.test(1);
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

        const server = Hapi.server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const result2 = await server.methods.test(1);
        expect(result2.gen).to.equal(0);

        await expect(server.methods.test(2)).to.reject('boom');
    });

    it('caches method value (decorated)', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = Hapi.server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10, getDecoratedValue: true } });

        await server.initialize();

        const { value: result1 } = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const { value: result2 } = await server.methods.test(1);
        expect(result2.gen).to.equal(0);
    });

    it('reuses cached method value with custom key function', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = Hapi.server();

        const generateKey = function (id) {

            return '' + (id + 1);
        };

        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 }, generateKey });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const result2 = await server.methods.test(1);
        expect(result2.gen).to.equal(0);
    });

    it('errors when custom key function return null', async () => {

        const method = function (id) {

            return { id };
        };

        const server = Hapi.server();

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

        const server = Hapi.server();

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

        const server = Hapi.server();
        server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(0);

        const result2 = await server.methods.test(1);
        expect(result2.gen).to.equal(1);
    });

    it('generates new value after cache drop', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = Hapi.server();
        server.method('dropTest', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.dropTest(2);
        expect(result1.gen).to.equal(0);
        await server.methods.dropTest.cache.drop(2);
        const result2 = await server.methods.dropTest(2);
        expect(result2.gen).to.equal(1);
    });

    it('errors on invalid drop key', async () => {

        let gen = 0;
        const method = function (id) {

            return { id, gen: gen++ };
        };

        const server = Hapi.server();
        server.method('dropErrTest', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const invalid = () => { };
        await expect(server.methods.dropErrTest.cache.drop(invalid)).to.reject();
    });

    it('reports cache stats for each method', async () => {

        const method = function (id) {

            return { id };
        };

        const server = Hapi.server();
        server.method('test', method, { cache: { generateTimeout: 10 } });
        server.method('test2', method, { cache: { generateTimeout: 10 } });

        await server.initialize();

        server.methods.test(1);
        expect(server.methods.test.cache.stats.gets).to.equal(1);
        expect(server.methods.test2.cache.stats.gets).to.equal(0);
    });

    it('throws an error when name is not a string', () => {

        expect(() => {

            const server = Hapi.server();
            server.method(0, () => { });
        }).to.throw('name must be a string');
    });

    it('throws an error when name is invalid', () => {

        expect(() => {

            const server = Hapi.server();
            server.method('0', () => { });
        }).to.throw('Invalid name: 0');

        expect(() => {

            const server = Hapi.server();
            server.method('a..', () => { });
        }).to.throw('Invalid name: a..');

        expect(() => {

            const server = Hapi.server();
            server.method('a.0', () => { });
        }).to.throw('Invalid name: a.0');

        expect(() => {

            const server = Hapi.server();
            server.method('.a', () => { });
        }).to.throw('Invalid name: .a');
    });

    it('throws an error when method is not a function', () => {

        expect(() => {

            const server = Hapi.server();
            server.method('user', 'function');
        }).to.throw('method must be a function');
    });

    it('throws an error when options is not an object', () => {

        expect(() => {

            const server = Hapi.server();
            server.method('user', () => { }, 'options');
        }).to.throw(/Invalid method options \(user\)/);
    });

    it('throws an error when options.generateKey is not a function', () => {

        expect(() => {

            const server = Hapi.server();
            server.method('user', () => { }, { generateKey: 'function' });
        }).to.throw(/Invalid method options \(user\)/);
    });

    it('throws an error when options.cache is not valid', () => {

        expect(() => {

            const server = Hapi.server({ cache: CatboxMemory });
            server.method('user', () => { }, { cache: { x: 'y', generateTimeout: 10 } });
        }).to.throw(/Invalid cache policy configuration/);
    });

    it('throws an error when generateTimeout is not present', () => {

        const server = Hapi.server();
        expect(() => {

            server.method('test', () => { }, { cache: {} });
        }).to.throw('Method caching requires a timeout value in generateTimeout: test');
    });

    it('allows generateTimeout to be false', () => {

        const server = Hapi.server();
        expect(() => {

            server.method('test', () => { }, { cache: { generateTimeout: false } });
        }).to.not.throw();
    });

    it('returns timeout when method taking too long using the cache', async () => {

        const server = Hapi.server({ cache: CatboxMemory });

        let gen = 0;
        const method = async function (id) {

            await Hoek.wait(50);
            return { id, gen: ++gen };
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 30 } });

        await server.initialize();

        const id = Math.random();
        const err = await expect(server.methods.user(id)).to.reject();
        expect(err.output.statusCode).to.equal(503);

        await Hoek.wait(30);

        const result2 = await server.methods.user(id);
        expect(result2.id).to.equal(id);
        expect(result2.gen).to.equal(1);
    });

    it('supports empty key method', async () => {

        const server = Hapi.server({ cache: CatboxMemory });

        let gen = 0;
        const terms = 'I agree to give my house';
        const method = function () {

            return { gen: gen++, terms };
        };

        server.method('tos', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.tos();
        expect(result1.terms).to.equal(terms);
        expect(result1.gen).to.equal(0);

        const result2 = await server.methods.tos();
        expect(result2.terms).to.equal(terms);
        expect(result2.gen).to.equal(0);
    });

    it('returns valid results when calling a method (with different keys) using the cache', async () => {

        const server = Hapi.server({ cache: CatboxMemory });
        let gen = 0;
        const method = function (id) {

            return { id, gen: ++gen };
        };

        server.method('user', method, { cache: { expiresIn: 2000, generateTimeout: 10 } });
        await server.initialize();

        const id1 = Math.random();
        const result1 = await server.methods.user(id1);
        expect(result1.id).to.equal(id1);
        expect(result1.gen).to.equal(1);

        const id2 = Math.random();
        const result2 = await server.methods.user(id2);
        expect(result2.id).to.equal(id2);
        expect(result2.gen).to.equal(2);
    });

    it('errors when key generation fails', async () => {

        const server = Hapi.server({ cache: CatboxMemory });

        const method = function (id) {

            return { id };
        };

        server.method([{ name: 'user', method, options: { cache: { expiresIn: 2000, generateTimeout: 10 } } }]);

        await server.initialize();

        const result1 = await server.methods.user(1);
        expect(result1.id).to.equal(1);

        const invalid = function () { };
        await expect(server.methods.user(invalid)).to.reject('Invalid method key when invoking: user');
    });

    it('sets method bind without cache', () => {

        const method = function (id) {

            return { id, gen: this.gen++ };
        };

        const server = Hapi.server();
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

        const server = Hapi.server();
        server.method('test', method, { bind: { gen: 7 }, cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(7);

        const result2 = await server.methods.test(1);
        expect(result2.gen).to.equal(7);
    });

    it('shallow copies bind config', async () => {

        const bind = { gen: 7 };
        const method = function (id) {

            return { id, gen: this.gen++, bound: this === bind };
        };

        const server = Hapi.server();
        server.method('test', method, { bind, cache: { expiresIn: 1000, generateTimeout: 10 } });

        await server.initialize();

        const result1 = await server.methods.test(1);
        expect(result1.gen).to.equal(7);
        expect(result1.bound).to.equal(true);

        const result2 = await server.methods.test(1);
        expect(result2.gen).to.equal(7);
    });

    describe('_add()', () => {

        it('handles sync method', () => {

            const add = function (a, b) {

                return a + b;
            };

            const server = Hapi.server();
            server.method('add', add);
            const result = server.methods.add(1, 5);
            expect(result).to.equal(6);
        });

        it('handles sync method (direct error)', () => {

            const add = function (a, b) {

                return new Error('boom');
            };

            const server = Hapi.server();
            server.method('add', add);
            const result = server.methods.add(1, 5);
            expect(result).to.be.instanceof(Error);
            expect(result.message).to.equal('boom');
        });

        it('handles sync method (direct throw)', () => {

            const add = function (a, b) {

                throw new Error('boom');
            };

            const server = Hapi.server();
            server.method('add', add);
            expect(() => {

                server.methods.add(1, 5);
            }).to.throw('boom');
        });

        it('throws an error if unknown keys are present when making a server method using an object', () => {

            const fn = function () { };
            const server = Hapi.server();

            expect(() => {

                server.method({
                    name: 'fn',
                    method: fn,
                    cache: {}
                });
            }).to.throw(/^Invalid methodObject options/);
        });
    });

    describe('generateKey()', () => {

        it('handles string argument type', async () => {

            const method = (id) => id;
            const server = Hapi.server();
            server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

            await server.initialize();
            const value = await server.methods.test('x');
            expect(value).to.equal('x');
        });

        it('handles multiple arguments', async () => {

            const method = (a, b, c) => a + b + c;
            const server = Hapi.server();
            server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

            await server.initialize();
            const value = await server.methods.test('a', 'b', 'c');
            expect(value).to.equal('abc');
        });

        it('errors on invalid argument type', async () => {

            const method = (id) => id;
            const server = Hapi.server();
            server.method('test', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

            await server.initialize();
            await expect(server.methods.test({})).to.reject('Invalid method key when invoking: test');
        });
    });
});
