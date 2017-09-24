'use strict';

// Load modules

const Path = require('path');

const Boom = require('boom');
const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');
const Vision = require('vision');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('authentication', () => {

    it('requires and authenticates a request', async () => {

        const server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
        server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

        const res1 = await server.inject('/');
        expect(res1.statusCode).to.equal(401);

        const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.equal('steve');
    });

    it('disables authentication on a route', async () => {

        const server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'POST', path: '/', config: { auth: false, handler: (request) => request.auth.isAuthenticated } });

        const res1 = await server.inject({ url: '/', method: 'POST' });
        expect(res1.statusCode).to.equal(200);
        expect(res1.result).to.be.false();

        const res2 = await server.inject({ url: '/', method: 'POST', headers: { authorization: 'Custom steve' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.be.false();
    });

    it('defaults cache to private if request authenticated', async () => {

        const handler = function (request, reply) {

            return reply('ok').ttl(1000);
        };

        const server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
        expect(res.statusCode).to.equal(200);
        expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
    });

    it('authenticates a request against another route', async () => {

        const server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });

        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) {

                    const credentials = request.auth.credentials;

                    const access = {
                        two: request.server.lookup('two').auth.access(request),
                        three1: request.server.lookup('three').auth.access(request),
                        four1: request.server.lookup('four').auth.access(request)
                    };

                    request.auth.credentials = null;
                    access.three2 = request.server.lookup('three').auth.access(request);
                    access.four2 = request.server.lookup('four').auth.access(request);
                    request.auth.credentials = credentials;

                    return reply(access);
                },
                auth: {
                    scope: 'one'
                }
            }
        });

        server.route({ method: 'GET', path: '/two', config: { id: 'two', handler: Hoek.ignore, auth: { scope: 'two' } } });
        server.route({ method: 'GET', path: '/three', config: { id: 'three', handler: Hoek.ignore, auth: { scope: 'one' } } });
        server.route({ method: 'GET', path: '/four', config: { id: 'four', handler: Hoek.ignore, auth: false } });

        const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal({
            two: false,
            three1: true,
            three2: false,
            four1: true,
            four2: true
        });
    });

    describe('strategy()', () => {

        it.skip('errors when strategy authenticate function throws', async () => {

            const server = new Hapi.Server({ debug: false });
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true);
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(500);
        });

        it('throws when strategy missing scheme', async () => {

            const server = new Hapi.Server();
            expect(() => {

                server.auth.strategy('none');
            }).to.throw('Authentication strategy none missing scheme');
        });

        it('adds a route to server', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} }, route: true });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
        });

        it('uses views', async () => {

            const implementation = function (server, options) {

                server.views({
                    engines: { 'html': Handlebars },
                    relativeTo: Path.join(__dirname, '/templates/plugin')
                });

                const handler = function (request, reply) {

                    return reply.view('test', { message: 'steve' });
                };

                server.route({ method: 'GET', path: '/view', handler, config: { auth: false } });

                return {
                    authenticate: function (request, reply) {

                        return reply.view('test', { message: 'xyz' });
                    }
                };
            };

            const server = new Hapi.Server();
            await server.register(Vision);

            server.views({
                engines: { 'html': Handlebars },
                relativeTo: Path.join(__dirname, '/no/such/directory')
            });

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', true);

            server.route({ method: 'GET', path: '/', handler: () => null });

            const res1 = await server.inject('/view');
            expect(res1.result).to.equal('<h1>steve</h1>');

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.equal('<h1>xyz</h1>');
        });

        it('exposes an api', async () => {

            const implementation = function (server, options) {

                return {
                    api: {
                        x: 5
                    },
                    authenticate: function (request, reply) {

                        return reply.continue(null, {});
                    }
                };
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', implementation);
            server.auth.strategy('xyz', 'custom', true);

            expect(server.auth.api.xyz.x).to.equal(5);
        });
    });

    describe('default()', () => {

        it('sets default', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });

            server.auth.default('default');
            expect(server.auth.settings.default).to.equal({ strategies: ['default'], mode: 'required' });

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            server.route({ method: 'GET', path: '/', handler });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
        });

        it('sets default with object', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default({ strategy: 'default' });
            server.route({ method: 'GET', path: '/', handler });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
        });

        it('throws when setting default twice', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            expect(() => {

                server.auth.default('default');
                server.auth.default('default');
            }).to.throw('Cannot set default strategy more than once');
        });

        it('throws when setting default without strategy', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            expect(() => {

                server.auth.default({ mode: 'required' });
            }).to.throw('Missing authentication strategy: default strategy');
        });

        it('matches dynamic scope', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one-test-admin' } } });
            server.auth.default({ strategy: 'default', scope: 'one-{params.id}-{params.role}' });
            server.route({
                method: 'GET',
                path: '/{id}/{role}',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    }
                }
            });

            const res = await server.inject({ url: '/test/admin', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });
    });

    describe('_setupRoute()', () => {

        it('throws when route refers to nonexistent strategy', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('a', 'custom', { users: { steve: {} } });
            server.auth.strategy('b', 'custom', { users: { steve: {} } });

            expect(() => {

                server.route({
                    path: '/',
                    method: 'GET',
                    config: {
                        auth: {
                            strategy: 'c'
                        },
                        handler: function (request, reply) {

                            return reply('ok');
                        }
                    }
                });
            }).to.throw('Unknown authentication strategy c in /');
        });
    });

    describe('lookup', () => {

        it('returns the route auth config', async () => {

            const handler = function (request, reply) {

                return reply(request.server.auth.lookup(request.route));
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({
                strategies: ['default'],
                mode: 'required'
            });
        });
    });

    describe('authenticate()', () => {

        it('setups route with optional authentication', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });

            const handler = function (request, reply) {

                return reply(!!request.auth.credentials);
            };
            server.route({ method: 'GET', path: '/', config: { handler, auth: { mode: 'optional' } } });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('false');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.payload).to.equal('true');
        });

        it('exposes mode', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.auth.mode);
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('required');
        });

        it('authenticates using multiple strategies', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('first', 'custom', { users: { steve: 'skip' } });
            server.auth.strategy('second', 'custom', { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.strategy);
                    },
                    auth: {
                        strategies: ['first', 'second']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('second');
        });

        it('authenticates using credentials object', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });

            const doubleHandler = async function (request, reply) {

                const options = { url: '/2', credentials: request.auth.credentials };
                const res = await server.inject(options);
                return reply(res.result);
            };

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            server.route({ method: 'GET', path: '/1', handler: doubleHandler });
            server.route({ method: 'GET', path: '/2', handler });

            const res = await server.inject({ url: '/1', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('steve');
        });

        it('authenticates using credentials object (with artifacts)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });

            const doubleHandler = async function (request, reply) {

                const options = { url: '/2', credentials: request.auth.credentials, artifacts: '!' };
                const res = await server.inject(options);
                return reply(res.result);
            };

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user + request.auth.artifacts);
            };

            server.route({ method: 'GET', path: '/1', handler: doubleHandler });
            server.route({ method: 'GET', path: '/2', handler });

            const res = await server.inject({ url: '/1', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('steve!');
        });

        it('authenticates a request with custom auth settings', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        strategy: 'default'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('authenticates a request with auth strategy name config', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: 'default'
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('tries to authenticate a request', async () => {

            const handler = function (request, reply) {

                return reply({ status: request.auth.isAuthenticated, error: request.auth.error });
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', 'try', { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result.status).to.equal(false);
            expect(res1.result.error.message).to.equal('Missing authentication');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.result.status).to.equal(false);
            expect(res2.result.error.message).to.equal('Missing credentials');

            const res3 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res3.statusCode).to.equal(200);
            expect(res3.result.status).to.equal(true);
            expect(res3.result.error).to.not.exist();
        });

        it('errors on invalid authenticate callback missing both error and credentials', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server({ debug: false });
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom' } });
            expect(res.statusCode).to.equal(500);
        });

        it('logs error', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler });

            let logged = false;
            server.events.on('request-internal', (request, event, tags) => {

                if (tags.auth) {
                    logged = true;
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res.statusCode).to.equal(401);
            expect(logged).to.be.true();
        });

        it('returns a non Error error response', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { message: 'in a bottle' } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom message' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('in a bottle');
        });

        it('passes non Error error response when set to try ', async () => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', 'try', { users: { message: 'in a bottle' } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom message' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('in a bottle');
        });

        it('matches scope (array to single)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches scope (array to array)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one', 'two'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: ['one', 'three']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches scope (single to array)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: ['one', 'three']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches scope (single to single)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches dynamic scope (single to single)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one-test' } } });
            server.route({
                method: 'GET',
                path: '/{id}',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        scope: 'one-{params.id}'
                    }
                }
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches multiple required dynamic scopes', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['test', 'one-test'] } } });
            server.route({
                method: 'GET',
                path: '/{id}',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        scope: ['+one-{params.id}', '+{params.id}']
                    }
                }
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches multiple required dynamic scopes (mixed types)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['test', 'one-test'] } } });
            server.route({
                method: 'GET',
                path: '/{id}',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        scope: ['+one-{params.id}', '{params.id}']
                    }
                }
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches dynamic scope with multiple parts (single to single)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one-test-admin' } } });
            server.route({
                method: 'GET',
                path: '/{id}/{role}',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        scope: 'one-{params.id}-{params.role}'
                    }
                }
            });

            const res = await server.inject({ url: '/test/admin', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('does not match broken dynamic scope (single to single)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one-test' } } });
            server.route({
                method: 'GET',
                path: '/{id}',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        scope: 'one-params.id}'
                    }
                }
            });

            server.ext('onPreResponse', (request, reply) => {

                expect(request.response.data).to.contain(['got', 'need']);
                return reply.continue;
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('does not match scope (single to single)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: 'onex'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('errors on missing scope', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: 'b'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('errors on missing scope property', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: 'b'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('validates required scope', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, {
                users: {
                    steve: { scope: ['a', 'b'] },
                    john: { scope: ['a', 'b', 'c'] }
                }
            });

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: ['+c', 'b']
                    }
                }
            });

            const res1 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res1.statusCode).to.equal(403);
            expect(res1.result.message).to.equal('Insufficient scope');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(200);
        });

        it('validates forbidden scope', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, {
                users: {
                    steve: { scope: ['a', 'b'] },
                    john: { scope: ['b', 'c'] }
                }
            });

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: ['!a', 'b']
                    }
                }
            });

            const res1 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res1.statusCode).to.equal(403);
            expect(res1.result.message).to.equal('Insufficient scope');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(200);
        });

        it('validates complex scope', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, {
                users: {
                    steve: { scope: ['a', 'b', 'c'] },
                    john: { scope: ['b', 'c'] },
                    mary: { scope: ['b', 'd'] },
                    lucy: { scope: 'b' },
                    larry: { scope: ['c', 'd'] }
                }
            });

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: ['!a', '+b', 'c', 'd']
                    }
                }
            });

            const res1 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res1.statusCode).to.equal(403);
            expect(res1.result.message).to.equal('Insufficient scope');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(200);

            const res3 = await server.inject({ url: '/', headers: { authorization: 'Custom mary' } });
            expect(res3.statusCode).to.equal(200);

            const res4 = await server.inject({ url: '/', headers: { authorization: 'Custom lucy' } });
            expect(res4.statusCode).to.equal(403);
            expect(res4.result.message).to.equal('Insufficient scope');

            const res5 = await server.inject({ url: '/', headers: { authorization: 'Custom larry' } });
            expect(res5.statusCode).to.equal(403);
            expect(res5.result.message).to.equal('Insufficient scope');
        });

        it('errors on missing scope using arrays', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a', 'b'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        scope: ['c', 'd']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('ignores default scope when override set to null', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default({
                strategy: 'default',
                scope: 'one'
            });

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        scope: false
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches scope (access single)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        access: {
                            scope: 'one'
                        }
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches scope (access array)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        access: [
                            { scope: 'other' },
                            { scope: 'one' }
                        ]
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('errors on matching scope (access array)', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler,
                    auth: {
                        access: [
                            { scope: 'two' },
                            { scope: 'three' },
                            { entity: 'user', scope: 'one' },
                            { entity: 'app', scope: 'four' }
                        ]
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('matches any entity', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    auth: {
                        entity: 'any'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('matches user entity', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    auth: {
                        entity: 'user'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('errors on missing user entity', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { client: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    auth: {
                        entity: 'user'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom client' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Application credentials cannot be used on a user endpoint');
        });

        it('matches app entity', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { client: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    auth: {
                        entity: 'app'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom client' } });
            expect(res.statusCode).to.equal(200);
        });

        it('errors on missing app entity', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: () => null,
                    auth: {
                        entity: 'app'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('User credentials cannot be used on an application endpoint');
        });

        it('logs error code when authenticate returns a non-error error', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('test', (srv, options) => {

                return {
                    authenticate: function (request, reply) {

                        return reply('Redirecting ...').redirect('/test');
                    }
                };
            });

            server.auth.strategy('test', 'test', true, {});

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('test');
                }
            });

            let logged = null;
            server.events.on('request-internal', (request, event, tags) => {

                if (tags.unauthenticated) {
                    logged = event;
                }
            });

            await server.inject('/');
            expect(logged.data).to.equal(302);
        });

        it('passes the options.artifacts object, even with an auth filter', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.artifacts);
                    },
                    auth: 'default'
                }
            });

            const options = {
                url: '/',
                headers: { authorization: 'Custom steve' },
                credentials: { foo: 'bar' },
                artifacts: { bar: 'baz' }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result.bar).to.equal('baz');
        });
    });

    describe('payload()', () => {

        it('authenticates request payload', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { validPayload: { payload: null } } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(200);
        });

        it('skips when scheme does not support it', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { validPayload: { payload: null } }, payload: false });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(200);
        });

        it('authenticates request payload (required scheme)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { validPayload: { payload: null } }, options: { payload: true } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {}
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(200);
        });

        it('authenticates request payload (required scheme and required route)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { validPayload: { payload: null } }, options: { payload: true } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        payload: true
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(200);
        });

        it('throws when scheme requires payload authentication and route conflicts', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { validPayload: { payload: null } }, options: { payload: true } });
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    config: {
                        handler: function (request, reply) {

                            return reply(request.auth.credentials.user);
                        },
                        auth: {
                            payload: 'optional'
                        }
                    }
                });
            }).to.throw('Cannot set authentication payload to optional when a strategy requires payload validation in /');
        });

        it('throws when strategy does not support payload authentication', async () => {

            const server = new Hapi.Server();
            const implementation = function () {

                return { authenticate: internals.implementation().authenticate };
            };

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', true, {});
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    config: {
                        handler: function (request, reply) {

                            return reply(request.auth.credentials.user);
                        },
                        auth: {
                            payload: 'required'
                        }
                    }
                });
            }).to.throw('Payload validation can only be required when all strategies support it in /');
        });

        it('throws when no strategy supports optional payload authentication', async () => {

            const server = new Hapi.Server();
            const implementation = function () {

                return { authenticate: internals.implementation().authenticate };
            };

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', true, {});
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    config: {
                        handler: function (request, reply) {

                            return reply(request.auth.credentials.user);
                        },
                        auth: {
                            payload: 'optional'
                        }
                    }
                });
            }).to.throw('Payload authentication requires at least one strategy with payload support in /');
        });

        it('allows one strategy to supports optional payload authentication while another does not', async () => {

            const server = new Hapi.Server();
            const implementation = function () {

                return { authenticate: internals.implementation().authenticate };
            };

            server.auth.scheme('custom1', implementation);
            server.auth.scheme('custom2', internals.implementation);
            server.auth.strategy('default1', 'custom1', {});
            server.auth.strategy('default2', 'custom2', {});
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    config: {
                        handler: function (request, reply) {

                            return reply(request.auth.credentials.user);
                        },
                        auth: {
                            strategies: ['default2', 'default1'],
                            payload: 'optional'
                        }
                    }
                });
            }).to.not.throw();
        });

        it('skips request payload by default', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { skip: {} } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom skip' } });
            expect(res.statusCode).to.equal(200);
        });

        it('skips request payload when unauthenticated', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { skip: {} } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply();
                    },
                    auth: {
                        mode: 'try',
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/' });
            expect(res.statusCode).to.equal(200);
        });

        it('skips optional payload', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { optionalPayload: { payload: Boom.unauthorized(null, 'Custom') } } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        payload: 'optional'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } });
            expect(res.statusCode).to.equal(200);
        });

        it('errors on missing payload when required', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { optionalPayload: { payload: Boom.unauthorized(null, 'Custom') } } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } });
            expect(res.statusCode).to.equal(401);
        });

        it('errors on invalid payload auth when required', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { optionalPayload: { payload: Boom.unauthorized() } } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } });
            expect(res.statusCode).to.equal(401);
        });

        it('errors on invalid request payload (non error)', async () => {

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { invalidPayload: { payload: 'Payload is invalid' } } });
            server.route({
                method: 'POST',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom invalidPayload' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('Payload is invalid');
        });
    });

    describe('response()', () => {

        it('fails on response error', async () => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { response: Boom.internal() } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('test()', () => {

        it('tests a request', async () => {

            const handler = function (request, reply) {

                return new Promise((resolve) => {

                    request.server.auth.test('default', request, (err, credentials) => {

                        if (err) {
                            return resolve({ status: false });
                        }

                        return resolve({ status: true, user: credentials.name });
                    });
                });
            };

            const server = new Hapi.Server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { name: 'steve' } } });
            server.route({ method: 'GET', path: '/', handler });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result.status).to.equal(false);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.result.status).to.equal(true);
            expect(res2.result.user).to.equal('steve');
        });
    });
});


internals.implementation = function (server, options) {

    const settings = Hoek.clone(options);

    if (settings &&
        settings.route) {

        server.route({ method: 'GET', path: '/', handler: (request) => (request.auth.credentials.user || null) });
    }

    const scheme = {
        authenticate: function (request, reply) {

            const req = request.raw.req;
            const authorization = req.headers.authorization;
            if (!authorization) {
                return reply(Boom.unauthorized(null, 'Custom'));
            }

            const parts = authorization.split(/\s+/);
            if (parts.length !== 2) {
                return reply.continue;          // Error without error or credentials
            }

            const username = parts[1];
            const credentials = settings.users[username];

            if (!credentials) {
                throw Boom.unauthorized('Missing credentials', 'Custom');
            }

            if (credentials === 'skip') {
                return reply.unauthenticated(Boom.unauthorized(null, 'Custom'));
            }

            if (typeof credentials === 'string') {
                return credentials;
            }

            return reply.authenticated({ credentials });
        },
        response: function (request, reply) {

            if (request.auth.credentials.response) {
                return reply(request.auth.credentials.response);
            }

            return reply.continue;
        }
    };

    if (!settings ||
        settings.payload !== false) {

        scheme.payload = function (request, reply) {

            if (request.auth.credentials.payload) {
                return reply(request.auth.credentials.payload);
            }

            return reply.continue;
        };
    }

    if (settings &&
        settings.options) {

        scheme.options = settings.options;
    }

    return scheme;
};
