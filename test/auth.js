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

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('authentication', () => {

    it('requires and authenticates a request', (done) => {

        const handler = function (request, reply) {

            return reply(request.auth.credentials.user);
        };

        const server = new Hapi.Server();
        server.connection();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', (res1) => {

            expect(res1.statusCode).to.equal(401);

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res2) => {

                expect(res2.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('disables authentication on a route', (done) => {

        const handler = function (request, reply) {

            return reply(request.auth.isAuthenticated);
        };

        const server = new Hapi.Server();
        server.connection();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'POST', path: '/', config: { auth: false, handler: handler } });

        server.inject({ url: '/', method: 'POST' }, (res1) => {

            expect(res1.statusCode).to.equal(200);

            server.inject({ url: '/', method: 'POST', headers: { authorization: 'Custom steve' } }, (res2) => {

                expect(res2.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('defaults cache to private if request authenticated', (done) => {

        const handler = function (request, reply) {

            return reply('ok').ttl(1000);
        };

        const server = new Hapi.Server();
        server.connection();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
            done();
        });
    });

    describe('strategy()', () => {

        it('fails when options default to null', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true);
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('throws when strategy missing scheme', (done) => {

            const server = new Hapi.Server();
            server.connection();
            expect(() => {

                server.auth.strategy('none');
            }).to.throw('Authentication strategy none missing scheme');
            done();
        });

        it('adds a route to server', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} }, route: true });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(401);

                server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('uses views', (done) => {

            const implementation = function (server, options) {

                server.views({
                    engines: { 'html': Handlebars },
                    relativeTo: Path.join(__dirname, '/templates/plugin')
                });

                const handler = function (request, reply) {

                    return reply.view('test', { message: 'steve' });
                };

                server.route({ method: 'GET', path: '/view', handler: handler, config: { auth: false } });

                return {
                    authenticate: function (request, reply) {

                        return reply.view('test', { message: 'xyz' });
                    }
                };
            };

            const server = new Hapi.Server();
            server.register(Vision, Hoek.ignore);
            server.connection();

            server.views({
                engines: { 'html': Handlebars },
                relativeTo: Path.join(__dirname, '/no/such/directory')
            });

            server.auth.scheme('custom', implementation);
            server.auth.strategy('default', 'custom', true);

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply();
                }
            });

            server.inject('/view', (res1) => {

                expect(res1.result).to.equal('<h1>steve</h1>');

                server.inject('/', (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.result).to.equal('<h1>xyz</h1>');
                    done();
                });
            });
        });

        it('exposes an api', (done) => {

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
            server.connection();

            server.auth.scheme('custom', implementation);
            server.auth.strategy('xyz', 'custom', true);

            expect(server.auth.api.xyz.x).to.equal(5);
            done();
        });
    });

    describe('default()', () => {

        it('sets default', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });

            server.auth.default('default');
            expect(server.connections[0].auth.settings.default).to.equal({ strategies: ['default'], mode: 'required' });

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(401);

                server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('sets default with object', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.auth.default({ strategy: 'default' });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(401);

                server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('throws when setting default twice', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            expect(() => {

                server.auth.default('default');
                server.auth.default('default');
            }).to.throw('Cannot set default strategy more than once');
            done();
        });

        it('throws when setting default without strategy', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            expect(() => {

                server.auth.default({ mode: 'required' });
            }).to.throw('Missing authentication strategy: default strategy');
            done();
        });

        it('matches dynamic scope', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/test/admin', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    describe('_setupRoute()', () => {

        it('throws when route refers to nonexistent strategy', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            done();
        });
    });

    describe('lookup', () => {

        it('returns the route auth config', (done) => {

            const handler = function (request, reply) {

                return reply(request.connection.auth.lookup(request.route));
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal({
                    strategies: ['default'],
                    mode: 'required'
                });

                done();
            });
        });
    });

    describe('authenticate()', () => {

        it('setups route with optional authentication', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });

            const handler = function (request, reply) {

                return reply(!!request.auth.credentials);
            };
            server.route({ method: 'GET', path: '/', config: { handler: handler, auth: { mode: 'optional' } } });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.payload).to.equal('false');

                server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.payload).to.equal('true');
                    done();
                });
            });
        });

        it('exposes mode', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.auth.mode);
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('required');
                done();
            });
        });

        it('authenticates using multiple strategies', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('second');
                done();
            });
        });

        it('authenticates using credentials object', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });

            const doubleHandler = function (request, reply) {

                const options = { url: '/2', credentials: request.auth.credentials };
                server.inject(options, (res) => {

                    return reply(res.result);
                });
            };

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            server.route({ method: 'GET', path: '/1', handler: doubleHandler });
            server.route({ method: 'GET', path: '/2', handler: handler });

            server.inject({ url: '/1', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('steve');
                done();
            });
        });

        it('authenticates using credentials object (with artifacts)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });

            const doubleHandler = function (request, reply) {

                const options = { url: '/2', credentials: request.auth.credentials, artifacts: '!' };
                server.inject(options, (res) => {

                    return reply(res.result);
                });
            };

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user + request.auth.artifacts);
            };

            server.route({ method: 'GET', path: '/1', handler: doubleHandler });
            server.route({ method: 'GET', path: '/2', handler: handler });

            server.inject({ url: '/1', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('steve!');
                done();
            });
        });

        it('authenticates a request with custom auth settings', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        strategy: 'default'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('authenticates a request with auth strategy name config', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: 'default'
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('tries to authenticate a request', (done) => {

            const handler = function (request, reply) {

                return reply({ status: request.auth.isAuthenticated, error: request.auth.error });
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', 'try', { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result.status).to.equal(false);
                expect(res1.result.error.message).to.equal('Missing authentication');

                server.inject({ url: '/', headers: { authorization: 'Custom john' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.result.status).to.equal(false);
                    expect(res2.result.error.message).to.equal('Missing credentials');

                    server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res3) => {

                        expect(res3.statusCode).to.equal(200);
                        expect(res3.result.status).to.equal(true);
                        expect(res3.result.error).to.not.exist();
                        done();
                    });
                });
            });
        });

        it('errors on invalid authenticate callback missing both error and credentials', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom' } }, (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('logs error', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.on('request-internal', (request, event, tags) => {

                if (tags.auth) {
                    done();
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom john' } }, (res) => {

                expect(res.statusCode).to.equal(401);
            });
        });

        it('returns a non Error error response', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { message: 'in a bottle' } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom message' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('in a bottle');
                done();
            });
        });

        it('handles errors thrown inside authenticate', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: 'throw' } });

            server.once('request-error', (request, err) => {

                expect(err.message).to.equal('Uncaught error: Boom');
            });

            const handler = function (request, reply) {

                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('passes non Error error response when set to try ', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', 'try', { users: { message: 'in a bottle' } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom message' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('in a bottle');
                done();
            });
        });

        it('matches scope (array to single)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches scope (array to array)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one', 'two'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: ['one', 'three']
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches scope (single to array)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: ['one', 'three']
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches scope (single to single)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: 'one'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches dynamic scope (single to single)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/test', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches multiple required dynamic scopes', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/test', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches multiple required dynamic scopes (mixed types)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/test', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches dynamic scope with multiple parts (single to single)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/test/admin', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('does not match broken dynamic scope (single to single)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/test', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Insufficient scope');
                done();
            });
        });

        it('does not match scope (single to single)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: 'one' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: 'onex'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Insufficient scope');
                done();
            });
        });

        it('errors on missing scope', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: 'b'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Insufficient scope');
                done();
            });
        });

        it('errors on missing scope property', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: 'b'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Insufficient scope');
                done();
            });
        });

        it('validates required scope', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
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
                    handler: handler,
                    auth: {
                        scope: ['+c', 'b']
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res1) => {

                expect(res1.statusCode).to.equal(403);
                expect(res1.result.message).to.equal('Insufficient scope');

                server.inject({ url: '/', headers: { authorization: 'Custom john' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('validates forbidden scope', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
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
                    handler: handler,
                    auth: {
                        scope: ['!a', 'b']
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res1) => {

                expect(res1.statusCode).to.equal(403);
                expect(res1.result.message).to.equal('Insufficient scope');

                server.inject({ url: '/', headers: { authorization: 'Custom john' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('validates complex scope', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
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
                    handler: handler,
                    auth: {
                        scope: ['!a', '+b', 'c', 'd']
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res1) => {

                expect(res1.statusCode).to.equal(403);
                expect(res1.result.message).to.equal('Insufficient scope');

                server.inject({ url: '/', headers: { authorization: 'Custom john' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    server.inject({ url: '/', headers: { authorization: 'Custom mary' } }, (res3) => {

                        expect(res3.statusCode).to.equal(200);
                        server.inject({ url: '/', headers: { authorization: 'Custom lucy' } }, (res4) => {

                            expect(res4.statusCode).to.equal(403);
                            expect(res4.result.message).to.equal('Insufficient scope');

                            server.inject({ url: '/', headers: { authorization: 'Custom larry' } }, (res5) => {

                                expect(res5.statusCode).to.equal(403);
                                expect(res5.result.message).to.equal('Insufficient scope');
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('errors on missing scope using arrays', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a', 'b'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        scope: ['c', 'd']
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Insufficient scope');
                done();
            });
        });

        it('ignores default scope when override set to null', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches scope (access single)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        access: {
                            scope: 'one'
                        }
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches scope (access array)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
                    auth: {
                        access: [
                            { scope: 'other' },
                            { scope: 'one' }
                        ]
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('errors on matching scope (access array)', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['one'] } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: handler,
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

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Insufficient scope');
                done();
            });
        });

        it('matches any entity', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        entity: 'any'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('matches user entity', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        entity: 'user'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('errors on missing user entity', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { client: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        entity: 'user'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom client' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('Application credentials cannot be used on a user endpoint');
                done();
            });
        });

        it('matches app entity', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { client: {} } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        entity: 'app'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom client' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('errors on missing app entity', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(request.auth.credentials.user);
                    },
                    auth: {
                        entity: 'app'
                    }
                }
            });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(403);
                expect(res.result.message).to.equal('User credentials cannot be used on an application endpoint');
                done();
            });
        });

        it('logs error code when authenticate returns a non-error error', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            let result;
            server.on('request-internal', (request, event, tags) => {

                if (tags.unauthenticated) {
                    result = event.data;
                }
            });

            server.inject('/', (res) => {

                expect(result).to.equal(302);
                done();
            });
        });

        it('passes the options.artifacts object, even with an auth filter', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result.bar).to.equal('baz');
                done();
            });



        });

    });

    describe('payload()', () => {

        it('authenticates request payload', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('skips when scheme does not support it', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('authenticates request payload (required scheme)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('authenticates request payload (required scheme and required route)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('throws when scheme requires payload authentication and route conflicts', (done) => {

            const server = new Hapi.Server();
            server.connection();
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
            done();
        });

        it('throws when strategy does not support payload authentication', (done) => {

            const server = new Hapi.Server();
            server.connection();
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
            done();
        });

        it('throws when no strategy supports optional payload authentication', (done) => {

            const server = new Hapi.Server();
            server.connection();
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
            done();
        });

        it('allows one strategy to supports optional payload authentication while another does not', (done) => {

            const server = new Hapi.Server();
            server.connection();
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
            done();
        });

        it('skips request payload by default', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom skip' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('skips request payload when unauthenticated', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/' }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('skips optional payload', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('errors on missing payload when required', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } }, (res) => {

                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('errors on invalid payload auth when required', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } }, (res) => {

                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('errors on invalid request payload (non error)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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

            server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom invalidPayload' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Payload is invalid');
                done();
            });
        });
    });

    describe('response()', () => {

        it('fails on response error', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.credentials.user);
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', true, { users: { steve: { response: Boom.internal() } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('test()', () => {

        it('tests a request', (done) => {

            const handler = function (request, reply) {

                request.server.auth.test('default', request, (err, credentials) => {

                    if (err) {
                        return reply({ status: false });
                    }

                    return reply({ status: true, user: credentials.name });
                });
            };

            const server = new Hapi.Server();
            server.connection();
            server.auth.scheme('custom', internals.implementation);
            server.auth.strategy('default', 'custom', { users: { steve: { name: 'steve' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result.status).to.equal(false);

                server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.result.status).to.equal(true);
                    expect(res2.result.user).to.equal('steve');
                    done();
                });
            });
        });
    });
});


internals.implementation = function (server, options) {

    const settings = Hoek.clone(options);

    if (settings &&
        settings.route) {

        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply(request.auth.credentials.user);
            }
        });
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
                return reply.continue();        // Error without error or credentials
            }

            const username = parts[1];
            const credentials = settings.users[username];

            if (!credentials) {
                return reply(Boom.unauthorized('Missing credentials', 'Custom'));
            }

            if (credentials === 'skip') {
                return reply(Boom.unauthorized(null, 'Custom'));
            }

            if (credentials === 'throw') {
                throw new Error('Boom');
            }

            if (typeof credentials === 'string') {
                return reply(credentials);
            }

            return reply.continue({ credentials: credentials });
        },
        response: function (request, reply) {

            if (request.auth.credentials.response) {
                return reply(request.auth.credentials.response);
            }

            return reply.continue();
        }
    };

    if (!settings ||
        settings.payload !== false) {

        scheme.payload = function (request, reply) {

            if (request.auth.credentials.payload) {
                return reply(request.auth.credentials.payload);
            }

            return reply.continue();
        };
    }

    if (settings &&
        settings.options) {

        scheme.options = settings.options;
    }

    return scheme;
};
