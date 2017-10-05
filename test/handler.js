'use strict';

// Load modules

const Path = require('path');

const Boom = require('boom');
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

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('handler', () => {

    describe('execute()', () => {

        it('returns 500 on handler exception (same tick)', async () => {

            const server = new Hapi.Server({ debug: false });

            const handler = (request) => {

                const a = null;
                a.b.c;
            };

            server.route({ method: 'GET', path: '/domain', handler });

            const res = await server.inject('/domain');
            expect(res.statusCode).to.equal(500);
        });

        it('returns 500 on handler exception (next tick await)', { parallel: false }, async () => {

            const handler = async (request) => {

                await new Promise((resolve) => setImmediate(resolve));
                const not = null;
                not.here;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const log = server.events.once('request-error');

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('internal, implementation, error');
            };

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);

            const [, err] = await log;
            expect(err.message).to.equal('Cannot read property \'here\' of null');
        });
    });

    describe('handler()', () => {

        it('binds handler to route bind object', async () => {

            const item = { x: 123 };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request) {

                        return this.x;
                    },
                    bind: item
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(item.x);
        });

        it('wraps unhandled promise rejections in an error if needed', async () => {

            const server = new Hapi.Server({ debug: false });

            const handler = (request) => {

                return Promise.reject('this should be wrapped in an error');
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result.error).to.equal('Internal Server Error');
        });
    });

    describe('register()', () => {

        it('returns a file', async () => {

            const server = new Hapi.Server({ routes: { files: { relativeTo: Path.join(__dirname, '../') } } });
            await server.register(Inert);
            const handler = (request, responder) => {

                return responder.file('./package.json').code(499);
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject('/file');
            expect(res.statusCode).to.equal(499);
            expect(res.payload).to.contain('hapi');
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-length']).to.exist();
            expect(res.headers['content-disposition']).to.not.exist();
        });

        it('returns a view', async () => {

            const server = new Hapi.Server();
            await server.register(Vision);

            server.views({
                engines: { 'html': Handlebars },
                relativeTo: Path.join(__dirname, '/templates/plugin')
            });

            const handler = (request, responder) => {

                return responder.view('test', { message: 'steve' });
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('<h1>steve</h1>');
        });
    });

    describe('prerequisitesConfig()', () => {

        it('shows the complete prerequisite pipeline in the response', async () => {

            const pre1 = (request, responder) => {

                return responder.wrap('Hello').code(444);
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

                return request.pre.m2 + '!';
            };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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
            expect(res.result).to.equal('Hello World!');
        });

        it('allows a single prerequisite', async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const pre3 = async (request, responder) => {

                await Hoek.wait(0);
                return responder.wrap(' ').takeover();
            };

            const pre4 = () => 'World';

            const pre5 = (request) => {

                return request.pre.m2 + '!';
            };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const pre = (request, responder) => {

                return responder.wrap('Hello').code(444);
            };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server({ debug: false });
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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
            server.events.on('request-internal', (request, event, tags) => {

                if (event.internal &&
                    tags.pre &&
                    tags.error) {

                    logged = event;
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(logged.data.assign).to.equal('before');
        });

        it('binds pre to route bind object', async () => {

            const item = { x: 123 };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
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

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function () {

                        throw Boom.forbidden();
                    }
                }
            });

            const log = new Promise((resolve) => {

                server.events.on('request-internal', (request, event, tags) => {

                    if (event.internal &&
                        tags.handler &&
                        tags.error) {

                        resolve({ event, tags });
                    }
                });
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(403);

            const { event } = await log;
            expect(event.data.data.isBoom).to.equal(true);
            expect(event.data.data.output.statusCode).to.equal(403);
            expect(event.data.data.message).to.equal('Forbidden');
        });
    });

    describe('defaults()', () => {

        it('returns handler without defaults', async () => {

            const handler = function (route, options) {

                return (request) => request.route.settings.app;
            };

            const server = new Hapi.Server();
            server.handler('test', handler);
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

            const server = new Hapi.Server();
            server.handler('test', handler);
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

            const server = new Hapi.Server();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            const res = await server.inject('/');
            expect(res.result).to.equal({ x: 'get' });
        });

        it('throws on handler with invalid defaults', async () => {

            const handler = function (route, options) {

                return (request) => request.route.settings.app;
            };

            handler.defaults = 'invalid';

            const server = new Hapi.Server();
            expect(() => {

                server.handler('test', handler);
            }).to.throw('Handler defaults property must be an object or function');
        });
    });

    describe('invoke()', () => {

        it('returns 500 on ext method exception (same tick)', async () => {

            const server = new Hapi.Server({ debug: false });

            const onRequest = function () {

                const a = null;
                a.b.c;
            };

            server.ext('onRequest', onRequest);

            server.route({ method: 'GET', path: '/domain', handler: () => 'neven gonna happen' });

            const res = await server.inject('/domain');
            expect(res.statusCode).to.equal(500);
        });
    });
});
