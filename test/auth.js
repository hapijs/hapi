'use strict';

const Path = require('path');

const Boom = require('@hapi/boom');
const Code = require('@hapi/code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');
const Vision = require('@hapi/vision');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('authentication', () => {

    it('requires and authenticates a request', async () => {

        const server = Hapi.server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });
        server.auth.default('default');
        server.route({ method: 'GET', path: '/', handler: (request) => request.auth });

        const res1 = await server.inject('/');
        expect(res1.statusCode).to.equal(401);

        const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.equal({
            isAuthenticated: true,
            isAuthorized: false,
            isInjected: false,
            credentials: { user: 'steve' },
            artifacts: undefined,
            strategy: 'default',
            mode: 'required',
            error: null
        });
    });

    it('disables authentication on a route', async () => {

        const server = Hapi.server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: {} } });
        server.auth.default('default');
        server.route({ method: 'POST', path: '/', options: { auth: false, handler: (request) => request.auth.isAuthenticated } });

        const res1 = await server.inject({ url: '/', method: 'POST' });
        expect(res1.statusCode).to.equal(200);
        expect(res1.result).to.be.false();

        const res2 = await server.inject({ url: '/', method: 'POST', headers: { authorization: 'Custom steve' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.be.false();
    });

    it('defaults cache to private if request authenticated', async () => {

        const server = Hapi.server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: {} } });
        server.auth.default('default');
        server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').ttl(1000) });

        const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
        expect(res.statusCode).to.equal(200);
        expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
    });

    it('authenticates a request against another route', async () => {

        const server = Hapi.server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one'] } } });
        server.auth.default('default');

        server.route({
            method: 'GET',
            path: '/',
            options: {
                handler: (request) => {

                    const credentials = request.auth.credentials;

                    const access = {
                        two: request.server.lookup('two').auth.access(request),
                        three1: request.server.lookup('three').auth.access(request),
                        four1: request.server.lookup('four').auth.access(request),
                        five1: request.server.lookup('five').auth.access(request)
                    };

                    request.auth.credentials = null;
                    access.three2 = request.server.lookup('three').auth.access(request);
                    access.four2 = request.server.lookup('four').auth.access(request);
                    access.five2 = request.server.lookup('five').auth.access(request);
                    request.auth.credentials = credentials;

                    return access;
                },
                auth: {
                    scope: 'one'
                }
            }
        });

        server.route({ method: 'GET', path: '/two', options: { id: 'two', handler: () => null, auth: { scope: 'two' } } });
        server.route({ method: 'GET', path: '/three', options: { id: 'three', handler: () => null, auth: { scope: 'one' } } });
        server.route({ method: 'GET', path: '/four', options: { id: 'four', handler: () => null, auth: false } });
        server.route({ method: 'GET', path: '/five', options: { id: 'five', handler: () => null, auth: { mode: 'required' } } });

        const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal({
            two: false,
            three1: true,
            three2: false,
            four1: true,
            four2: true,
            five1: true,
            five2: true
        });
    });

    describe('strategy()', () => {

        it('errors when strategy authenticate function throws', async () => {

            const server = Hapi.server({ debug: false });
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom');
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(500);
        });

        it('throws when strategy missing scheme', () => {

            const server = Hapi.server();
            expect(() => {

                server.auth.strategy('none');
            }).to.throw('Authentication strategy none missing scheme');
        });

        it('adds a route to server', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} }, route: true });
            server.auth.default('default');

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(204);
        });

        it('uses views', async () => {

            const implementation = function (server, options) {

                server.views({
                    engines: { 'html': Handlebars },
                    relativeTo: Path.join(__dirname, '/templates/plugin')
                });

                server.route({
                    method: 'GET',
                    path: '/view',
                    handler: (request, h) => h.view('test', { message: 'steve' }),
                    options: { auth: false }
                });

                return {
                    authenticate: (request, h) => h.view('test', { message: 'xyz' }).takeover()
                };
            };

            const server = Hapi.server();
            await server.register(Vision);

            server.views({
                engines: { 'html': Handlebars },
                relativeTo: Path.join(__dirname, '/no/such/directory')
            });

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom');
            server.auth.default('default');

            server.route({ method: 'GET', path: '/', handler: () => null });

            const res1 = await server.inject('/view');
            expect(res1.result).to.equal('<h1>steve</h1>');

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.equal('<h1>xyz</h1>');
        });

        it('exposes an api', () => {

            const implementation = function (server, options) {

                return {
                    api: {
                        x: 5
                    },
                    authenticate: (request, h) => h.continue(null, {})
                };
            };

            const server = Hapi.server();
            server.auth.scheme('custom', implementation);
            server.auth.strategy('xyz', 'custom');
            server.auth.default('xyz');

            expect(server.auth.api.xyz.x).to.equal(5);
        });
    });

    describe('default()', () => {

        it('sets default', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });

            server.auth.default('default');
            expect(server.auth.settings.default).to.equal({ strategies: ['default'], mode: 'required' });

            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(204);
        });

        it('sets default with object', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });

            server.auth.default({ strategy: 'default' });
            expect(server.auth.settings.default).to.equal({ strategies: ['default'], mode: 'required' });

            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(401);

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(204);
        });

        it('throws when setting default twice', () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            expect(() => {

                server.auth.default('default');
                server.auth.default('default');
            }).to.throw('Cannot set default strategy more than once');
        });

        it('throws when setting default without strategy', () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            expect(() => {

                server.auth.default({ mode: 'required' });
            }).to.throw('Missing authentication strategy: default strategy');
        });

        it('matches dynamic scope', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve', scope: 'one-test-admin-x-steve' } } });
            server.auth.default({ strategy: 'default', scope: 'one-{params.id}-{params.role}-{payload.x}-{credentials.user}' });
            server.route({
                method: 'POST',
                path: '/{id}/{role}',
                handler: (request) => request.auth.credentials.user
            });

            const res = await server.inject({ method: 'POST', url: '/test/admin', headers: { authorization: 'Custom steve' }, payload: { x: 'x' } });
            expect(res.statusCode).to.equal(200);
        });
    });

    describe('_setupRoute()', () => {

        it('throws when route refers to nonexistent strategy', () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('a', 'custom', { users: { steve: {} } });
            server.auth.strategy('b', 'custom', { users: { steve: {} } });

            expect(() => {

                server.route({
                    path: '/',
                    method: 'GET',
                    options: {
                        auth: {
                            strategy: 'c'
                        },
                        handler: () => 'ok'
                    }
                });
            }).to.throw('Unknown authentication strategy c in /');
        });
    });

    describe('lookup', () => {

        it('returns the route auth config', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: (request) => request.server.auth.lookup(request.route) });

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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => !!request.auth.credentials,
                    auth: {
                        mode: 'optional'
                    }
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.payload).to.equal('false');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.payload).to.equal('true');
        });

        it('exposes mode', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.auth.mode
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('required');
        });

        it('authenticates using multiple strategies', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('first', 'custom', { users: { steve: 'skip' } });
            server.auth.strategy('second', 'custom', { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.strategy,
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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });
            server.auth.default('default');

            const doubleHandler = async (request) => {

                const options = { url: '/2', auth: { credentials: request.auth.credentials, strategy: 'default' } };
                const res = await server.inject(options);
                return res.result;
            };

            server.route({ method: 'GET', path: '/1', handler: doubleHandler });
            server.route({ method: 'GET', path: '/2', handler: (request) => request.auth.credentials.user });

            const res = await server.inject({ url: '/1', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('steve');
        });

        it('authenticates using credentials object (with artifacts)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });
            server.auth.default('default');

            const doubleHandler = async (request) => {

                const options = { url: '/2', auth: { credentials: request.auth.credentials, artifacts: '!', strategy: 'default' } };
                const res = await server.inject(options);
                return res.result;
            };

            const handler = (request) => {

                return request.auth.credentials.user + request.auth.artifacts;
            };

            server.route({ method: 'GET', path: '/1', handler: doubleHandler });
            server.route({ method: 'GET', path: '/2', handler });

            const res = await server.inject({ url: '/1', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('steve!');
        });

        it('authenticates a request with custom auth settings', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        strategy: 'default'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('authenticates a request with auth strategy name config', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: 'default'
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('tries to authenticate a request', async () => {

            const handler = (request) => {

                return { status: request.auth.isAuthenticated, error: request.auth.error };
            };

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default({ strategy: 'default', mode: 'try' });

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

            const server = Hapi.server({ debug: false });
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom' } });
            expect(res.statusCode).to.equal(500);
        });

        it('logs error', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            let logged = false;
            server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

                if (tags.auth) {
                    logged = true;
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res.statusCode).to.equal(401);
            expect(logged).to.be.true();
        });

        it('returns a non Error error response', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { message: 'in a bottle' } });
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom message' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('in a bottle');
        });

        it('passes non Error error response when set to try ', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { message: 'in a bottle' } });
            server.auth.default({ strategy: 'default', mode: 'try' });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom message' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('in a bottle');
        });

        it('matches scope (array to single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches scope (array to array)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one', 'two'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['one', 'three']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches scope (single to array)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['one', 'three']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches scope (single to single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches dynamic scope (single to single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one-test' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/{id}',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'one-{params.id}'
                    }
                }
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches multiple required dynamic scopes', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['test', 'one-test'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/{id}',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['+one-{params.id}', '+{params.id}']
                    }
                }
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches multiple required dynamic scopes (mixed types)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['test', 'one-test'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/{id}',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['+one-{params.id}', '{params.id}']
                    }
                }
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches dynamic scope with multiple parts (single to single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one-test-admin' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/{id}/{role}',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'one-{params.id}-{params.role}'
                    }
                }
            });

            const res = await server.inject({ url: '/test/admin', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('does not match broken dynamic scope (single to single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one-test' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/{id}',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'one-params.id}'
                    }
                }
            });

            server.ext('onPreResponse', (request, h) => {

                expect(request.response.data).to.contain(['got', 'need']);
                return h.continue;
            });

            const res = await server.inject({ url: '/test', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('does not match scope (single to single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'one' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'onex'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('matches modified scope', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: 'two' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            server.ext('onCredentials', (request, h) => {

                request.auth.credentials.scope = 'one';
                return h.continue;
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('errors on missing scope', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['a'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', {
                users: {
                    steve: { scope: ['a', 'b'] },
                    john: { scope: ['a', 'b', 'c'] }
                }
            });

            server.auth.default('default');

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['+c', 'b']
                    }
                }
            });

            const res1 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res1.statusCode).to.equal(403);
            expect(res1.result.message).to.equal('Insufficient scope');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(204);
        });

        it('validates forbidden scope', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', {
                users: {
                    steve: { scope: ['a', 'b'] },
                    john: { scope: ['b', 'c'] }
                }
            });

            server.auth.default('default');

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['!a', 'b']
                    }
                }
            });

            const res1 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res1.statusCode).to.equal(403);
            expect(res1.result.message).to.equal('Insufficient scope');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(204);
        });

        it('validates complex scope', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', {
                users: {
                    steve: { scope: ['a', 'b', 'c'] },
                    john: { scope: ['b', 'c'] },
                    mary: { scope: ['b', 'd'] },
                    lucy: { scope: 'b' },
                    larry: { scope: ['c', 'd'] }
                }
            });

            server.auth.default('default');

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['!a', '+b', 'c', 'd']
                    }
                }
            });

            const res1 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res1.statusCode).to.equal(403);
            expect(res1.result.message).to.equal('Insufficient scope');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res2.statusCode).to.equal(204);

            const res3 = await server.inject({ url: '/', headers: { authorization: 'Custom mary' } });
            expect(res3.statusCode).to.equal(204);

            const res4 = await server.inject({ url: '/', headers: { authorization: 'Custom lucy' } });
            expect(res4.statusCode).to.equal(403);
            expect(res4.result.message).to.equal('Insufficient scope');

            const res5 = await server.inject({ url: '/', headers: { authorization: 'Custom larry' } });
            expect(res5.statusCode).to.equal(403);
            expect(res5.result.message).to.equal('Insufficient scope');
        });

        it('errors on missing scope using arrays', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['a', 'b'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: ['c', 'd']
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('uses default scope when no scope override is set', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('a', 'custom', { users: { steve: { scope: ['two'] } } });
            server.auth.default({
                strategy: 'a',
                access: {
                    scope: 'one'
                }
            });

            server.route({
                path: '/',
                method: 'GET',
                options: {
                    auth: {
                        mode: 'required'
                    },
                    handler: () => 'ok'
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(403);
            expect(res.result.message).to.equal('Insufficient scope');
        });

        it('ignores default scope when override set to null', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default({
                strategy: 'default',
                scope: 'one'
            });

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        scope: false
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches scope (access single)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth,
                    auth: {
                        access: {
                            scope: 'one'
                        }
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({
                isAuthenticated: true,
                isAuthorized: true,
                isInjected: false,
                credentials: { scope: ['one'], user: null },
                artifacts: undefined,
                strategy: 'default',
                mode: 'required',
                error: null
            });
        });

        it('matches scope (access array)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        access: [
                            { scope: 'other' },
                            { scope: 'one' }
                        ]
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('errors on matching scope (access array)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => null,
                    auth: {
                        entity: 'any'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('matches user entity', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => null,
                    auth: {
                        entity: 'user'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(204);
        });

        it('errors on missing user entity', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { client: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { client: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => null,
                    auth: {
                        entity: 'app'
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom client' } });
            expect(res.statusCode).to.equal(204);
        });

        it('errors on missing app entity', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
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

            const server = Hapi.server();
            server.auth.scheme('test', (srv, options) => {

                return {
                    authenticate: (request, h) => h.response('Redirecting ...').redirect('/test').takeover()
                };
            });

            server.auth.strategy('test', 'test', {});
            server.auth.default('test');

            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'test'
            });

            let logged = null;
            server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

                if (tags.unauthenticated) {
                    logged = event;
                }
            });

            await server.inject('/');
            expect(logged.data).to.equal({ statusCode: 302 });
        });

        it('passes the options.artifacts object, even with an auth filter', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth.artifacts,
                    auth: 'default'
                }
            });

            const options = {
                url: '/',
                headers: { authorization: 'Custom steve' },
                auth: {
                    credentials: { foo: 'bar' },
                    artifacts: { bar: 'baz' },
                    strategy: 'default'
                }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result.bar).to.equal('baz');
        });

        it('errors on empty authenticate()', async () => {

            const scheme = () => {

                return { authenticate: (request, h) => h.authenticated() };
            };

            const server = Hapi.server({ debug: false });
            server.auth.scheme('custom', scheme);
            server.auth.strategy('default', 'custom');
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: () => null });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('passes credentials on unauthenticated() in try mode', async () => {

            const scheme = () => {

                return { authenticate: (request, h) => h.unauthenticated(Boom.unauthorized(), { credentials: { user: 'steve' } }) };
            };

            const server = Hapi.server();
            server.ext('onPreResponse', (request, h) => {

                if (request.auth.credentials.user === 'steve') {
                    return h.continue;
                }
            });

            server.auth.scheme('custom', scheme);
            server.auth.strategy('default', 'custom');
            server.auth.default({ strategy: 'default', mode: 'try' });
            server.route({ method: 'GET', path: '/', handler: () => null });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
        });

        it('passes strategy, credentials, artifacts, error on unauthenticated() in required mode', async () => {

            const scheme = () => {

                return { authenticate: (request, h) => h.unauthenticated(Boom.unauthorized(), { credentials: { user: 'steve' }, artifacts: '!' }) };
            };

            const server = Hapi.server();
            server.ext('onPreResponse', (request, h) => {

                if (request.auth.credentials.user === 'steve') {
                    return h.continue;
                }
            });

            server.ext('onPreResponse', (request, h) => {

                expect(request.auth.credentials).to.equal({ user: 'steve' });
                expect(request.auth.artifacts).to.equal('!');
                expect(request.auth.strategy).to.equal('default');
                expect(request.auth.error.message).to.equal('Unauthorized');
                return h.continue;
            });

            server.auth.scheme('custom', scheme);
            server.auth.strategy('default', 'custom');
            server.auth.default('default', { mode: 'required' });

            server.route({ method: 'GET', path: '/', handler: () => null });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(401);
        });
    });

    describe('verify()', () => {

        it('verifies an authenticated request', async () => {

            const implementation = (...args) => {

                const imp = internals.implementation(...args);
                imp.verify = async (auth) => {

                    await Hoek.wait(1);
                    if (auth.credentials.user !== 'steve') {
                        throw Boom.unauthorized('Invalid');
                    }
                };

                return imp;
            };

            const server = Hapi.server();
            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' }, john: { user: 'john' } } });

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    auth: {
                        mode: 'try',
                        strategy: 'default'
                    },
                    handler: async (request) => {

                        if (request.auth.error &&
                            request.auth.error.message === 'Missing authentication') {

                            request.auth.error = null;
                        }

                        return await server.auth.verify(request) || 'ok';
                    }
                }
            });

            const res1 = await server.inject('/');
            expect(res1.result).to.equal('ok');

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.result).to.equal('ok');

            const res3 = await server.inject({ url: '/', headers: { authorization: 'Custom unknown' } });
            expect(res3.result.message).to.equal('Missing credentials');

            const res4 = await server.inject({ url: '/', auth: { credentials: {}, strategy: 'default' } });
            expect(res4.result.message).to.equal('Invalid');

            const res5 = await server.inject({ url: '/', auth: { credentials: { user: 'steve' }, strategy: 'default' } });
            expect(res5.result).to.equal('ok');

            const res6 = await server.inject({ url: '/', headers: { authorization: 'Custom john' } });
            expect(res6.result.message).to.equal('Invalid');
        });

        it('skips when verify unsupported', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { user: 'steve' } } });

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    auth: {
                        mode: 'try',
                        strategy: 'default'
                    },
                    handler: async (request) => {

                        return await server.auth.verify(request) || 'ok';
                    }
                }
            });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.result).to.equal('ok');
        });
    });

    describe('access()', () => {

        it('skips access when unauthenticated and mode is not required', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { scope: ['one'] } } });
            server.auth.default('default');
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request) => request.auth,
                    auth: {
                        mode: 'optional',
                        access: {
                            scope: 'one'
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result.isAuthenticated).to.be.false();
            expect(res.result.isAuthorized).to.be.false();
        });
    });

    describe('payload()', () => {

        it('authenticates request payload', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { validPayload: { payload: null } } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(204);
        });

        it('skips when scheme does not support it', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { validPayload: { payload: null } }, payload: false });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(204);
        });

        it('authenticates request payload (required scheme)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { validPayload: { payload: null } }, options: { payload: true } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {}
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(204);
        });

        it('authenticates request payload (required scheme and required route)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { validPayload: { payload: null } }, options: { payload: true } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        payload: true
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } });
            expect(res.statusCode).to.equal(204);
        });

        it('throws when scheme requires payload authentication and route conflicts', () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { validPayload: { payload: null } }, options: { payload: true } });
            server.auth.default('default');
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    options: {
                        handler: (request) => request.auth.credentials.user,
                        auth: {
                            payload: 'optional'
                        }
                    }
                });
            }).to.throw('Cannot set authentication payload to optional when a strategy requires payload validation in /');
        });

        it('throws when strategy does not support payload authentication', () => {

            const server = Hapi.server();
            const implementation = function () {

                return { authenticate: internals.implementation().authenticate };
            };

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', {});
            server.auth.default('default');
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    options: {
                        handler: (request) => request.auth.credentials.user,
                        auth: {
                            payload: 'required'
                        }
                    }
                });
            }).to.throw('Payload validation can only be required when all strategies support it in /');
        });

        it('throws when no strategy supports optional payload authentication', () => {

            const server = Hapi.server();
            const implementation = function () {

                return { authenticate: internals.implementation().authenticate };
            };

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', {});
            server.auth.default('default');
            expect(() => {

                server.route({
                    method: 'POST',
                    path: '/',
                    options: {
                        handler: (request) => request.auth.credentials.user,
                        auth: {
                            payload: 'optional'
                        }
                    }
                });
            }).to.throw('Payload authentication requires at least one strategy with payload support in /');
        });

        it('allows one strategy to supports optional payload authentication while another does not', async () => {

            const server = Hapi.server();
            const implementation = function (...args) {

                return { authenticate: internals.implementation(...args).authenticate };
            };

            server.auth.scheme('custom1', implementation);
            server.auth.scheme('custom2', internals.implementation, { users: {} });
            server.auth.strategy('default1', 'custom1', { users: { steve: { user: 'steve' } } });
            server.auth.strategy('default2', 'custom2', {});

            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        strategies: ['default1', 'default2'],
                        payload: 'optional'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(200);
        });

        it('skips request payload by default', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { skip: {} } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom skip' } });
            expect(res.statusCode).to.equal(204);
        });

        it('skips request payload when unauthenticated', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { skip: {} } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: () => null,
                    auth: {
                        mode: 'try',
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/' });
            expect(res.statusCode).to.equal(204);
        });

        it('skips optional payload', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { optionalPayload: { payload: Boom.unauthorized(null, 'Custom') } } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        payload: 'optional'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } });
            expect(res.statusCode).to.equal(204);
        });

        it('errors on missing payload when required', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { optionalPayload: { payload: Boom.unauthorized(null, 'Custom') } } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } });
            expect(res.statusCode).to.equal(401);
        });

        it('errors on invalid payload auth when required', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { optionalPayload: { payload: Boom.unauthorized() } } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
                    auth: {
                        payload: 'required'
                    }
                }
            });

            const res = await server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } });
            expect(res.statusCode).to.equal(401);
        });

        it('errors on invalid request payload (non error)', async () => {

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { invalidPayload: { payload: 'Payload is invalid' } } });
            server.auth.default('default');
            server.route({
                method: 'POST',
                path: '/',
                options: {
                    handler: (request) => request.auth.credentials.user,
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

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { response: Boom.internal() } } });
            server.auth.default('default');
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.credentials.user });

            const res = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('test()', () => {

        it('tests a request', async () => {

            const handler = async (request) => {

                try {
                    const { credentials, artifacts } = await request.server.auth.test('default', request);
                    return { status: true, user: credentials.name, artifacts };
                }
                catch (err) {
                    return { status: false };
                }
            };

            const server = Hapi.server();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { name: 'steve' }, skip: 'skip' }, artifacts: {} });
            server.route({ method: 'GET', path: '/', handler });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result.status).to.be.false();

            const res2 = await server.inject({ url: '/', headers: { authorization: 'Custom steve' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.result.status).to.be.true();
            expect(res2.result.user).to.equal('steve');
            expect(res2.result.artifacts).to.equal({});

            const res3 = await server.inject({ url: '/', headers: { authorization: 'Custom skip' } });
            expect(res3.statusCode).to.equal(200);
            expect(res3.result.status).to.be.false();
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
        authenticate: (request, h) => {

            const req = request.raw.req;
            const authorization = req.headers.authorization;
            if (!authorization) {
                return Boom.unauthorized(null, 'Custom');
            }

            const parts = authorization.split(/\s+/);
            if (parts.length !== 2) {
                return h.continue;          // Error without error or credentials
            }

            const username = parts[1];
            const credentials = settings.users[username];

            if (!credentials) {
                throw Boom.unauthorized('Missing credentials', 'Custom');
            }

            if (credentials === 'skip') {
                return h.unauthenticated(Boom.unauthorized(null, 'Custom'));
            }

            if (typeof credentials === 'string') {
                return h.response(credentials).takeover();
            }

            credentials.user = credentials.user || null;
            return h.authenticated({ credentials, artifacts: settings.artifacts });
        },
        response: (request, h) => {

            if (request.auth.credentials.response) {
                throw request.auth.credentials.response;
            }

            return h.continue;
        }
    };

    if (!settings ||
        settings.payload !== false) {

        scheme.payload = (request, h) => {

            const result = request.auth.credentials.payload;
            if (!result) {
                return h.continue;
            }

            if (result.isBoom) {
                throw result;
            }

            return h.response(request.auth.credentials.payload).takeover();
        };
    }

    if (settings &&
        settings.options) {

        scheme.options = settings.options;
    }

    return scheme;
};
