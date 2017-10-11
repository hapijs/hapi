'use strict';

// Load modules

const Path = require('path');
const Zlib = require('zlib');

const Boom = require('boom');
const CatboxMemory = require('catbox-memory');
const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Lab = require('lab');
const Vision = require('vision');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Server', () => {

    describe('register()', () => {

        it('registers plugin with options', async () => {

            const server = new Hapi.Server();

            const test = function (srv, options) {

                expect(options.something).to.be.true();
                expect(srv.realm.pluginOptions).to.equal(options);
            };

            test.attributes = {
                name: 'test'
            };

            await server.register({ register: test, options: { something: true } });
        });

        it('registers a required plugin', async () => {

            const server = new Hapi.Server();

            const test = {
                register: function (srv, options) {

                    expect(options.something).to.be.true();
                }
            };

            test.register.attributes = {
                name: 'test'
            };

            await server.register({ register: test, options: { something: true } });
        });

        it('throws on bad plugin (missing attributes)', async () => {

            const server = new Hapi.Server();
            await expect(server.register({ register: function (srv, options) { } })).to.reject();
        });

        it('throws on bad plugin (missing name)', async () => {

            const register = function (srv, options) { };
            register.attributes = {};

            const server = new Hapi.Server();
            await expect(server.register(register)).to.reject();
        });

        it('throws on bad plugin (empty pkg)', async () => {

            const register = function (srv, options) { };
            register.attributes = {
                pkg: {}
            };

            const server = new Hapi.Server();
            await expect(server.register(register)).to.reject();
        });

        it('returns plugin error', async () => {

            const test = function (srv, options) {

                throw new Error('from plugin');
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await expect(server.register(test)).to.reject('from plugin');
        });

        it('sets version to 0.0.0 if missing', async () => {

            const test = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: () => srv.version
                });
            };

            test.attributes = {
                pkg: {
                    name: 'steve'
                }
            };

            const server = new Hapi.Server();
            await server.register(test);
            expect(server.registrations.steve.version).to.equal('0.0.0');

            const res = await server.inject('/');
            expect(res.result).to.equal(require('../package.json').version);
        });

        it('exposes plugin registration information', async () => {

            const test = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: () => srv.version
                });
            };

            test.attributes = {
                multiple: true,
                pkg: {
                    name: 'bob',
                    version: '1.2.3'
                }
            };

            const server = new Hapi.Server();

            await server.register({ register: test, options: { foo: 'bar' } });
            const bob = server.registrations.bob;
            expect(bob).to.exist();
            expect(bob).to.be.an.object();
            expect(bob.version).to.equal('1.2.3');
            expect(bob.attributes.multiple).to.be.true();
            expect(bob.options.foo).to.equal('bar');
            const res = await server.inject('/');
            expect(res.result).to.equal(require('../package.json').version);
        });

        it('prevents plugin from multiple registrations', async () => {

            const test = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/a',
                    handler: () => 'a'
                });
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server({ host: 'example.com' });
            await server.register(test);
            await expect(server.register(test)).to.reject('Plugin test already registered');
        });

        it('allows plugin multiple registrations (attributes)', async () => {

            const test = function (srv, options) {

                srv.app.x = srv.app.x ? srv.app.x + 1 : 1;
            };

            test.attributes = {
                name: 'test',
                multiple: true
            };

            const server = new Hapi.Server();
            await server.register(test);
            await server.register(test);
            expect(server.app.x).to.equal(2);
        });

        it('registers multiple plugins', async () => {

            const server = new Hapi.Server();
            let log = null;
            server.events.once('log', (event, tags) => {

                log = [event, tags];
            });

            await server.register([internals.plugins.test1, internals.plugins.test2]);
            expect(internals.routesList(server)).to.equal(['/test1', '/test2']);
            expect(log[1].test).to.equal(true);
            expect(log[0].data).to.equal('abc');
        });

        it('registers multiple plugins (verbose)', async () => {

            const server = new Hapi.Server();
            let log = null;
            server.events.once('log', (event, tags) => {

                log = [event, tags];
            });

            await server.register([{ register: internals.plugins.test1 }, { register: internals.plugins.test2 }]);
            expect(internals.routesList(server)).to.equal(['/test1', '/test2']);
            expect(log[1].test).to.equal(true);
            expect(log[0].data).to.equal('abc');
        });

        it('registers a child plugin', async () => {

            const server = new Hapi.Server();
            await server.register(internals.plugins.child);
            const res = await server.inject('/test1');
            expect(res.result).to.equal('testing123');
        });

        it('registers a plugin with routes path prefix', async () => {

            const server = new Hapi.Server();
            await server.register(internals.plugins.test1, { routes: { prefix: '/xyz' } });

            expect(server.plugins.test1.prefix).to.equal('/xyz');
            const res = await server.inject('/xyz/test1');
            expect(res.result).to.equal('testing123');
        });

        it('registers a plugin with routes path prefix (plugin options)', async () => {

            const server = new Hapi.Server();
            await server.register({ register: internals.plugins.test1, routes: { prefix: '/abc' } }, { routes: { prefix: '/xyz' } });

            expect(server.plugins.test1.prefix).to.equal('/abc');
            const res = await server.inject('/abc/test1');
            expect(res.result).to.equal('testing123');
        });

        it('register a plugin once (plugin options)', async () => {

            let count = 0;
            const b = function (srv, options) {

                ++count;
            };

            b.attributes = {
                name: 'b'
            };

            const a = async function (srv, options) {

                await srv.register({ register: b, once: true });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            await server.register(b);
            await server.register(a);
            await server.initialize();
            expect(count).to.equal(1);
        });

        it('registers plugins and adds options to realm that routes can access', async () => {

            const server = new Hapi.Server();

            const foo = function (srv, options) {

                expect(options.something).to.be.true();
                expect(srv.realm.pluginOptions).to.equal(options);

                srv.route({
                    method: 'GET', path: '/foo', handler: (request, h) => {

                        expect(request.route.realm.pluginOptions).to.equal(options);
                        expect(h.realm.pluginOptions).to.equal(options);
                        return 'foo';
                    }
                });
            };

            foo.attributes = {
                name: 'foo'
            };

            const bar = function (srv, options) {

                expect(options.something).to.be.false();
                expect(srv.realm.pluginOptions).to.equal(options);

                srv.route({
                    method: 'GET', path: '/bar', handler: (request, h) => {

                        expect(request.route.realm.pluginOptions).to.equal(options);
                        expect(h.realm.pluginOptions).to.equal(options);
                        return 'bar';
                    }
                });
            };

            bar.attributes = {
                name: 'bar'
            };

            const plugins = [
                { register: foo, options: { something: true } },
                { register: bar, options: { something: false } }
            ];

            await server.register(plugins);

            const res1 = await server.inject('/foo');
            expect(res1.result).to.equal('foo');

            const res2 = await server.inject('/bar');
            expect(res2.result).to.equal('bar');
        });

        it('registers a plugin with routes path prefix and plugin root route', async () => {

            const test = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: () => 'ok'
                });
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test, { routes: { prefix: '/xyz' } });

            const res = await server.inject('/xyz');
            expect(res.result).to.equal('ok');
        });

        it('ignores the type of the plugin value', async () => {

            const a = function () { };
            a.register = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: () => 'ok'
                });
            };

            a.register.attributes = { name: 'a' };

            const server = new Hapi.Server();
            await server.register(a, { routes: { prefix: '/xyz' } });

            const res = await server.inject('/xyz');
            expect(res.result).to.equal('ok');
        });

        it('ignores unknown plugin properties', async () => {

            const a = {
                register: function (srv, options) {

                    srv.route({
                        method: 'GET',
                        path: '/',
                        handler: () => 'ok'
                    });
                },
                other: {}
            };

            a.register.attributes = { name: 'a' };

            const server = new Hapi.Server();
            await server.register(a);
        });

        it('ignores unknown plugin properties (with options)', async () => {

            const a = {
                register: function (srv, options) {

                    srv.route({
                        method: 'GET',
                        path: '/',
                        handler: () => 'ok'
                    });
                },
                other: {}
            };

            a.register.attributes = { name: 'a' };

            const server = new Hapi.Server();
            await server.register({ register: a });
        });

        it('registers a child plugin with parent routes path prefix', async () => {

            const server = new Hapi.Server();
            await server.register(internals.plugins.child, { routes: { prefix: '/xyz' } });

            const res = await server.inject('/xyz/test1');
            expect(res.result).to.equal('testing123');
        });

        it('registers a child plugin with parent routes vhost prefix', async () => {

            const server = new Hapi.Server();
            await server.register(internals.plugins.child, { routes: { vhost: 'example.com' } });

            const res = await server.inject({ url: '/test1', headers: { host: 'example.com' } });
            expect(res.result).to.equal('testing123');
        });

        it('registers a child plugin with parent routes path prefix and inner register prefix', async () => {

            const server = new Hapi.Server();
            await server.register({ register: internals.plugins.child, options: { routes: { prefix: '/inner' } } }, { routes: { prefix: '/xyz' } });

            const res = await server.inject('/xyz/inner/test1');
            expect(res.result).to.equal('testing123');
        });

        it('registers a child plugin with parent routes vhost prefix and inner register vhost', async () => {

            const server = new Hapi.Server();
            await server.register({ register: internals.plugins.child, options: { routes: { vhost: 'example.net' } } }, { routes: { vhost: 'example.com' } });

            const res = await server.inject({ url: '/test1', headers: { host: 'example.com' } });
            expect(res.result).to.equal('testing123');
        });

        it('registers a plugin with routes vhost', async () => {

            const server = new Hapi.Server();
            await server.register(internals.plugins.test1, { routes: { vhost: 'example.com' } });

            const res1 = await server.inject('/test1');
            expect(res1.statusCode).to.equal(404);

            const res2 = await server.inject({ url: '/test1', headers: { host: 'example.com' } });
            expect(res2.result).to.equal('testing123');
        });

        it('registers a plugin with routes vhost (plugin options)', async () => {

            const server = new Hapi.Server();
            await server.register({ register: internals.plugins.test1, routes: { vhost: 'example.org' } }, { routes: { vhost: 'example.com' } });

            const res1 = await server.inject('/test1');
            expect(res1.statusCode).to.equal(404);

            const res2 = await server.inject({ url: '/test1', headers: { host: 'example.org' } });
            expect(res2.result).to.equal('testing123');
        });

        it('sets multiple dependencies in one statement', async () => {

            const a = function (srv, options) {

                srv.dependency(['b', 'c']);
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options) { };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options) { };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            await server.register(b);
            await server.register(c);
            await server.register(a);
            await server.initialize();
        });

        it('sets multiple dependencies in attributes', async () => {

            const a = function (srv, options) { };

            a.attributes = {
                name: 'a',
                dependencies: ['b', 'c']
            };

            const b = function (srv, options) { };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options) { };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            await server.register(b);
            await server.register(c);
            await server.register(a);
            await server.initialize();
        });

        it('sets multiple dependencies in multiple statements', async () => {

            const a = function (srv, options) {

                srv.dependency('b');
                srv.dependency('c');
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options) { };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options) { };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            await server.register(b);
            await server.register(c);
            await server.register(a);
            await server.initialize();
        });

        it('sets multiple dependencies in multiple locations', async () => {

            const a = function (srv, options) {

                srv.dependency('b');
            };

            a.attributes = {
                name: 'a',
                dependencies: 'c'
            };

            const b = function (srv, options) { };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options) { };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            await server.register(b);
            await server.register(c);
            await server.register(a);
            await server.initialize();
        });

        it('register a plugin once per connection (no selection left)', async () => {

            let count = 0;
            const b = function (srv, options) {

                ++count;
            };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options) {

                return srv.register(b, { once: true });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            await server.register(b);
            await server.register(a);
            await server.initialize();
            expect(count).to.equal(1);
        });

        it('throws when once used with plugin options', async () => {

            const a = function (srv, options) { };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            await expect(server.register({ register: a, options: {}, once: true })).to.reject();
        });

        it('throws when dependencies is an object', async () => {

            const a = function (srv, options) { };
            a.attributes = {
                name: 'a',
                dependencies: { b: true }
            };

            const server = new Hapi.Server();
            await expect(server.register(a)).to.reject();
        });

        it('throws when dependencies contain something else than a string', async () => {

            const a = function (srv, options) { };
            a.attributes = {
                name: 'a',
                dependencies: [true]
            };

            const server = new Hapi.Server();
            await expect(server.register(a)).to.reject();
        });

        it('exposes server decorations to next register', async () => {

            const server = new Hapi.Server();

            const b = function (srv, options) {

                if (typeof srv.a !== 'function') {
                    throw new Error('Missing decoration');
                }
            };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });
            };

            a.attributes = {
                name: 'a'
            };

            await server.register([a, b]);
            await server.initialize();
        });

        it('exposes server decorations to dependency (dependency first)', async () => {

            const server = new Hapi.Server();

            const a = function (srv, options) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options) {

                const after = function (srv2) {

                    if (typeof srv2.a !== 'function') {
                        throw new Error('Missing decoration');
                    }
                };

                srv.dependency('a', after);
            };

            b.attributes = {
                name: 'b'
            };

            await server.register([a, b]);
            await server.initialize();
        });

        it('exposes server decorations to dependency (dependency second)', async () => {

            const server = new Hapi.Server();

            const a = function (srv, options) {

                srv.decorate('server', 'a', () => 'a');
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options) {

                srv.realm.x = 1;
                const after = function (srv2) {

                    expect(srv2.realm.x).to.equal(1);
                    if (typeof srv2.a !== 'function') {
                        throw new Error('Missing decoration');
                    }
                };

                srv.dependency('a', after);
            };

            b.attributes = {
                name: 'b'
            };

            await server.register([b, a]);
            await server.initialize();
        });

        it('exposes server decorations to next register when nested', async () => {

            const server = new Hapi.Server();

            const a = function (srv, options) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });
            };

            a.attributes = {
                name: 'a'
            };

            const b = async function (srv, options) {

                await srv.register(a);
                if (typeof srv.a !== 'function') {
                    throw new Error('Missing decoration');
                }
            };

            b.attributes = {
                name: 'b'
            };

            await server.register([b]);
            await server.initialize();
        });
    });

    describe('auth', () => {

        it('adds auth strategy via plugin', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'authenticated!'
            });

            await server.register(internals.plugins.auth);

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ method: 'GET', url: '/', headers: { authorization: 'Basic ' + (new Buffer('john:12345', 'utf8')).toString('base64') } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.equal('authenticated!');
        });
    });

    describe('bind()', () => {

        it('sets plugin context', async () => {

            const test = function (srv, options) {

                const bind = {
                    value: 'in context',
                    suffix: ' throughout'
                };

                srv.bind(bind);

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function () {

                        return this.value;
                    }
                });

                const preResponse = function (request, h) {

                    return request.response.source + this.suffix;
                };

                srv.ext('onPreResponse', preResponse);
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test);

            const res = await server.inject('/');
            expect(res.result).to.equal('in context throughout');
        });
    });

    describe('cache()', () => {

        it('provisions a server cache', async () => {

            const server = new Hapi.Server();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            await server.initialize();

            await cache.set('a', 'going in', 0);
            const { value } = await cache.get('a');
            expect(value).to.equal('going in');
        });

        it('throws when missing segment', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.cache({ expiresIn: 1000 });
            }).to.throw('Missing cache segment name');
        });

        it('provisions a server cache with custom partition', async () => {

            const server = new Hapi.Server({ cache: { engine: CatboxMemory, partition: 'hapi-test-other' } });
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            await server.initialize();

            await cache.set('a', 'going in', 0);
            const { value } = await cache.get('a');
            expect(value).to.equal('going in');
            expect(cache._cache.connection.settings.partition).to.equal('hapi-test-other');
        });

        it('throws when allocating an invalid cache segment', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.cache({ segment: 'a', expiresAt: '12:00', expiresIn: 1000 });
            }).throws();
        });

        it('allows allocating a cache segment with empty options', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.cache({ segment: 'a' });
            }).to.not.throw();
        });

        it('allows reusing the same cache segment (server)', async () => {

            const server = new Hapi.Server({ cache: { engine: CatboxMemory, shared: true } });
            expect(() => {

                server.cache({ segment: 'a', expiresIn: 1000 });
                server.cache({ segment: 'a', expiresIn: 1000 });
            }).to.not.throw();
        });

        it('allows reusing the same cache segment (cache)', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.cache({ segment: 'a', expiresIn: 1000 });
                server.cache({ segment: 'a', expiresIn: 1000, shared: true });
            }).to.not.throw();
        });

        it('uses plugin cache interface', async () => {

            const test = function (srv, options) {

                const cache = srv.cache({ expiresIn: 10 });
                srv.expose({
                    get: function (key) {

                        return cache.get(key);
                    },
                    set: function (key, value) {

                        return cache.set(key, value, 0);
                    }
                });
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test);
            await server.initialize();

            await server.plugins.test.set('a', '1');
            const { value: value1 } = await server.plugins.test.get('a');
            expect(value1).to.equal('1');

            await Hoek.wait(11);
            const { value: value2 } = await server.plugins.test.get('a');
            expect(value2).to.equal(null);
        });
    });

    describe('cache.provision()', async () => {

        it('provisions a server cache (before initialization)', async () => {

            const server = new Hapi.Server();
            await server.cache.provision({ engine: CatboxMemory, name: 'dynamic' });
            const cache = server.cache({ cache: 'dynamic', segment: 'test', expiresIn: 1000 });

            await expect(cache.set('a', 'going in', 0)).to.reject();
            await server.initialize();

            await cache.set('a', 'going in', 0);
            const { value } = await cache.get('a');
            expect(value).to.equal('going in');
        });

        it('provisions a server cache (after initialization)', async () => {

            const server = new Hapi.Server();

            await server.initialize();
            await server.cache.provision({ engine: CatboxMemory, name: 'dynamic' });
            const cache = server.cache({ cache: 'dynamic', segment: 'test', expiresIn: 1000 });

            await cache.set('a', 'going in', 0);
            const { value } = await cache.get('a');
            expect(value).to.equal('going in');
        });

        it('provisions a server cache (promise)', async () => {

            const server = new Hapi.Server();
            await server.initialize();
            await server.cache.provision({ engine: CatboxMemory, name: 'dynamic' });
            const cache = server.cache({ cache: 'dynamic', segment: 'test', expiresIn: 1000 });

            await cache.set('a', 'going in', 0);
            const { value } = await cache.get('a');
            expect(value).to.equal('going in');
        });
    });

    describe('decorate()', () => {

        it('decorates request', async () => {

            const server = new Hapi.Server();

            const getId = function () {

                return this.info.id;
            };

            server.decorate('request', 'getId', getId);

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.getId()
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.match(/^.*\:.*\:.*\:.*\:.*$/);
        });

        it('decorates request (apply)', async () => {

            const server = new Hapi.Server();

            server.decorate('request', 'uri', (request) => request.server.info.uri, { apply: true });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.uri
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(server.info.uri);
        });

        it('decorates toolkit', async () => {

            const server = new Hapi.Server();

            const success = function () {

                return this.response({ status: 'ok' });
            };

            server.decorate('toolkit', 'success', success);

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => h.success()
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result.status).to.equal('ok');
        });

        it('throws on double toolkit decoration', async () => {

            const server = new Hapi.Server();

            server.decorate('toolkit', 'success', () => {

                return this.response({ status: 'ok' });
            });

            expect(() => {

                server.decorate('toolkit', 'success', () => { });
            }).to.throw('Reply interface decoration already defined: success');
        });

        it('throws on internal conflict', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.decorate('toolkit', 'redirect', () => { });
            }).to.throw('Cannot override built-in toolkit decoration: redirect');
        });

        it('decorates server', async () => {

            const server = new Hapi.Server();

            const ok = function (path) {

                server.route({
                    method: 'GET',
                    path,
                    handler: () => 'ok'
                });
            };

            server.decorate('server', 'ok', ok);

            server.ok('/');

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('ok');
        });

        it('throws on double server decoration', async () => {

            const server = new Hapi.Server();

            const ok = function (path) {

                server.route({
                    method: 'GET',
                    path,
                    handler: () => 'ok'
                });
            };

            server.decorate('server', 'ok', ok);

            expect(() => {

                server.decorate('server', 'ok', () => { });
            }).to.throw('Server decoration already defined: ok');
        });

        it('throws on server decoration root conflict', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.decorate('server', 'start', () => { });
            }).to.throw('Cannot override the built-in server interface method: start');
        });

        it('throws on server decoration plugin conflict', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.decorate('server', 'ext', () => { });
            }).to.throw('Cannot override the built-in server interface method: ext');
        });

        it('throws on invalid decoration name', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.decorate('server', '_special', () => { });
            }).to.throw('Property name cannot begin with an underscore: _special');
        });
    });

    describe('decorations ()', () => {

        it('shows decorations on request (empty array)', async () => {

            const server = new Hapi.Server();

            expect(server.decorations.request).to.be.empty();
        });

        it('shows decorations on request (single)', async () => {

            const server = new Hapi.Server();

            server.decorate('request', 'a', () => { });

            expect(server.decorations.request).to.equal(['a']);
        });

        it('shows decorations on request (many)', async () => {

            const server = new Hapi.Server();

            server.decorate('request', 'a', () => { });
            server.decorate('request', 'b', () => { });

            expect(server.decorations.request).to.equal(['a', 'b']);
        });

        it('shows decorations on toolkit (empty array)', async () => {

            const server = new Hapi.Server();

            expect(server.decorations.toolkit).to.be.empty();
        });

        it('shows decorations on toolkit (single)', async () => {

            const server = new Hapi.Server();

            server.decorate('toolkit', 'a', () => { });

            expect(server.decorations.toolkit).to.equal(['a']);
        });

        it('shows decorations on toolkit (many)', async () => {

            const server = new Hapi.Server();

            server.decorate('toolkit', 'a', () => { });
            server.decorate('toolkit', 'b', () => { });

            expect(server.decorations.toolkit).to.equal(['a', 'b']);
        });

        it('shows decorations on server (empty array)', async () => {

            const server = new Hapi.Server();

            expect(server.decorations.server).to.be.empty();
        });

        it('shows decorations on server (single)', async () => {

            const server = new Hapi.Server();

            server.decorate('server', 'a', () => { });

            expect(server.decorations.server).to.equal(['a']);
        });

        it('shows decorations on server (many)', async () => {

            const server = new Hapi.Server();

            server.decorate('server', 'a', () => { });
            server.decorate('server', 'b', () => { });

            expect(server.decorations.server).to.equal(['a', 'b']);
        });
    });

    describe('dependency()', () => {

        it('fails to register single plugin with dependencies', async () => {

            const test = function (srv, options) {

                srv.dependency('none');
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test);
            await expect(server.initialize()).to.reject('Plugin test missing dependency none');
        });

        it('fails to register single plugin with dependencies (attributes)', async () => {

            const test = function (srv, options) { };

            test.attributes = {
                name: 'test',
                dependencies: 'none'
            };

            const server = new Hapi.Server();
            await server.register(test);
            await expect(server.initialize()).to.reject('Plugin test missing dependency none');
        });

        it('fails to register multiple plugins with dependencies', async () => {

            const server = new Hapi.Server({ port: 80, host: 'localhost' });
            await server.register([internals.plugins.deps1, internals.plugins.deps3]);
            await expect(server.initialize()).to.reject('Plugin deps1 missing dependency deps2');
        });

        it('recognizes dependencies from peer plugins', async () => {

            const b = function (srv, options) { };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options) {

                return srv.register(b);
            };

            a.attributes = {
                name: 'a'
            };

            const c = function (srv, options) {

                srv.dependency('b');
            };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            await server.register([a, c]);
        });

        it('errors when missing inner dependencies', async () => {

            const b = function (srv, options) {

                srv.dependency('c');
            };

            const a = function (srv, options) {

                return srv.register(b);
            };

            a.attributes = {
                name: 'a'
            };

            b.attributes = {
                name: 'b'
            };

            const server = new Hapi.Server({ port: 80, host: 'localhost' });
            await server.register(a);
            await expect(server.initialize()).to.reject('Plugin b missing dependency c');
        });

        it('errors when missing inner dependencies (attributes)', async () => {

            const b = function (srv, options) { };

            b.attributes = {
                name: 'b',
                dependencies: 'c'
            };

            const a = function (srv, options) {

                return srv.register(b);
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server({ port: 80, host: 'localhost' });
            await server.register(a);
            await expect(server.initialize()).to.reject('Plugin b missing dependency c');
        });
    });

    describe('encoder()', () => {

        it('adds custom encoder', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server({ compression: { minBytes: 1 }, routes: { compression: { test: { some: 'option' } } } });

            const encoder = (options) => {

                expect(options).to.equal({ some: 'option' });
                return Zlib.createGzip();
            };

            server.encoder('test', encoder);
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await new Promise((resolve) => Zlib.gzip(new Buffer(data), (ignoreErr, compressed) => resolve(compressed)));
            const { res, payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'test' }, payload: data });
            expect(res.headers['content-encoding']).to.equal('test');
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });
    });

    describe('events', () => {

        it('extends server events', async () => {

            const server = new Hapi.Server();

            const updates = [];
            server.event({ name: 'test', channels: ['x', 'y'] });

            server.events.on({ name: 'test', channels: 'x' }, (update) => updates.push({ id: 'server', channel: 'x', update }));

            let plugin;
            const test = function (srv, options) {

                srv.events.on({ name: 'test', channels: 'y' }, (update) => updates.push({ id: 'plugin', channel: 'y', update }));
                plugin = srv;
            };

            test.attributes = {
                name: 'test'
            };

            server.events.on('test', (update) => updates.push({ id: 'server', update }));

            await server.register(test);

            server.events.emit('test', 1);
            server.events.emit({ name: 'test', channel: 'x' }, 2);
            await plugin.events.emit({ name: 'test', channel: 'y' }, 3);

            expect(updates).to.equal([
                { id: 'server', update: 1 },
                { id: 'server', channel: 'x', update: 2 },
                { id: 'server', update: 2 },
                { id: 'server', update: 3 },
                { id: 'plugin', channel: 'y', update: 3 }
            ]);
        });
    });

    describe('expose()', () => {

        it('exposes an api', async () => {

            const server = new Hapi.Server();

            await server.register(internals.plugins.test1);
            expect(internals.routesList(server)).to.equal(['/test1']);
            expect(server.plugins.test1.add(1, 3)).to.equal(4);
            expect(server.plugins.test1.glue('1', '3')).to.equal('13');
        });
    });

    describe('ext()', () => {

        it('extends onRequest point', async () => {

            const test = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/b',
                    handler: () => 'b'
                });

                const onRequest = (request, h) => {

                    request.setUrl('/b');
                    return h.continue;
                };

                srv.ext('onRequest', onRequest);
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test);

            expect(internals.routesList(server)).to.equal(['/b']);
            const res = await server.inject('/a');
            expect(res.result).to.equal('b');
        });

        it('adds multiple ext functions with complex dependencies', async () => {

            // Generate a plugin with a specific index and ext dependencies.

            const pluginCurrier = function (num, deps) {

                const plugin = function (server, options) {

                    const onRequest = (request, h) => {

                        request.app.complexDeps = request.app.complexDeps || '|';
                        request.app.complexDeps += num + '|';
                        return h.continue;
                    };

                    server.ext('onRequest', onRequest, deps);
                };

                plugin.attributes = {
                    name: 'deps' + num
                };

                return plugin;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.app.complexDeps });

            await server.register([
                pluginCurrier(1, { after: 'deps2' }),
                pluginCurrier(2),
                pluginCurrier(3, { before: ['deps1', 'deps2'] })
            ]);

            await server.initialize();

            const res = await server.inject('/');
            expect(res.result).to.equal('|3|2|1|');
        });

        it('binds server ext to context (options)', async () => {

            const server = new Hapi.Server();

            const bind = {
                state: false
            };

            const preStart = function (srv) {

                this.state = true;
            };

            server.ext('onPreStart', preStart, { bind });

            await server.initialize();
            expect(bind.state).to.be.true();
        });

        it('binds server ext to context (argument)', async () => {

            const server = new Hapi.Server();

            const bind = {
                state: false
            };

            const preStart = (srv, context) => {

                context.state = true;
            };

            server.ext('onPreStart', preStart, { bind });

            await server.initialize();
            expect(bind.state).to.be.true();
        });

        it('binds server ext to context (realm)', async () => {

            const server = new Hapi.Server();

            const bind = {
                state: false
            };

            server.bind(bind);
            const preStart = function (srv) {

                this.state = true;
            };

            server.ext('onPreStart', preStart);

            await server.initialize();
            expect(bind.state).to.be.true();
        });

        it('extends server actions', async () => {

            const server = new Hapi.Server();

            let result = '';
            const preStart = function (srv) {

                result += '1';
            };

            server.ext('onPreStart', preStart);

            const postStart = function (srv) {

                result += '2';
            };

            server.ext('onPostStart', postStart);

            const preStop = function (srv) {

                result += '3';
            };

            server.ext('onPreStop', preStop);

            const postStop = function (srv) {

                result += '4';
            };

            server.ext('onPostStop', postStop);

            await server.start();
            expect(result).to.equal('12');

            await server.stop();
            expect(result).to.equal('1234');
        });

        it('extends server actions (single call)', async () => {

            const server = new Hapi.Server();

            let result = '';
            server.ext([
                {
                    type: 'onPreStart',
                    method: function (srv) {

                        result += '1';
                    }
                },
                {
                    type: 'onPostStart',
                    method: function (srv) {

                        result += '2';
                    }
                },
                {
                    type: 'onPreStop',
                    method: function (srv) {

                        result += '3';
                    }
                },
                {
                    type: 'onPreStop',
                    method: function (srv) {

                        result += '4';
                    }
                }
            ]);

            await server.start();
            expect(result).to.equal('12');

            await server.stop();
            expect(result).to.equal('1234');
        });

        it('combine route extensions', async () => {

            const server = new Hapi.Server();

            const preAuth = (request, h) => {

                request.app.x = '1';
                return h.continue;
            };

            server.ext('onPreAuth', preAuth);

            const plugin = function (srv, options) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    config: {
                        ext: {
                            onPreAuth: {
                                method: (request, h) => {

                                    request.app.x += '2';
                                    return h.continue;
                                }
                            }
                        },
                        handler: (request) => request.app.x
                    }
                });

                const preAuthSandbox = (request, h) => {

                    request.app.x += '3';
                    return h.continue;
                };

                srv.ext('onPreAuth', preAuthSandbox, { sandbox: 'plugin' });
            };

            plugin.attributes = {
                name: 'test'
            };

            await server.register(plugin);

            server.route({
                method: 'GET',
                path: '/a',
                handler: (request) => request.app.x
            });

            const res1 = await server.inject('/');
            expect(res1.result).to.equal('123');

            const res2 = await server.inject('/a');
            expect(res2.result).to.equal('1');
        });

        it('calls method after plugin', async () => {

            const x = function (srv, options) {

                srv.expose('a', 'b');
            };

            x.attributes = {
                name: 'x'
            };

            const server = new Hapi.Server();

            expect(server.plugins.x).to.not.exist();

            let called = false;
            const preStart = function (srv) {

                expect(srv.plugins.x.a).to.equal('b');
                called = true;
            };

            server.ext('onPreStart', preStart, { after: 'x' });

            await server.register(x);
            await server.initialize();
            expect(called).to.be.true();
        });

        it('calls method before start', async () => {

            const server = new Hapi.Server();

            let called = false;
            const preStart = function (srv) {

                called = true;
            };

            server.ext('onPreStart', preStart);

            await server.initialize();
            expect(called).to.be.true();
        });

        it('calls method before start even if plugin not registered', async () => {

            const server = new Hapi.Server();

            let called = false;
            const preStart = function (srv) {

                called = true;
            };

            server.ext('onPreStart', preStart, { after: 'x' });

            await server.initialize();
            expect(called).to.be.true();
        });

        it('fails to start server when after method fails', async () => {

            const test = function (srv, options) {

                const preStart1 = function (inner) { };

                srv.ext('onPreStart', preStart1);

                const preStart2 = function (inner) {

                    throw new Error('Not in the mood');
                };

                srv.ext('onPreStart', preStart2);
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test);
            await expect(server.initialize()).to.reject('Not in the mood');
        });

        it('errors when added after initialization', async () => {

            const server = new Hapi.Server();

            await server.initialize();
            expect(() => {

                server.ext('onPreStart', () => { });
            }).to.throw('Cannot add onPreStart (after) extension after the server was initialized');
        });
    });

    describe('handler()', () => {

        it('add new handler', async () => {

            const test = function (srv, options1) {

                const handler = function (route, options2) {

                    return (request) => 'success';
                };

                srv.handler('bar', handler);
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register(test);

            server.route({
                method: 'GET',
                path: '/',
                handler: {
                    bar: {}
                }
            });

            const res = await server.inject('/');
            expect(res.payload).to.equal('success');
        });

        it('errors on duplicate handler', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);

            expect(() => {

                server.handler('file', () => { });
            }).to.throw('Handler name already exists: file');
        });

        it('errors on unknown handler', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.route({ method: 'GET', path: '/', handler: { test: {} } });
            }).to.throw('Unknown handler: test');
        });

        it('errors on non-string name', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.handler();
            }).to.throw('Invalid handler name');
        });

        it('errors on non-function handler', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.handler('foo', 'bar');
            }).to.throw('Handler must be a function: foo');
        });
    });

    describe('log()', () => {

        it('emits a log event', async () => {

            const server = new Hapi.Server();

            let count = 0;
            server.events.once('log', (event, tags) => {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.events.once('log', (event, tags) => {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.log('1', 'log event 1', Date.now());

            server.events.once('log', (event, tags) => {

                ++count;
                expect(event.data).to.equal('log event 2');
            });

            server.log(['2'], 'log event 2', new Date(Date.now()));
            await Hoek.wait(10);
            expect(count).to.equal(3);
        });

        it('emits a log event (function data)', async () => {

            const server = new Hapi.Server();
            const log = server.events.once('log');
            server.log('test', () => 123);
            const [event] = await log;
            expect(event.data).to.equal(123);
        });

        it('emits a log event and print to console', async () => {

            const server = new Hapi.Server({ debug: { log: 'implementation' } });

            server.events.once('log', (event, tags) => {

                expect(event.data).to.equal('log event 1');
            });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function () {

                    console.error = orig;
                    expect(arguments[0]).to.equal('Debug:');
                    expect(arguments[1]).to.equal('internal, implementation, error');

                    resolve();
                };
            });

            server.log(['internal', 'implementation', 'error'], 'log event 1');
            await log;
        });

        it('outputs log data to debug console', async () => {

            const server = new Hapi.Server({ debug: { log: '*' } });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function () {

                    console.error = orig;
                    expect(arguments[0]).to.equal('Debug:');
                    expect(arguments[1]).to.equal('implementation');
                    expect(arguments[2]).to.equal('\n    {"data":1}');

                    resolve();
                };
            });

            server.log(['implementation'], { data: 1 });
            await log;
        });

        it('outputs log error data to debug console', async () => {

            const server = new Hapi.Server({ debug: { log: '*' } });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function () {

                    console.error = orig;
                    expect(arguments[0]).to.equal('Debug:');
                    expect(arguments[1]).to.equal('implementation');
                    expect(arguments[2]).to.contain('\n    Error: test\n    at');
                    resolve();
                };
            });

            server.log(['implementation'], new Error('test'));
            await log;
        });

        it('outputs log data to debug console without data', async () => {

            const server = new Hapi.Server({ debug: { log: '*' } });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function () {

                    console.error = orig;
                    expect(arguments[0]).to.equal('Debug:');
                    expect(arguments[1]).to.equal('implementation');
                    expect(arguments[2]).to.equal('');
                    resolve();
                };
            });

            server.log(['implementation']);
            await log;
        });

        it('does not output events when debug disabled', async () => {

            const server = new Hapi.Server({ debug: false });

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
        });

        it('does not output events when debug.log disabled', async () => {

            const server = new Hapi.Server({ debug: { log: false } });

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
        });

        it('does not output non-implementation events by default', async () => {

            const server = new Hapi.Server();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['xyz']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
        });

        it('emits server log events once', async () => {

            let pc = 0;
            const test = function (srv, options) {

                srv.events.on('log', (event, tags) => ++pc);
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();

            let sc = 0;
            server.events.on('log', (event, tags) => ++sc);

            await server.register(test);
            server.log('test');
            expect(sc).to.equal(1);
            expect(pc).to.equal(1);
        });

        it('emits log events after handler error when server is started', async () => {

            const server = new Hapi.Server({ debug: false });

            const updates = [];
            const test = function (srv, options) {

                srv.events.on('log', (event, tags) => updates.push(event.tags));
                srv.events.on('response', (request) => updates.push('response'));
                srv.events.on('request-error', (request, err) => updates.push('request-error'));
            };

            test.attributes = {
                name: 'test'
            };

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => {

                    request.server.log('1');
                    throw new Error('2');
                }
            });

            await server.register(test);
            await server.start();

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            await Hoek.wait(10);
            expect(updates).to.equal([['1'], 'request-error', 'response']);
            await server.stop();
        });

        it('outputs logs for all server log events with a wildcard', async () => {

            const server = new Hapi.Server({ debug: { log: '*' } });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function () {

                    console.error = orig;
                    expect(arguments[0]).to.equal('Debug:');
                    expect(arguments[1]).to.equal('foobar');
                    expect(arguments[2]).to.equal('\n    {"data":1}');
                    resolve();
                };
            });

            server.log(['foobar'], { data: 1 });
            await log;
        });

        it('outputs logs for all request log events with a wildcard', async () => {

            const server = new Hapi.Server({ debug: { request: '*' } });

            const expectedLogs = [
                ['Debug:', 'handler, error']
            ];

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function (...args) {

                    expect(args).to.contain(expectedLogs.shift());
                    if (expectedLogs.length === 0) {
                        console.error = orig;
                        resolve();
                    }
                };
            });

            server.inject('/', () => { });
            await log;
        });
    });

    describe('lookup()', () => {

        it('returns route based on id', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    id: 'root',
                    app: { test: 123 }
                }
            });

            const root = server.lookup('root');
            expect(root.path).to.equal('/');
            expect(root.settings.app.test).to.equal(123);
        });

        it('returns null on unknown route', async () => {

            const server = new Hapi.Server();
            const root = server.lookup('root');
            expect(root).to.be.null();
        });

        it('throws on missing id', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.lookup();
            }).to.throw('Invalid route id: ');
        });
    });

    describe('match()', () => {

        it('returns route based on path', async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    id: 'root'
                }
            });

            server.route({
                method: 'GET',
                path: '/abc',
                config: {
                    handler: () => null,
                    id: 'abc'
                }
            });

            server.route({
                method: 'POST',
                path: '/abc',
                config: {
                    handler: () => null,
                    id: 'post'
                }
            });

            server.route({
                method: 'GET',
                path: '/{p}/{x}',
                config: {
                    handler: () => null,
                    id: 'params'
                }
            });

            server.route({
                method: 'GET',
                path: '/abc',
                vhost: 'example.com',
                config: {
                    handler: () => null,
                    id: 'vhost'
                }
            });

            expect(server.match('GET', '/').settings.id).to.equal('root');
            expect(server.match('GET', '/none')).to.equal(null);
            expect(server.match('GET', '/abc').settings.id).to.equal('abc');
            expect(server.match('get', '/').settings.id).to.equal('root');
            expect(server.match('post', '/abc').settings.id).to.equal('post');
            expect(server.match('get', '/a/b').settings.id).to.equal('params');
            expect(server.match('GET', '/abc', 'example.com').settings.id).to.equal('vhost');
        });

        it('throws on missing method', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.match();
            }).to.throw('Invalid method: ');
        });

        it('throws on invalid method', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.match(5);
            }).to.throw('Invalid method: 5');
        });

        it('throws on missing path', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.match('get');
            }).to.throw('Invalid path: ');
        });

        it('throws on invalid path type', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.match('get', 5);
            }).to.throw('Invalid path: 5');
        });

        it('throws on invalid path prefix', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.match('get', '5');
            }).to.throw('Invalid path: 5');
        });

        it('throws on invalid path', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/{p}',
                handler: () => null
            });

            expect(() => {

                server.match('GET', '/%p');
            }).to.throw('Invalid path: /%p');
        });

        it('throws on invalid host type', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.match('get', '/a', 5);
            }).to.throw('Invalid host: 5');
        });
    });

    describe('method()', () => {

        it('adds server method using arguments', async () => {

            const server = new Hapi.Server();

            const test = function (srv, options) {

                const method = function (methodNext) {

                    return methodNext(null);
                };

                srv.method('log', method);
            };

            test.attributes = {
                name: 'test'
            };

            await server.register(test);
        });

        it('adds server method with plugin bind', async () => {

            const server = new Hapi.Server();

            const test = function (srv, options) {

                srv.bind({ x: 1 });
                const method = function () {

                    return this.x;
                };

                srv.method('log', method);
            };

            test.attributes = {
                name: 'test'
            };

            await server.register(test);
            const result = server.methods.log();
            expect(result).to.equal(1);
        });

        it('adds server method with method bind', async () => {

            const server = new Hapi.Server();

            const test = function (srv, options) {

                const method = function () {

                    return this.x;
                };

                srv.method('log', method, { bind: { x: 2 } });
            };

            test.attributes = {
                name: 'test'
            };

            await server.register(test);

            const result = server.methods.log();
            expect(result).to.equal(2);
        });

        it('adds server method with method and ext bind', async () => {

            const server = new Hapi.Server();

            const test = function (srv, options) {

                srv.bind({ x: 1 });
                const method = function () {

                    return this.x;
                };

                srv.method('log', method, { bind: { x: 2 } });
            };

            test.attributes = {
                name: 'test'
            };

            await server.register(test);

            const result = server.methods.log();
            expect(result).to.equal(2);
        });
    });

    describe('path()', () => {

        it('sets local path for directory route handler', async () => {

            const test = function (srv, options) {

                srv.path(Path.join(__dirname, '..'));

                srv.route({
                    method: 'GET',
                    path: '/handler/{file*}',
                    handler: {
                        directory: {
                            path: './'
                        }
                    }
                });
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server({ routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            await server.register(test);

            const res = await server.inject('/handler/package.json');
            expect(res.statusCode).to.equal(200);
        });

        it('throws when plugin sets undefined path', async () => {

            const test = function (srv, options) {

                srv.path();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await expect(server.register(test)).to.reject('relativeTo must be a non-empty string');
        });
    });

    describe('render()', () => {

        it('renders view', async () => {

            const server = new Hapi.Server();
            await server.register(Vision);
            server.views({
                engines: { html: Handlebars },
                path: __dirname + '/templates'
            });

            const rendered = await server.render('test', { title: 'test', message: 'Hapi' });
            expect(rendered).to.exist();
            expect(rendered).to.contain('Hapi');
        });
    });

    describe('views()', () => {

        it('requires plugin with views', async () => {

            const test = function (srv, options) {

                srv.path(__dirname);

                const views = {
                    engines: { 'html': Handlebars },
                    path: './templates/plugin'
                };

                srv.views(views);
                if (Object.keys(views).length !== 2) {
                    throw new Error('plugin.view() modified options');
                }

                srv.route([
                    {
                        path: '/view',
                        method: 'GET',
                        handler: (request, h) => h.view('test', { message: options.message })
                    },
                    {
                        path: '/file',
                        method: 'GET',
                        handler: { file: './templates/plugin/test.html' }
                    }
                ]);

                const onRequest = (request, h) => {

                    if (request.path === '/ext') {
                        return h.view('test', { message: 'grabbed' }).takeover();
                    }

                    return h.continue;
                };

                srv.ext('onRequest', onRequest);
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            await server.register([Inert, Vision]);
            await server.register({ register: test, options: { message: 'viewing it' } });

            const res1 = await server.inject('/view');
            expect(res1.result).to.equal('<h1>viewing it</h1>');

            const res2 = await server.inject('/file');
            expect(res2.result).to.equal('<h1>{{message}}</h1>');

            const res3 = await server.inject('/ext');
            expect(res3.result).to.equal('<h1>grabbed</h1>');
        });
    });
});


internals.routesList = function (server) {

    const tables = server.table();

    const list = [];
    for (let i = 0; i < tables.length; ++i) {
        const routes = tables[i].table;
        for (let j = 0; j < routes.length; ++j) {
            const route = routes[j];
            if (route.method === 'get') {
                list.push(route.path);
            }
        }
    }

    return list;
};


internals.plugins = {
    auth: function (server, options) {

        const scheme = function (srv, authOptions) {

            const settings = Hoek.clone(authOptions);

            return {
                authenticate: (request, h) => {

                    const req = request.raw.req;
                    const authorization = req.headers.authorization;
                    if (!authorization) {
                        throw Boom.unauthorized(null, 'Basic');
                    }

                    const parts = authorization.split(/\s+/);

                    if (parts[0] &&
                        parts[0].toLowerCase() !== 'basic') {

                        throw Boom.unauthorized(null, 'Basic');
                    }

                    if (parts.length !== 2) {
                        throw Boom.badRequest('Bad HTTP authentication header format', 'Basic');
                    }

                    const credentialsParts = new Buffer(parts[1], 'base64').toString().split(':');
                    if (credentialsParts.length !== 2) {
                        throw Boom.badRequest('Bad header internal syntax', 'Basic');
                    }

                    const username = credentialsParts[0];
                    const password = credentialsParts[1];

                    const { isValid, credentials } = settings.validateFunc(username, password);
                    if (!isValid) {
                        return h.unauthenticated(Boom.unauthorized('Bad username or password', 'Basic'), { credentials });
                    }

                    return h.authenticated({ credentials });
                }
            };
        };

        server.auth.scheme('basic', scheme);

        const loadUser = function (username, password) {

            if (username === 'john') {
                return { isValid: password === '12345', credentials: { user: 'john' } };
            }

            return { isValid: false };
        };

        server.auth.strategy('basic', 'basic', 'required', { validateFunc: loadUser });

        server.auth.scheme('special', () => {

            return { authenticate: function () { } };
        });

        server.auth.strategy('special', 'special', {});
    },
    child: function (server, options) {

        if (options.routes) {
            return server.register(internals.plugins.test1, options);
        }

        return server.register(internals.plugins.test1);
    },
    deps1: function (server, options) {

        const after = function (srv) {

            srv.expose('breaking', srv.plugins.deps2.breaking);
        };

        server.dependency('deps2', after);

        const onRequest = (request, h) => {

            request.app.deps = request.app.deps || '|';
            request.app.deps += '1|';
            return h.continue;
        };

        server.ext('onRequest', onRequest, { after: 'deps3' });
    },
    deps2: function (server, options) {

        const onRequest = (request, h) => {

            request.app.deps = request.app.deps || '|';
            request.app.deps += '2|';
            return h.continue;
        };

        server.ext('onRequest', onRequest, { after: 'deps3', before: 'deps1' });
        server.expose('breaking', 'bad');
    },
    deps3: function (server, options) {

        const onRequest = (request, h) => {

            request.app.deps = request.app.deps || '|';
            request.app.deps += '3|';
            return h.continue;
        };

        server.ext('onRequest', onRequest);
    },
    test1: function (server, options) {

        const handler = (request) => {

            return 'testing123' + ((server.settings.app && server.settings.app.my) || '');
        };

        server.route({ path: '/test1', method: 'GET', handler });

        server.expose({
            add: function (a, b) {

                return a + b;
            }
        });

        const glue = function (a, b) {

            return a + b;
        };

        server.expose('glue', glue);
        server.expose('prefix', server.realm.modifiers.route.prefix);
    },
    test2: function (server, options) {

        server.route({
            path: '/test2',
            method: 'GET',
            handler: () => 'testing123'
        });

        server.log('test', 'abc');
    }
};


internals.plugins.auth.attributes = {
    name: 'auth'
};


internals.plugins.child.attributes = {
    name: 'child'
};


internals.plugins.deps1.attributes = {
    name: 'deps1'
};


internals.plugins.deps2.attributes = {
    name: 'deps2'
};


internals.plugins.deps3.attributes = {
    name: 'deps3'
};


internals.plugins.test1.attributes = {
    name: 'test1',
    version: '1.0.0'
};


internals.plugins.test2.attributes = {
    pkg: {
        name: 'test2',
        version: '1.0.0'
    }
};
