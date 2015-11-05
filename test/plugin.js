'use strict';

// Load modules

const Path = require('path');
const Boom = require('boom');
const CatboxMemory = require('catbox-memory');
const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Lab = require('lab');
const Vision = require('vision');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Plugin', () => {

    describe('select()', () => {

        it('creates a subset of connections for manipulation', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'c'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd'] });
            server.connection({ labels: ['s4', 'b', 'x'] });

            const register = function (srv, options, next) {

                const a = srv.select('a');
                const ab = a.select('b');
                const memoryx = srv.select('x', 's4');
                const sodd = srv.select(['s2', 's4']);

                expect(srv.connections.length).to.equal(4);
                expect(a.connections.length).to.equal(3);
                expect(ab.connections.length).to.equal(2);
                expect(memoryx.connections.length).to.equal(1);
                expect(sodd.connections.length).to.equal(2);

                srv.route({
                    method: 'GET',
                    path: '/all',
                    handler: function (request, reply) {

                        return reply('all');
                    }
                });

                a.route({
                    method: 'GET',
                    path: '/a',
                    handler: function (request, reply) {

                        return reply('a');
                    }
                });

                ab.route({
                    method: 'GET',
                    path: '/ab',
                    handler: function (request, reply) {

                        return reply('ab');
                    }
                });

                memoryx.route({

                    method: 'GET',
                    path: '/memoryx',
                    handler: function (request, reply) {

                        return reply('memoryx');
                    }
                });

                sodd.route({
                    method: 'GET',
                    path: '/sodd',
                    handler: function (request, reply) {

                        return reply('sodd');
                    }
                });

                memoryx.state('sid', { encoding: 'base64' });
                const method = function (nxt) {

                    return nxt(null, '123');
                };

                srv.method({ name: 'testMethod', method: method, options: { cache: { expiresIn: 1000, generateTimeout: 10 } } });

                srv.methods.testMethod((err, result1) => {

                    expect(result1).to.equal('123');

                    srv.methods.testMethod((err, result2) => {

                        expect(result2).to.equal('123');
                        return next();
                    });
                });
            };

            register.attributes = {
                name: 'plugin'
            };

            server.register(register, (err) => {

                expect(err).to.not.exist();

                expect(internals.routesList(server, 's1')).to.deep.equal(['/a', '/ab', '/all']);
                expect(internals.routesList(server, 's2')).to.deep.equal(['/a', '/all', '/sodd']);
                expect(internals.routesList(server, 's3')).to.deep.equal(['/a', '/ab', '/all']);
                expect(internals.routesList(server, 's4')).to.deep.equal(['/all', '/memoryx', '/sodd']);
                done();
            });
        });

        it('registers a plugin on selection inside a plugin', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            const child = function (srv, options, next) {

                srv.expose('key2', srv.connections.length);
                return next();
            };

            child.attributes = {
                name: 'child'
            };

            const test = function (srv, options, next) {

                srv.expose('key1', srv.connections.length);
                srv.select('a').register(child, next);
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, { select: ['a', 'b'] }, (err) => {

                expect(err).to.not.exist();
                expect(server.plugins.test.key1).to.equal(2);
                expect(server.plugins.child.key2).to.equal(1);
                done();
            });
        });
    });

    describe('register()', () => {

        it('registers plugin with options', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a', 'b'] });

            const test = function (srv, options, next) {

                expect(options.something).to.be.true();
                expect(srv.realm.pluginOptions).to.equal(options);
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register({ register: test, options: { something: true } }, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('registers a required plugin', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a', 'b'] });

            const test = {
                register: function (srv, options, next) {

                    expect(options.something).to.be.true();
                    return next();
                }
            };

            test.register.attributes = {
                name: 'test'
            };

            server.register({ register: test, options: { something: true } }, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('throws on bad plugin (missing attributes)', (done) => {

            const server = new Hapi.Server();
            expect(() => {

                server.register({
                    register: function (srv, options, next) {

                        return next();
                    }
                }, (err) => { });

            }).to.throw();

            done();
        });

        it('throws on bad plugin (missing name)', (done) => {

            const register = function (srv, options, next) {

                return next();
            };

            register.attributes = {};

            const server = new Hapi.Server();
            expect(() => {

                server.register(register, (err) => { });
            }).to.throw();

            done();
        });

        it('throws on bad plugin (empty pkg)', (done) => {

            const register = function (srv, options, next) {

                return next();
            };

            register.attributes = {
                pkg: {}
            };

            const server = new Hapi.Server();
            expect(() => {

                server.register(register, (err) => { });
            }).to.throw();

            done();
        });

        it('throws when register is missing a callback function', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a', 'b'] });

            const test = function (srv, options, next) {

                expect(options.something).to.be.true();
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            expect(() => {

                server.register(test);
            }).to.throw('A callback function is required to register a plugin');
            done();
        });

        it('returns plugin error', (done) => {

            const test = function (srv, options, next) {

                return next(new Error('from plugin'));
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('from plugin');
                done();
            });
        });

        it('sets version to 0.0.0 if missing', (done) => {

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply(srv.version);
                    }
                });
                return next();
            };

            test.attributes = {
                pkg: {
                    name: 'steve'
                }
            };

            const server = new Hapi.Server();
            server.connection();

            server.register(test, (err) => {

                expect(err).to.not.exist();
                expect(server.connections[0].registrations.steve.version).to.equal('0.0.0');
                server.inject('/', (res) => {

                    expect(res.result).to.equal(require('../package.json').version);
                    done();
                });
            });
        });

        it('exposes plugin registration information', (done) => {

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply(srv.version);
                    }
                });
                return next();
            };

            test.attributes = {
                multiple: true,
                pkg: {
                    name: 'bob',
                    version: '1.2.3'
                }
            };

            const server = new Hapi.Server();
            server.connection();

            server.register({
                register: test,
                options: { foo: 'bar' }
            }, (err) => {

                expect(err).to.not.exist();
                const bob = server.connections[0].registrations.bob;
                expect(bob).to.exist();
                expect(bob).to.be.an.object();
                expect(bob.version).to.equal('1.2.3');
                expect(bob.attributes.multiple).to.be.true();
                expect(bob.options.foo).to.equal('bar');
                server.inject('/', (res) => {

                    expect(res.result).to.equal(require('../package.json').version);
                    done();
                });
            });
        });

        it('prevents plugin from multiple registrations', (done) => {

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/a',
                    handler: function (request, reply) {

                        return reply('a');
                    }
                });

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection({ host: 'example.com' });
            server.register(test, (err) => {

                expect(err).to.not.exist();
                expect(() => {

                    server.register(test, (err) => { });
                }).to.throw('Plugin test already registered in: http://example.com');

                done();
            });
        });

        it('allows plugin multiple registrations (attributes)', (done) => {

            const test = function (srv, options, next) {

                srv.app.x = srv.app.x ? srv.app.x + 1 : 1;
                return next();
            };

            test.attributes = {
                name: 'test',
                multiple: true
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.register(test, (err) => {

                    expect(err).to.not.exist();
                    expect(server.app.x).to.equal(2);
                    done();
                });
            });
        });

        it('registers multiple plugins', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            let log = null;
            server.once('log', (event, tags) => {

                log = [event, tags];
            });

            server.register([internals.plugins.test1, internals.plugins.test2], (err) => {

                expect(err).to.not.exist();
                expect(internals.routesList(server)).to.deep.equal(['/test1', '/test2']);
                expect(log[1].test).to.equal(true);
                expect(log[0].data).to.equal('abc');
                done();
            });
        });

        it('registers multiple plugins (verbose)', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            let log = null;
            server.once('log', (event, tags) => {

                log = [event, tags];
            });

            server.register([{ register: internals.plugins.test1 }, { register: internals.plugins.test2 }], (err) => {

                expect(err).to.not.exist();
                expect(internals.routesList(server)).to.deep.equal(['/test1', '/test2']);
                expect(log[1].test).to.equal(true);
                expect(log[0].data).to.equal('abc');
                done();
            });
        });

        it('registers a child plugin', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.child, (err) => {

                expect(err).to.not.exist();
                server.inject('/test1', (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a plugin with routes path prefix', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.test1, { routes: { prefix: '/xyz' } }, (err) => {

                expect(server.plugins.test1.prefix).to.equal('/xyz');
                expect(err).to.not.exist();
                server.inject('/xyz/test1', (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a plugin with routes path prefix (plugin options)', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ register: internals.plugins.test1, routes: { prefix: '/abc' } }, { routes: { prefix: '/xyz' } }, (err) => {

                expect(server.plugins.test1.prefix).to.equal('/abc');
                expect(err).to.not.exist();
                server.inject('/abc/test1', (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a plugin with routes path prefix and plugin root route', (done) => {

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(test, { routes: { prefix: '/xyz' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/xyz', (res) => {

                    expect(res.result).to.equal('ok');
                    done();
                });
            });
        });

        it('ignores the type of the plugin value', (done) => {

            const a = function () { };
            a.register = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
                return next();
            };

            a.register.attributes = { name: 'a' };

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(a, { routes: { prefix: '/xyz' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/xyz', (res) => {

                    expect(res.result).to.equal('ok');
                    done();
                });
            });
        });

        it('ignores unknown plugin properties', (done) => {

            const a = {
                register: function (srv, options, next) {

                    srv.route({
                        method: 'GET',
                        path: '/',
                        handler: function (request, reply) {

                            return reply('ok');
                        }
                    });
                    return next();
                },
                other: {}
            };

            a.register.attributes = { name: 'a' };

            const server = new Hapi.Server();
            server.connection();
            server.register(a, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('ignores unknown plugin properties (with options)', (done) => {

            const a = {
                register: function (srv, options, next) {

                    srv.route({
                        method: 'GET',
                        path: '/',
                        handler: function (request, reply) {

                            return reply('ok');
                        }
                    });
                    return next();
                },
                other: {}
            };

            a.register.attributes = { name: 'a' };

            const server = new Hapi.Server();
            server.connection();
            server.register({ register: a }, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('registers a child plugin with parent routes path prefix', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.child, { routes: { prefix: '/xyz' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/xyz/test1', (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a child plugin with parent routes vhost prefix', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.child, { routes: { vhost: 'example.com' } }, (err) => {

                expect(err).to.not.exist();
                server.inject({ url: '/test1', headers: { host: 'example.com' } }, (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a child plugin with parent routes path prefix and inner register prefix', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ register: internals.plugins.child, options: { routes: { prefix: '/inner' } } }, { routes: { prefix: '/xyz' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/xyz/inner/test1', (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a child plugin with parent routes vhost prefix and inner register vhost', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ register: internals.plugins.child, options: { routes: { vhost: 'example.net' } } }, { routes: { vhost: 'example.com' } }, (err) => {

                expect(err).to.not.exist();
                server.inject({ url: '/test1', headers: { host: 'example.com' } }, (res) => {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a plugin with routes vhost', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.test1, { routes: { vhost: 'example.com' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/test1', (res1) => {

                    expect(res1.statusCode).to.equal(404);

                    server.inject({ url: '/test1', headers: { host: 'example.com' } }, (res2) => {

                        expect(res2.result).to.equal('testing123');
                        done();
                    });
                });
            });
        });

        it('registers a plugin with routes vhost (plugin options)', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ register: internals.plugins.test1, routes: { vhost: 'example.org' } }, { routes: { vhost: 'example.com' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/test1', (res1) => {

                    expect(res1.statusCode).to.equal(404);

                    server.inject({ url: '/test1', headers: { host: 'example.org' } }, (res2) => {

                        expect(res2.result).to.equal('testing123');
                        done();
                    });
                });
            });
        });

        it('registers plugins with pre-selected label', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });

            const server1 = server.connections[0];
            const server2 = server.connections[1];

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, { select: 'a' }, (err) => {

                expect(err).to.not.exist();
                server1.inject('/', (res1) => {

                    expect(res1.statusCode).to.equal(200);
                    server2.inject('/', (res2) => {

                        expect(res2.statusCode).to.equal(404);
                        done();
                    });
                });
            });
        });

        it('registers plugins with pre-selected labels', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            const server1 = server.connections[0];
            const server2 = server.connections[1];
            const server3 = server.connections[2];

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
                srv.expose('super', 'trooper');
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, { select: ['a', 'c'] }, (err) => {

                expect(err).to.not.exist();
                expect(server.plugins.test.super).to.equal('trooper');

                server1.inject('/', (res1) => {

                    expect(res1.statusCode).to.equal(200);
                    server2.inject('/', (res2) => {

                        expect(res2.statusCode).to.equal(404);
                        server3.inject('/', (res3) => {

                            expect(res3.statusCode).to.equal(200);
                            done();
                        });
                    });
                });
            });
        });

        it('registers plugins with pre-selected labels (plugin options)', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            const server1 = server.connections[0];
            const server2 = server.connections[1];
            const server3 = server.connections[2];

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
                srv.expose('super', 'trooper');
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register({ register: test, select: ['a', 'c'] }, { select: ['b'] }, (err) => {

                expect(err).to.not.exist();
                expect(server.plugins.test.super).to.equal('trooper');

                server1.inject('/', (res1) => {

                    expect(res1.statusCode).to.equal(200);
                    server2.inject('/', (res2) => {

                        expect(res2.statusCode).to.equal(404);
                        server3.inject('/', (res3) => {

                            expect(res3.statusCode).to.equal(200);
                            done();
                        });
                    });
                });
            });
        });

        it('sets multiple dependencies in one statement', (done) => {

            const a = function (srv, options, next) {

                srv.dependency(['b', 'c']);
                return next();
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options, next) {

                return next();
            };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.register(c, (err) => {

                    server.register(a, (err) => {

                        server.initialize((err) => {

                            expect(err).to.not.exist();
                            done();
                        });
                    });
                });
            });
        });

        it('sets multiple dependencies in attributes', (done) => {

            const a = function (srv, options, next) {

                return next();
            };

            a.attributes = {
                name: 'a',
                dependencies: ['b', 'c']
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options, next) {

                return next();
            };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.register(c, (err) => {

                    server.register(a, (err) => {

                        server.initialize((err) => {

                            expect(err).to.not.exist();
                            done();
                        });
                    });
                });
            });
        });

        it('sets multiple dependencies in multiple statements', (done) => {

            const a = function (srv, options, next) {

                srv.dependency('b');
                srv.dependency('c');
                return next();
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options, next) {

                return next();
            };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.register(c, (err) => {

                    server.register(a, (err) => {

                        server.initialize((err) => {

                            expect(err).to.not.exist();
                            done();
                        });
                    });
                });
            });
        });

        it('sets multiple dependencies in multiple locations', (done) => {

            const a = function (srv, options, next) {

                srv.dependency('b');
                return next();
            };

            a.attributes = {
                name: 'a',
                dependencies: 'c'
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const c = function (srv, options, next) {

                return next();
            };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.register(c, (err) => {

                    server.register(a, (err) => {

                        server.initialize((err) => {

                            expect(err).to.not.exist();
                            done();
                        });
                    });
                });
            });
        });

        it('errors when dependency loaded before connection was added', (done) => {

            const a = function (srv, options, next) {

                return next();
            };

            a.attributes = {
                name: 'a',
                dependencies: 'b'
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.exist();
                        expect(err.message).to.equal('Plugin a missing dependency b in connection: ' + server.connections[1].info.uri);
                        done();
                    });
                });
            });
        });

        it('set dependency on previously loaded connectionless plugin', (done) => {

            const a = function (srv, options, next) {

                return next();
            };

            a.attributes = {
                name: 'a',
                dependencies: 'b'
            };

            const b = function (srv, options, next) {

                expect(srv.connections).to.be.null();
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        done();
                    });
                });
            });
        });

        it('allows multiple connectionless plugin', (done) => {

            const a = function (srv, options, next) {

                return next();
            };

            a.attributes = {
                name: 'a',
                dependencies: 'b'
            };

            const b = function (srv, options, next) {

                expect(srv.connections).to.be.null();
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false,
                multiple: true
            };

            const server = new Hapi.Server();
            server.connection();
            server.register([b, b], (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        done();
                    });
                });
            });
        });

        it('register nested connectionless plugins', (done) => {

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const a = function (srv, options, next) {

                srv.register(b, (err) => {

                    return next();
                });
            };

            a.attributes = {
                name: 'a',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(a, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('throws when nested connectionless plugins select', (done) => {

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const a = function (srv, options, next) {

                expect(() => {

                    srv.register(b, { select: 'none' }, (err) => { });
                }).to.throw('Cannot select inside a connectionless plugin');
                return next();
            };

            a.attributes = {
                name: 'a',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(a, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('register a plugin once per connection', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                return next();
            };

            b.attributes = {
                name: 'b'
            };


            const a = function (srv, options, next) {

                srv.register(b, { once: true }, (err) => {

                    expect(err).to.not.exist();
                    return next();
                });
            };

            a.attributes = {
                name: 'a'
            };
            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        expect(count).to.equal(2);
                        done();
                    });
                });
            });
        });

        it('register a plugin once per connection (skip empty selection)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options, next) {

                srv.select('none').register(b, { once: true }, (err) => {

                    expect(err).to.not.exist();
                    return next();
                });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection();
            server.connection();
            server.register(b, (err) => {

                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        expect(count).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('register a connectionless plugin once (empty selection)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.connection();
            server.select('none').register(b, { once: true }, (err) => {

                expect(err).to.not.exist();
                expect(count).to.equal(1);
                done();
            });
        });

        it('register a plugin once per connection (no selection left)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options, next) {

                srv.register(b, { once: true }, (err) => {

                    expect(err).to.not.exist();
                    return next();
                });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection();
            server.connection();
            server.register(b, (err) => {

                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        expect(count).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('register a plugin once (empty selection)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const server = new Hapi.Server();
            server.connection();
            server.connection();
            server.select('none').register(b, { once: true }, (err) => {

                expect(err).to.not.exist();
                expect(count).to.equal(0);
                done();
            });
        });

        it('register a connectionless plugin once', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                expect(srv.connections).to.be.null();
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const a = function (srv, options, next) {

                srv.register(b, { once: true }, (err) => {

                    expect(err).to.not.exist();
                    return next();
                });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        expect(count).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('register a connectionless plugin once (plugin attributes)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                expect(srv.connections).to.be.null();
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false,
                once: true
            };

            const a = function (srv, options, next) {

                srv.register(b, (err) => {

                    expect(err).to.not.exist();
                    return next();
                });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        expect(count).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('register a connectionless plugin once (plugin options)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                expect(srv.connections).to.be.null();
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const a = function (srv, options, next) {

                srv.register({ register: b, once: true }, (err) => {

                    expect(err).to.not.exist();
                    return next();
                });
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(b, (err) => {

                server.connection();
                server.register(a, (err) => {

                    server.initialize((err) => {

                        expect(err).to.not.exist();
                        expect(count).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('register a connectionless plugin once (first time)', (done) => {

            let count = 0;
            const b = function (srv, options, next) {

                ++count;
                expect(srv.connections).to.be.null();
                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.connection();
            server.register(b, { once: true }, (err) => {

                expect(err).to.not.exist();
                expect(count).to.equal(1);
                done();
            });
        });

        it('throws when once used with plugin options', (done) => {

            const a = function (srv, options, next) {

                return next();
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.register({ register: a, options: {}, once: true }, (err) => { });
            }).to.throw();

            done();
        });

        it('throws when dependencies is an object', (done) => {

            const a = function (srv, options, next) {

                next();
            };
            a.attributes = {
                name: 'a',
                dependencies: { b: true }
            };

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.register(a, () => { });
            }).to.throw();
            done();
        });

        it('throws when dependencies contain something else than a string', (done) => {

            const a = function (srv, options, next) {

                next();
            };
            a.attributes = {
                name: 'a',
                dependencies: [true]
            };

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.register(a, () => { });
            }).to.throw();
            done();
        });

        it('exposes server decorations to next register', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const b = function (srv, options, next) {

                return next(typeof srv.a === 'function' ? null : new Error('Missing decoration'));
            };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options, next) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });

                return next();
            };

            a.attributes = {
                name: 'a'
            };

            server.register([a, b], (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });

        it('exposes server decorations to dependency (dependency first)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const a = function (srv, options, next) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });

                return next();
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options, next) {

                const after = function (srv2, next2) {

                    return next2(typeof srv2.a === 'function' ? null : new Error('Missing decoration'));
                };

                srv.dependency('a', after);

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            server.register([a, b], (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });

        it('exposes server decorations to dependency (dependency second)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const a = function (srv, options, next) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });

                return next();
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options, next) {

                srv.realm.x = 1;
                const after = function (srv2, next2) {

                    expect(srv2.realm.x).to.equal(1);
                    return next2(typeof srv2.a === 'function' ? null : new Error('Missing decoration'));
                };

                srv.dependency('a', after);

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            server.register([b, a], (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });

        it('exposes server decorations to next register when nested', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const a = function (srv, options, next) {

                srv.decorate('server', 'a', () => {

                    return 'a';
                });

                return next();
            };

            a.attributes = {
                name: 'a'
            };

            const b = function (srv, options, next) {

                srv.register(a, (err) => {

                    expect(err).to.not.exist();
                    return next(typeof srv.a === 'function' ? null : new Error('Missing decoration'));
                });
            };

            b.attributes = {
                name: 'b'
            };

            server.register([b], (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });
    });

    describe('auth', () => {

        it('adds auth strategy via plugin', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'a' });
            server.connection({ labels: 'b' });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('authenticated!');
                }
            });

            server.register(internals.plugins.auth, (err) => {

                expect(err).to.not.exist();

                server.select('a').inject('/', (res1) => {

                    expect(res1.statusCode).to.equal(401);
                    server.select('a').inject({ method: 'GET', url: '/', headers: { authorization: 'Basic ' + (new Buffer('john:12345', 'utf8')).toString('base64') } }, (res2) => {

                        expect(res2.statusCode).to.equal(200);
                        expect(res2.result).to.equal('authenticated!');
                        done();
                    });
                });
            });
        });
    });

    describe('bind()', () => {

        it('sets plugin context', (done) => {

            const test = function (srv, options, next) {

                const bind = {
                    value: 'in context',
                    suffix: ' throughout'
                };

                srv.bind(bind);

                srv.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply(this.value);
                    }
                });

                const preResponse = function (request, reply) {

                    return reply(request.response.source + this.suffix);
                };

                srv.ext('onPreResponse', preResponse);

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.inject('/', (res) => {

                    expect(res.result).to.equal('in context throughout');
                    done();
                });
            });
        });
    });

    describe('cache()', () => {

        it('provisions a server cache', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            server.initialize((err) => {

                expect(err).to.not.exist();

                cache.set('a', 'going in', 0, (err) => {

                    cache.get('a', (err, value, cached, report) => {

                        expect(value).to.equal('going in');
                        done();
                    });
                });
            });
        });

        it('throws when missing segment', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.cache({ expiresIn: 1000 });
            }).to.throw('Missing cache segment name');
            done();
        });

        it('provisions a server cache with custom partition', (done) => {

            const server = new Hapi.Server({ cache: { engine: CatboxMemory, partition: 'hapi-test-other' } });
            server.connection();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            server.initialize((err) => {

                expect(err).to.not.exist();

                cache.set('a', 'going in', 0, (err) => {

                    cache.get('a', (err, value, cached, report) => {

                        expect(value).to.equal('going in');
                        expect(cache._cache.connection.settings.partition).to.equal('hapi-test-other');
                        done();
                    });
                });
            });
        });

        it('throws when allocating an invalid cache segment', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.cache({ segment: 'a', expiresAt: '12:00', expiresIn: 1000 });
            }).throws();

            done();
        });

        it('allows allocating a cache segment with empty options', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.cache({ segment: 'a' });
            }).to.not.throw();

            done();
        });

        it('allows reusing the same cache segment (server)', (done) => {

            const server = new Hapi.Server({ cache: { engine: CatboxMemory, shared: true } });
            server.connection();
            expect(() => {

                server.cache({ segment: 'a', expiresIn: 1000 });
                server.cache({ segment: 'a', expiresIn: 1000 });
            }).to.not.throw();
            done();
        });

        it('allows reusing the same cache segment (cache)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.cache({ segment: 'a', expiresIn: 1000 });
                server.cache({ segment: 'a', expiresIn: 1000, shared: true });
            }).to.not.throw();
            done();
        });

        it('uses plugin cache interface', (done) => {

            const test = function (srv, options, next) {

                const cache = srv.cache({ expiresIn: 10 });
                srv.expose({
                    get: function (key, callback) {

                        cache.get(key, (err, value, cached, report) => {

                            callback(err, value);
                        });
                    },
                    set: function (key, value, callback) {

                        cache.set(key, value, 0, callback);
                    }
                });

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.not.exist();

                    server.plugins.test.set('a', '1', (err) => {

                        expect(err).to.not.exist();
                        server.plugins.test.get('a', (err, value1) => {

                            expect(err).to.not.exist();
                            expect(value1).to.equal('1');
                            setTimeout(() => {

                                server.plugins.test.get('a', (err, value2) => {

                                    expect(err).to.not.exist();
                                    expect(value2).to.equal(null);
                                    done();
                                });
                            }, 11);
                        });
                    });
                });
            });
        });
    });

    describe('connection()', () => {

        it('returns a selection object within the same realm', (done) => {

            const plugin = function (srv, options, next) {

                srv.bind({ some: 'context' });
                const con = srv.connection();
                con.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        return reply(this.some);
                    }
                });

                return next();
            };

            plugin.attributes = {
                name: 'test',
                connections: false
            };

            const server = new Hapi.Server();
            server.register(plugin, (err) => {

                expect(err).to.not.exist();
                server.connections[0].inject('/', (res) => {

                    expect(res.result).to.equal('context');
                    done();
                });
            });
        });
    });

    describe('decorate()', () => {

        it('decorates request', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const getId = function () {

                return this.id;
            };

            server.decorate('request', 'getId', getId);

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.getId());
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.match(/^.*\:.*\:.*\:.*\:.*$/);
                done();
            });
        });

        it('decorates request (apply)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.decorate('request', 'uri', (request) => request.server.info.uri, { apply: true });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.uri);
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(server.info.uri);
                done();
            });
        });

        it('decorates reply', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const success = function () {

                return this.response({ status: 'ok' });
            };

            server.decorate('reply', 'success', success);

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply.success();
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result.status).to.equal('ok');
                done();
            });
        });

        it('throws on double reply decoration', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.decorate('reply', 'success', () => {

                return this.response({ status: 'ok' });
            });

            expect(() => {

                server.decorate('reply', 'success', () => { });
            }).to.throw('Reply interface decoration already defined: success');
            done();
        });

        it('throws on internal conflict', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.decorate('reply', 'redirect', () => { });
            }).to.throw('Cannot override built-in reply interface decoration: redirect');
            done();
        });

        it('decorates server', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const ok = function (path) {

                server.route({
                    method: 'GET',
                    path: path,
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
            };

            server.decorate('server', 'ok', ok);

            server.ok('/');

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('ok');
                done();
            });
        });

        it('throws on double server decoration', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const ok = function (path) {

                server.route({
                    method: 'GET',
                    path: path,
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });
            };

            server.decorate('server', 'ok', ok);

            expect(() => {

                server.decorate('server', 'ok', () => { });
            }).to.throw('Server decoration already defined: ok');
            done();
        });

        it('throws on server decoration root conflict', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.decorate('server', 'start', () => { });
            }).to.throw('Cannot override the built-in server interface method: start');
            done();
        });

        it('throws on server decoration plugin conflict', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.decorate('server', 'select', () => { });
            }).to.throw('Cannot override the built-in server interface method: select');
            done();
        });

        it('throws on invalid decoration name', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.decorate('server', '_special', () => { });
            }).to.throw('Property name cannot begin with an underscore: _special');
            done();
        });
    });

    describe('dependency()', () => {

        it('fails to register single plugin with dependencies', (done) => {

            const test = function (srv, options, next) {

                srv.dependency('none');
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin test missing dependency none in connection: ' + server.info.uri);
                    done();
                });
            });
        });

        it('fails to register single plugin with dependencies (attributes)', (done) => {

            const test = function (srv, options, next) {

                return next();
            };

            test.attributes = {
                name: 'test',
                dependencies: 'none'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin test missing dependency none in connection: ' + server.info.uri);
                    done();
                });
            });
        });

        it('fails to register single plugin with dependencies (connectionless)', (done) => {

            const test = function (srv, options, next) {

                srv.dependency('none');
                return next();
            };

            test.attributes = {
                name: 'test',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin test missing dependency none');
                    done();
                });
            });
        });

        it('fails to register plugin with multiple dependencies (connectionless)', (done) => {

            const test = function (srv, options, next) {

                srv.dependency(['b', 'none']);
                return next();
            };

            test.attributes = {
                name: 'test',
                connections: false
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.register([test, b], (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin test missing dependency none');
                    done();
                });
            });
        });

        it('register plugin with multiple dependencies (connectionless)', (done) => {

            const test = function (srv, options, next) {

                srv.dependency(['b']);
                return next();
            };

            test.attributes = {
                name: 'test',
                connections: false
            };

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b',
                connections: false
            };

            const server = new Hapi.Server();
            server.connection();
            server.register([test, b], (err) => {

                server.initialize((err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });

        it('fails to register multiple plugins with dependencies', (done) => {

            const server = new Hapi.Server();
            server.connection({ port: 80, host: 'localhost' });
            server.register([internals.plugins.deps1, internals.plugins.deps3], (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin deps1 missing dependency deps2 in connection: ' + server.info.uri);
                    done();
                });
            });
        });

        it('recognizes dependencies from peer plugins', (done) => {

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b'
            };

            const a = function (srv, options, next) {

                srv.register(b, next);
            };

            a.attributes = {
                name: 'a'
            };

            const c = function (srv, options, next) {

                srv.dependency('b');
                return next();
            };

            c.attributes = {
                name: 'c'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register([a, c], (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('errors when missing inner dependencies', (done) => {

            const b = function (srv, options, next) {

                srv.dependency('c');
                return next();
            };

            const a = function (srv, options, next) {

                srv.register(b, next);
            };

            a.attributes = {
                name: 'a'
            };

            b.attributes = {
                name: 'b'
            };

            const server = new Hapi.Server();
            server.connection({ port: 80, host: 'localhost' });
            server.register(a, (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin b missing dependency c in connection: ' + server.info.uri);
                    done();
                });
            });
        });

        it('errors when missing inner dependencies (attributes)', (done) => {

            const b = function (srv, options, next) {

                return next();
            };

            b.attributes = {
                name: 'b',
                dependencies: 'c'
            };

            const a = function (srv, options, next) {

                srv.register(b, next);
            };

            a.attributes = {
                name: 'a'
            };

            const server = new Hapi.Server();
            server.connection({ port: 80, host: 'localhost' });
            server.register(a, (err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Plugin b missing dependency c in connection: ' + server.info.uri);
                    done();
                });
            });
        });
    });

    describe('events', () => {

        it('plugin event handlers receive more than 2 arguments when they exist', (done) => {

            const test = function (srv, options, next) {

                srv.once('request-internal', () => {

                    expect(arguments).to.have.length(3);
                    done();
                });

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.inject({ url: '/' }, () => { });
            });
        });

        it('listens to events on selected connections', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            const server1 = server.connections[0];
            const server2 = server.connections[1];
            const server3 = server.connections[2];

            let counter = 0;
            const test = function (srv, options, next) {

                srv.select(['a', 'b']).on('test', () => {

                    ++counter;
                });

                srv.select(['a']).on('start', () => {

                    ++counter;
                });

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, (err) => {

                expect(err).to.not.exist();
                server1.emit('test');
                server2.emit('test');
                server3.emit('test');

                server.start((err) => {

                    expect(err).to.not.exist();

                    server.stop((err) => {

                        expect(err).to.not.exist();
                        expect(counter).to.equal(3);
                        done();
                    });
                });
            });
        });
    });

    describe('expose()', () => {

        it('exposes an api', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'test'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
            server.connection({ labels: ['s4', 'b', 'test', 'cache'] });

            server.register(internals.plugins.test1, (err) => {

                expect(err).to.not.exist();

                expect(server.connections[0]._router.routes.get).to.not.exist();
                expect(internals.routesList(server, 's2')).to.deep.equal(['/test1']);
                expect(server.connections[2]._router.routes.get).to.not.exist();
                expect(internals.routesList(server, 's4')).to.deep.equal(['/test1']);

                expect(server.plugins.test1.add(1, 3)).to.equal(4);
                expect(server.plugins.test1.glue('1', '3')).to.equal('13');

                done();
            });
        });
    });

    describe('ext()', () => {

        it('extends onRequest point', (done) => {

            const test = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/b',
                    handler: function (request, reply) {

                        return reply('b');
                    }
                });

                const onRequest = function (request, reply) {

                    request.setUrl('/b');
                    return reply.continue();
                };

                srv.ext('onRequest', onRequest);

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                expect(internals.routesList(server)).to.deep.equal(['/b']);

                server.inject('/a', (res) => {

                    expect(res.result).to.equal('b');
                    done();
                });
            });
        });

        it('adds multiple ext functions with simple dependencies', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['a', 'b', '0'] });
            server.connection({ labels: ['a', 'c', '1'] });
            server.connection({ labels: ['c', 'b', '2'] });

            const handler = function (request, reply) {

                return reply(request.app.deps);
            };

            server.select('0').route({ method: 'GET', path: '/', handler: handler });
            server.select('1').route({ method: 'GET', path: '/', handler: handler });
            server.select('2').route({ method: 'GET', path: '/', handler: handler });

            server.register([internals.plugins.deps1, internals.plugins.deps2, internals.plugins.deps3], (err) => {

                expect(err).to.not.exist();

                server.initialize((err) => {

                    expect(err).to.not.exist();
                    expect(server.plugins.deps1.breaking).to.equal('bad');

                    server.connections[0].inject('/', (res1) => {

                        expect(res1.result).to.equal('|2|1|');

                        server.connections[1].inject('/', (res2) => {

                            expect(res2.result).to.equal('|3|1|');

                            server.connections[2].inject('/', (res3) => {

                                expect(res3.result).to.equal('|3|2|');
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('adds multiple ext functions with complex dependencies', (done) => {

            // Generate a plugin with a specific index and ext dependencies.

            const pluginCurrier = function (num, deps) {

                const plugin = function (server, options, next) {

                    const onRequest = function (request, reply) {

                        request.app.complexDeps = request.app.complexDeps || '|';
                        request.app.complexDeps += num + '|';
                        return reply.continue();
                    };

                    server.ext('onRequest', onRequest, deps);

                    next();
                };

                plugin.attributes = {
                    name: 'deps' + num
                };

                return plugin;
            };

            const handler = function (request, reply) {

                return reply(request.app.complexDeps);
            };

            const server = new Hapi.Server();
            server.connection();

            server.route({ method: 'GET', path: '/', handler: handler });

            server.register([
                pluginCurrier(1, { after: 'deps2' }),
                pluginCurrier(2),
                pluginCurrier(3, { before: ['deps1', 'deps2'] })
            ], (err) => {

                expect(err).to.not.exist();

                server.initialize((err) => {

                    expect(err).to.not.exist();

                    server.inject('/', (res) => {

                        expect(res.result).to.equal('|3|2|1|');
                        done();
                    });
                });
            });
        });

        it('throws when adding ext without connections', (done) => {

            const server = new Hapi.Server();
            expect(() => {

                server.ext('onRequest', () => { });
            }).to.throw('Cannot add ext without a connection');

            done();
        });

        it('binds server ext to context (options)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const bind = {
                state: false
            };

            const preStart = function (srv, next) {

                this.state = true;
                return next();
            };

            server.ext('onPreStart', preStart, { bind: bind });

            server.initialize((err) => {

                expect(err).to.not.exist();
                expect(bind.state).to.be.true();
                done();
            });
        });

        it('binds server ext to context (realm)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const bind = {
                state: false
            };

            server.bind(bind);
            const preStart = function (srv, next) {

                this.state = true;
                return next();
            };

            server.ext('onPreStart', preStart);

            server.initialize((err) => {

                expect(err).to.not.exist();
                expect(bind.state).to.be.true();
                done();
            });
        });

        it('extends server actions', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let result = '';
            const preStart = function (srv, next) {

                result += '1';
                return next();
            };

            server.ext('onPreStart', preStart);

            const postStart = function (srv, next) {

                result += '2';
                return next();
            };

            server.ext('onPostStart', postStart);

            const preStop = function (srv, next) {

                result += '3';
                return next();
            };

            server.ext('onPreStop', preStop);

            const postStop = function (srv, next) {

                result += '4';
                return next();
            };

            server.ext('onPostStop', postStop);

            server.start((err) => {

                expect(err).to.not.exist();
                expect(result).to.equal('12');

                server.stop((err) => {

                    expect(err).to.not.exist();
                    expect(result).to.equal('1234');
                    done();
                });
            });
        });

        it('extends server actions (single call)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let result = '';
            server.ext([
                {
                    type: 'onPreStart',
                    method: function (srv, next) {

                        result += '1';
                        return next();
                    }
                },
                {
                    type: 'onPostStart',
                    method: function (srv, next) {

                        result += '2';
                        return next();
                    }
                },
                {
                    type: 'onPreStop',
                    method: function (srv, next) {

                        result += '3';
                        return next();
                    }
                },
                {
                    type: 'onPreStop',
                    method: function (srv, next) {

                        result += '4';
                        return next();
                    }
                }
            ]);

            server.start((err) => {

                expect(err).to.not.exist();
                expect(result).to.equal('12');

                server.stop((err) => {

                    expect(err).to.not.exist();
                    expect(result).to.equal('1234');
                    done();
                });
            });
        });

        it('combine route extensions', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const preAuth = function (request, reply) {

                request.app.x = '1';
                return reply.continue();
            };

            server.ext('onPreAuth', preAuth);

            const plugin = function (srv, options, next) {

                srv.route({
                    method: 'GET',
                    path: '/',
                    config: {
                        ext: {
                            onPreAuth: {
                                method: function (request, reply) {

                                    request.app.x += '2';
                                    return reply.continue();
                                }
                            }
                        },
                        handler: function (request, reply) {

                            return reply(request.app.x);
                        }
                    }
                });

                const preAuthSandbox = function (request, reply) {

                    request.app.x += '3';
                    return reply.continue();
                };

                srv.ext('onPreAuth', preAuthSandbox, { sandbox: 'plugin' });

                return next();
            };

            plugin.attributes = {
                name: 'test'
            };

            server.register(plugin, (err) => {

                expect(err).to.not.exist();

                server.route({
                    method: 'GET',
                    path: '/a',
                    config: {
                        handler: function (request, reply) {

                            return reply(request.app.x);
                        }
                    }
                });

                server.inject('/', (res1) => {

                    expect(res1.result).to.equal('123');

                    server.inject('/a', (res2) => {

                        expect(res2.result).to.equal('1');
                        done();
                    });
                });
            });
        });

        it('calls method after plugin', (done) => {

            const x = function (srv, options, next) {

                srv.expose('a', 'b');
                return next();
            };

            x.attributes = {
                name: 'x'
            };

            const server = new Hapi.Server();
            server.connection();

            expect(server.plugins.x).to.not.exist();

            let called = false;
            const preStart = function (srv, next) {

                expect(srv.plugins.x.a).to.equal('b');
                called = true;
                return next();
            };

            server.ext('onPreStart', preStart, { after: 'x' });

            server.register(x, (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.not.exist();
                    expect(called).to.be.true();
                    done();
                });
            });
        });

        it('calls method before start', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let called = false;
            const preStart = function (srv, next) {

                called = true;
                return next();
            };

            server.ext('onPreStart', preStart);

            server.initialize((err) => {

                expect(err).to.not.exist();
                expect(called).to.be.true();
                done();
            });
        });

        it('calls method before start even if plugin not registered', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let called = false;
            const preStart = function (srv, next) {

                called = true;
                return next();
            };

            server.ext('onPreStart', preStart, { after: 'x' });

            server.initialize((err) => {

                expect(err).to.not.exist();
                expect(called).to.be.true();
                done();
            });
        });

        it('fails to start server when after method fails', (done) => {

            const test = function (srv, options, next) {

                const preStart1 = function (inner, finish) {

                    return finish();
                };

                srv.ext('onPreStart', preStart1);

                const preStart2 = function (inner, finish) {

                    return finish(new Error('Not in the mood'));
                };

                srv.ext('onPreStart', preStart2);

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.exist();
                    done();
                });
            });
        });

        it('errors when added after initialization', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.initialize((err) => {

                expect(() => {

                    server.ext('onPreStart', () => { });
                }).to.throw('Cannot add onPreStart (after) extension after the server was initialized');

                done();
            });
        });
    });

    describe('handler()', () => {

        it('add new handler', (done) => {

            const test = function (srv, options1, next) {

                const handler = function (route, options2) {

                    return function (request, reply) {

                        return reply('success');
                    };
                };

                srv.handler('bar', handler);

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.route({
                    method: 'GET',
                    path: '/',
                    handler: {
                        bar: {}
                    }
                });

                server.inject('/', (res) => {

                    expect(res.payload).to.equal('success');
                    done();
                });
            });
        });

        it('errors on duplicate handler', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();

            expect(() => {

                server.handler('file', () => { });
            }).to.throw('Handler name already exists: file');
            done();
        });

        it('errors on unknown handler', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.route({ method: 'GET', path: '/', handler: { test: {} } });
            }).to.throw('Unknown handler: test');
            done();
        });

        it('errors on non-string name', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.handler();
            }).to.throw('Invalid handler name');
            done();
        });

        it('errors on non-function handler', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.handler('foo', 'bar');
            }).to.throw('Handler must be a function: foo');
            done();
        });
    });

    describe('log()', { parallel: false }, () => {

        it('emits a log event', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let count = 0;
            server.once('log', (event) => {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.once('log', (event) => {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.log('1', 'log event 1', Date.now());

            server.once('log', (event) => {

                ++count;
                expect(event.data).to.equal('log event 2');
            });

            server.log(['2'], 'log event 2', new Date(Date.now()));

            expect(count).to.equal(3);
            done();
        });

        it('emits a log event and print to console', { parallel: false }, (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.once('log', (event) => {

                expect(event.data).to.equal('log event 1');
            });

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('internal, implementation, error');

                done();
            };

            server.log(['internal', 'implementation', 'error'], 'log event 1');
        });

        it('outputs log data to debug console', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    {"data":1}');
                done();
            };

            server.log(['implementation'], { data: 1 });
        });

        it('outputs log error data to debug console', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.contain('\n    Error: test\n    at');
                done();
            };

            server.log(['implementation'], new Error('test'));
        });

        it('outputs log data to debug console without data', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('');
                done();
            };

            server.log(['implementation']);
        });

        it('does not output events when debug disabled', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('does not output events when debug.log disabled', (done) => {

            const server = new Hapi.Server({ debug: { log: false } });
            server.connection();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('does not output non-implementation events by default', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['xyz']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('emits server log events once', (done) => {

            let pc = 0;
            const test = function (srv, options, next) {

                srv.on('log', (event, tags) => {

                    ++pc;
                });

                next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();

            let sc = 0;
            server.on('log', (event, tags) => {

                ++sc;
            });

            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.log('test');
                expect(sc).to.equal(1);
                expect(pc).to.equal(1);
                done();
            });
        });
    });

    describe('lookup()', () => {

        it('returns route based on id', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
                    id: 'root',
                    app: { test: 123 }
                }
            });

            const root = server.lookup('root');
            expect(root.path).to.equal('/');
            expect(root.settings.app.test).to.equal(123);
            done();
        });

        it('returns null on unknown route', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const root = server.lookup('root');
            expect(root).to.be.null();
            done();
        });

        it('throws on missing id', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.lookup();
            }).to.throw('Invalid route id: ');
            done();
        });
    });

    describe('match()', () => {

        it('returns route based on path', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
                    id: 'root'
                }
            });

            server.route({
                method: 'GET',
                path: '/abc',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
                    id: 'abc'
                }
            });

            server.route({
                method: 'POST',
                path: '/abc',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
                    id: 'post'
                }
            });

            server.route({
                method: 'GET',
                path: '/{p}/{x}',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
                    id: 'params'
                }
            });

            server.route({
                method: 'GET',
                path: '/abc',
                vhost: 'example.com',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
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
            done();
        });

        it('throws on missing method', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.match();
            }).to.throw('Invalid method: ');
            done();
        });

        it('throws on invalid method', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.match(5);
            }).to.throw('Invalid method: 5');
            done();
        });

        it('throws on missing path', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.match('get');
            }).to.throw('Invalid path: ');
            done();
        });

        it('throws on invalid path type', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.match('get', 5);
            }).to.throw('Invalid path: 5');
            done();
        });

        it('throws on invalid path prefix', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.match('get', '5');
            }).to.throw('Invalid path: 5');
            done();
        });

        it('throws on invalid path', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/{p}',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    }
                }
            });

            expect(() => {

                server.match('GET', '/%p');
            }).to.throw('Invalid path: /%p');
            done();
        });

        it('throws on invalid host type', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.match('get', '/a', 5);
            }).to.throw('Invalid host: 5');
            done();
        });
    });

    describe('method()', () => {

        it('adds server method using arguments', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const test = function (srv, options, next) {

                const method = function (methodNext) {

                    return methodNext(null);
                };

                srv.method('log', method);
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, (err) => {

                expect(err).to.not.exist();
                done();
            });
        });

        it('adds server method with plugin bind', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const test = function (srv, options, next) {

                srv.bind({ x: 1 });
                const method = function (methodNext) {

                    return methodNext(null, this.x);
                };

                srv.method('log', method);
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.methods.log((err, result) => {

                    expect(result).to.equal(1);
                    done();
                });
            });
        });

        it('adds server method with method bind', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const test = function (srv, options, next) {

                const method = function (methodNext) {

                    return methodNext(null, this.x);
                };

                srv.method('log', method, { bind: { x: 2 } });
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.methods.log((err, result) => {

                    expect(result).to.equal(2);
                    done();
                });
            });
        });

        it('adds server method with method and ext bind', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const test = function (srv, options, next) {

                srv.bind({ x: 1 });
                const method = function (methodNext) {

                    return methodNext(null, this.x);
                };

                srv.method('log', method, { bind: { x: 2 } });
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.methods.log((err, result) => {

                    expect(result).to.equal(2);
                    done();
                });
            });
        });
    });

    describe('path()', () => {

        it('sets local path for directory route handler', (done) => {

            const test = function (srv, options, next) {

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

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } } });
            server.register(test, (err) => {

                expect(err).to.not.exist();
                server.inject('/handler/package.json', (res) => {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('throws when plugin sets undefined path', (done) => {

            const test = function (srv, options, next) {

                srv.path();
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.register(test, (err) => { });
            }).to.throw('relativeTo must be a non-empty string');
            done();
        });
    });

    describe('render()', () => {

        it('renders view', (done) => {

            const server = new Hapi.Server();
            server.register(Vision, Hoek.ignore);
            server.connection();
            server.views({
                engines: { html: Handlebars },
                path: __dirname + '/templates'
            });

            server.render('test', { title: 'test', message: 'Hapi' }, (err, rendered, config) => {

                expect(rendered).to.exist();
                expect(rendered).to.contain('Hapi');
                done();
            });
        });
    });

    describe('state()', () => {

        it('throws when adding state without connections', (done) => {

            const server = new Hapi.Server();
            expect(() => {

                server.state('sid', { encoding: 'base64' });
            }).to.throw('Cannot add state without a connection');

            done();
        });
    });

    describe('views()', () => {

        it('requires plugin with views', (done) => {

            const test = function (srv, options, next) {

                srv.path(__dirname);

                const views = {
                    engines: { 'html': Handlebars },
                    path: './templates/plugin'
                };

                srv.views(views);
                if (Object.keys(views).length !== 2) {
                    return next(new Error('plugin.view() modified options'));
                }

                srv.route([
                    {
                        path: '/view',
                        method: 'GET',
                        handler: function (request, reply) {

                            return reply.view('test', { message: options.message });
                        }
                    },
                    {
                        path: '/file',
                        method: 'GET',
                        handler: { file: './templates/plugin/test.html' }
                    }
                ]);

                const onRequest = function (request, reply) {

                    if (request.path === '/ext') {
                        return reply.view('test', { message: 'grabbed' });
                    }

                    return reply.continue();
                };

                srv.ext('onRequest', onRequest);

                return next();
            };

            test.attributes = {
                name: 'test'
            };

            const server = new Hapi.Server();
            server.register([Inert, Vision], Hoek.ignore);
            server.connection();
            server.register({ register: test, options: { message: 'viewing it' } }, (err) => {

                expect(err).to.not.exist();
                server.inject('/view', (res1) => {

                    expect(res1.result).to.equal('<h1>viewing it</h1>');

                    server.inject('/file', (res2) => {

                        expect(res2.result).to.equal('<h1>{{message}}</h1>');

                        server.inject('/ext', (res3) => {

                            expect(res3.result).to.equal('<h1>grabbed</h1>');
                            done();
                        });
                    });
                });
            });
        });
    });
});


internals.routesList = function (server, label) {

    const tables = server.select(label || []).table();

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
    auth: function (server, options, next) {

        const scheme = function (srv, authOptions) {

            const settings = Hoek.clone(authOptions);

            return {
                authenticate: function (request, reply) {

                    const req = request.raw.req;
                    const authorization = req.headers.authorization;
                    if (!authorization) {
                        return reply(Boom.unauthorized(null, 'Basic'));
                    }

                    const parts = authorization.split(/\s+/);

                    if (parts[0] &&
                        parts[0].toLowerCase() !== 'basic') {

                        return reply(Boom.unauthorized(null, 'Basic'));
                    }

                    if (parts.length !== 2) {
                        return reply(Boom.badRequest('Bad HTTP authentication header format', 'Basic'));
                    }

                    const credentialsParts = new Buffer(parts[1], 'base64').toString().split(':');
                    if (credentialsParts.length !== 2) {
                        return reply(Boom.badRequest('Bad header internal syntax', 'Basic'));
                    }

                    const username = credentialsParts[0];
                    const password = credentialsParts[1];

                    settings.validateFunc(username, password, (err, isValid, credentials) => {

                        if (!isValid) {
                            return reply(Boom.unauthorized('Bad username or password', 'Basic'), { credentials: credentials });
                        }

                        return reply.continue({ credentials: credentials });
                    });
                }
            };
        };

        server.auth.scheme('basic', scheme);

        const loadUser = function (username, password, callback) {

            if (username === 'john') {
                return callback(null, password === '12345', { user: 'john' });
            }

            return callback(null, false);
        };

        server.auth.strategy('basic', 'basic', 'required', { validateFunc: loadUser });

        server.auth.scheme('special', () => {

            return { authenticate: function () { } };
        });

        server.auth.strategy('special', 'special', {});

        return next();
    },
    child: function (server, options, next) {

        if (options.routes) {
            return server.register(internals.plugins.test1, options, next);
        }

        return server.register(internals.plugins.test1, next);
    },
    deps1: function (server, options, next) {

        const after = function (srv, nxt) {

            srv.expose('breaking', srv.plugins.deps2.breaking);
            return nxt();
        };

        server.dependency('deps2', after);

        const selection = server.select('a');
        if (selection.connections.length) {
            const onRequest = function (request, reply) {

                request.app.deps = request.app.deps || '|';
                request.app.deps += '1|';
                return reply.continue();
            };

            selection.ext('onRequest', onRequest, { after: 'deps3' });
        }

        return next();
    },
    deps2: function (server, options, next) {

        const selection = server.select('b');
        if (selection.connections.length) {
            const onRequest = function (request, reply) {

                request.app.deps = request.app.deps || '|';
                request.app.deps += '2|';
                return reply.continue();
            };

            selection.ext('onRequest', onRequest, { after: 'deps3', before: 'deps1' });
        }

        server.expose('breaking', 'bad');

        return next();
    },
    deps3: function (server, options, next) {

        const selection = server.select('c');
        if (selection.connections.length) {
            const onRequest = function (request, reply) {

                request.app.deps = request.app.deps || '|';
                request.app.deps += '3|';
                return reply.continue();
            };

            selection.ext('onRequest', onRequest);
        }

        return next();
    },
    test1: function (server, options, next) {

        const handler = function (request, reply) {

            return reply('testing123' + ((server.settings.app && server.settings.app.my) || ''));
        };

        server.select('test').route({ path: '/test1', method: 'GET', handler: handler });

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

        return next();
    },
    test2: function (server, options, next) {

        server.route({
            path: '/test2',
            method: 'GET',
            handler: function (request, reply) {

                return reply('testing123');
            }
        });
        server.log('test', 'abc');
        return next();
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
