'use strict';

const Boom = require('@hapi/boom');
const Code = require('@hapi/code');
const Hapi = require('..');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('handler', () => {

    describe('execute()', () => {

        it('bypasses onPostHandler when handler calls takeover()', async () => {

            const server = Hapi.server();
            server.ext('onPostHandler', () => 'else');
            server.route({ method: 'GET', path: '/', handler: (request, h) => 'something' });
            server.route({ method: 'GET', path: '/takeover', handler: (request, h) => h.response('something').takeover() });

            const res1 = await server.inject('/');
            expect(res1.result).to.equal('else');

            const res2 = await server.inject('/takeover');
            expect(res2.result).to.equal('something');
        });

        it('returns 500 on handler exception (same tick)', async () => {

            const server = Hapi.server({ debug: false });

            const handler = (request) => {

                const a = null;
                a.b.c;
            };

            server.route({ method: 'GET', path: '/domain', handler });

            const res = await server.inject('/domain');
            expect(res.statusCode).to.equal(500);
        });

        it('returns 500 on handler exception (next tick await)', async () => {

            const handler = async (request) => {

                await Hoek.wait(0);
                const not = null;
                not.here;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const log = server.events.once({ name: 'request', channels: 'error' });

            const orig = console.error;
            console.error = function (...args) {

                console.error = orig;
                expect(args[0]).to.equal('Debug:');
                expect(args[1]).to.equal('internal, implementation, error');
            };

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);

            const [, event] = await log;
            expect(event.error.message).to.equal('Cannot read property \'here\' of null');
        });
    });

    describe('handler()', () => {

        it('binds handler to route bind object', async () => {

            const item = { x: 123 };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: function (request) {

                        return this.x;
                    },
                    bind: item
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(item.x);
        });

        it('binds handler to route bind object (toolkit)', async () => {

            const item = { x: 123 };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: (request, h) => h.context.x,
                    bind: item
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(item.x);
        });

        it('returns 500 on ext method exception (same tick)', async () => {

            const server = Hapi.server({ debug: false });

            const onRequest = function () {

                const a = null;
                a.b.c;
            };

            server.ext('onRequest', onRequest);

            server.route({ method: 'GET', path: '/domain', handler: () => 'neven gonna happen' });

            const res = await server.inject('/domain');
            expect(res.statusCode).to.equal(500);
        });

        it('returns 500 on custom function error', async () => {

            const server = Hapi.server({ debug: false });

            const onPreHandler = function (request, h) {

                request.app.custom = () => {

                    throw new Error('oops');
                };

                return h.continue;
            };

            server.ext('onPreHandler', onPreHandler);

            server.route({ method: 'GET', path: '/', handler: (request) => request.app.custom() });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('prerequisitesConfig()', () => {

        it('shows the complete prerequisite pipeline in the response', async () => {

            const pre1 = (request, h) => {

                return h.response('Hello').code(444);
            };

            const pre2 = (request) => {

                return request.pre.m1 + request.pre.m3 + request.pre.m4;
            };

            const pre3 = async (request) => {

                await Hoek.wait(0);
                return ' ';
            };

            const pre4 = () => 'World';

            const pre5 = (request) => {

                return request.pre.m2 + (request.pre.m0 === null ? '!' : 'x');
            };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        {
                            method: (request, h) => h.continue,
                            assign: 'm0'
                        },
                        [
                            { method: pre1, assign: 'm1' },
                            { method: pre3, assign: 'm3' },
                            { method: pre4, assign: 'm4' }
                        ],
                        { method: pre2, assign: 'm2' },
                        { method: pre5, assign: 'm5' }
                    ],
                    handler: (request) => request.pre.m5
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('Hello World!');
        });

        it('allows a single prerequisite', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        { method: () => 'Hello', assign: 'p' }
                    ],
                    handler: (request) => request.pre.p
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('Hello');
        });

        it('allows an empty prerequisite array', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [],
                    handler: () => 'Hello'
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('Hello');
        });

        it('takes over response', async () => {

            const pre1 = () => 'Hello';

            const pre2 = (request) => {

                return request.pre.m1 + request.pre.m3 + request.pre.m4;
            };

            const pre3 = async (request, h) => {

                await Hoek.wait(0);
                return h.response(' ').takeover();
            };

            const pre4 = () => 'World';

            const pre5 = (request) => {

                return request.pre.m2 + '!';
            };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        [
                            { method: pre1, assign: 'm1' },
                            { method: pre3, assign: 'm3' },
                            { method: pre4, assign: 'm4' }
                        ],
                        { method: pre2, assign: 'm2' },
                        { method: pre5, assign: 'm5' }
                    ],
                    handler: (request) => request.pre.m5
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(' ');
        });

        it('returns error if prerequisite returns error', async () => {

            const pre1 = () => 'Hello';

            const pre2 = function () {

                throw Boom.internal('boom');
            };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        [{ method: pre1, assign: 'm1' }],
                        { method: pre2, assign: 'm2' }
                    ],
                    handler: (request) => request.pre.m1
                }
            });

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(500);
        });

        it('passes wrapped object', async () => {

            const pre = (request, h) => {

                return h.response('Hello').code(444);
            };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        { method: pre, assign: 'p' }
                    ],
                    handler: (request) => request.preResponses.p
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(444);
        });

        it('returns 500 if prerequisite throws', async () => {

            const pre1 = () => 'Hello';
            const pre2 = function () {

                const a = null;
                a.b.c = 0;
            };

            const server = Hapi.server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        [{ method: pre1, assign: 'm1' }],
                        { method: pre2, assign: 'm2' }
                    ],
                    handler: (request) => request.pre.m1
                }
            });

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(500);
        });

        it('sets pre failAction to error', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        {
                            method: () => {

                                throw Boom.forbidden();
                            },
                            failAction: 'error'
                        }
                    ],
                    handler: () => 'ok'
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(403);
        });

        it('sets pre failAction to ignore', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        {
                            method: () => {

                                throw Boom.forbidden();
                            },
                            failAction: 'ignore'
                        }
                    ],
                    handler: () => 'ok'
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('sets pre failAction to log', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        {
                            assign: 'before',
                            method: () => {

                                throw Boom.forbidden();
                            },
                            failAction: 'log'
                        }
                    ],
                    handler: (request) => {

                        if (request.pre.before === request.preResponses.before &&
                            request.pre.before instanceof Error) {

                            return 'ok';
                        }

                        throw new Error();
                    }
                }
            });

            let logged;
            server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

                if (tags.pre &&
                    tags.error) {

                    logged = event;
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(logged.error.assign).to.equal('before');
        });

        it('sets pre failAction to method', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        {
                            assign: 'value',
                            method: () => {

                                throw Boom.forbidden();
                            },
                            failAction: (request, h, err) => {

                                expect(err.output.statusCode).to.equal(403);
                                return 'failed';
                            }
                        }
                    ],
                    handler: (request) => (request.pre.value + '!')
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('failed!');
        });

        it('sets pre failAction to method with takeover', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [
                        {
                            assign: 'value',
                            method: () => {

                                throw Boom.forbidden();
                            },
                            failAction: (request, h, err) => {

                                expect(err.output.statusCode).to.equal(403);
                                return h.response('failed').takeover();
                            }
                        }
                    ],
                    handler: (request) => (request.pre.value + '!')
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('failed');
        });

        it('binds pre to route bind object', async () => {

            const item = { x: 123 };

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    pre: [{
                        method: function (request) {

                            return this.x;
                        },
                        assign: 'x'
                    }],
                    handler: (request) => request.pre.x,
                    bind: item
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(item.x);
        });

        it('logs boom error instance as data if handler returns boom error', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: function () {

                        throw Boom.forbidden();
                    }
                }
            });

            const log = new Promise((resolve) => {

                server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

                    if (tags.handler &&
                        tags.error) {

                        resolve({ event, tags });
                    }
                });
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(403);

            const { event } = await log;
            expect(event.error.isBoom).to.equal(true);
            expect(event.error.output.statusCode).to.equal(403);
            expect(event.error.message).to.equal('Forbidden');
        });
    });

    describe('defaults()', () => {

        it('returns handler without defaults', async () => {

            const handler = function (route, options) {

                return (request) => request.route.settings.app;
            };

            const server = Hapi.server();
            server.decorate('handler', 'test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            const res = await server.inject('/');
            expect(res.result).to.equal({});
        });

        it('returns handler with object defaults', async () => {

            const handler = function (route, options) {

                return (request) => request.route.settings.app;
            };

            handler.defaults = {
                app: {
                    x: 1
                }
            };

            const server = Hapi.server();
            server.decorate('handler', 'test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            const res = await server.inject('/');
            expect(res.result).to.equal({ x: 1 });
        });

        it('returns handler with function defaults', async () => {

            const handler = function (route, options) {

                return (request) => request.route.settings.app;
            };

            handler.defaults = function (method) {

                return {
                    app: {
                        x: method
                    }
                };
            };

            const server = Hapi.server();
            server.decorate('handler', 'test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            const res = await server.inject('/');
            expect(res.result).to.equal({ x: 'get' });
        });

        it('throws on handler with invalid defaults', () => {

            const handler = function (route, options) {

                return (request) => request.route.settings.app;
            };

            handler.defaults = 'invalid';

            const server = Hapi.server();
            expect(() => {

                server.decorate('handler', 'test', handler);
            }).to.throw('Handler defaults property must be an object or function');
        });
    });
});
