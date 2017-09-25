'use strict';

// Load modules

const Path = require('path');

const Boom = require('boom');
const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
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

            const handler = function (request) {

                const a = null;
                a.b.c;
            };

            server.route({ method: 'GET', path: '/domain', handler });

            const res = await server.inject('/domain');
            expect(res.statusCode).to.equal(500);
        });

        it.skip('returns 500 on handler exception (promise inners)', { parallel: false }, async () => {

            const handler = function (request) {

                return new Promise(() => {

                    setImmediate(() => {

                        const not = null;
                        not.here;
                    });
                });
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
            expect(err.message).to.equal('Uncaught error: Cannot read property \'here\' of null');
        });

        it.skip('returns 500 on handler exception (next tick)', { parallel: false }, async () => {

            const handler = function (request) {

                setImmediate(() => {

                    const not = null;
                    not.here;
                });

                return 'ok';
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
            expect(err.message).to.equal('Uncaught error: Cannot read property \'here\' of null');
        });

        it('returns 500 on handler exception (next tick await)', { parallel: false }, async () => {

            const handler = async function (request) {

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
                    handler: function (request, reply) {

                        return reply(this.x);
                    },
                    bind: item
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(item.x);
        });

        it('invokes handler with right arguments', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                expect(arguments.length).to.equal(2);
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
        });

        it.skip('catches asynchronous exceptions in promise constructors via the standard \'protect\' mechanism', async () => {

            const server = new Hapi.Server({ debug: false });

            const asyncOperation = function () {

                return new Promise((resolve, reject) => {

                    setTimeout(() => {

                        throw new Error('This should be caught...');
                    }, 100);
                });
            };

            const handler = function (request, reply) {

                return asyncOperation()
                    .then(reply);
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result.error).to.equal('Internal Server Error');
        });

        it('catches synchronous exceptions which lead to unhandled promise rejections when then promise is returned', async () => {

            const server = new Hapi.Server();

            const asyncOperation = function () {

                return new Promise((resolve, reject) => {

                    throw new Error('This should be rejected...');
                });
            };

            const handler = function (request, reply) {

                return asyncOperation()
                    .then(reply);
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result.error).to.equal('Internal Server Error');
        });

        it('catches unhandled promise rejections when a promise is returned', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return Promise.reject(new Error('This should be caught.'));
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result.error).to.equal('Internal Server Error');
        });

        it('wraps unhandled promise rejections in an error if needed', async () => {

            const server = new Hapi.Server({ debug: false });

            const handler = function (request, reply) {

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
            const handler = function (request, reply) {

                return reply.file('./package.json').code(499);
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

            const handler = function (request, reply) {

                return reply.view('test', { message: 'steve' });
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('<h1>steve</h1>');
        });
    });

    describe('prerequisitesConfig()', () => {

        it('shows the complete prerequisite pipeline in the response', async () => {

            const pre1 = function (request, reply) {

                return reply('Hello').code(444);
            };

            const pre2 = function (request, reply) {

                return reply(request.pre.m1 + request.pre.m3 + request.pre.m4);
            };

            const pre3 = async function (request, reply) {

                await internals.wait(0);
                return reply(' ');
            };

            const pre4 = function (request, reply) {

                return reply('World');
            };

            const pre5 = function (request, reply) {

                return reply(request.pre.m2 + '!');
            };

            const handler = function (request, reply) {

                return reply(request.pre.m5);
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
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('Hello World!');
        });

        it('allows a single prerequisite', async () => {

            const pre = function (request, reply) {

                return reply('Hello');
            };

            const handler = function (request, reply) {

                return reply(request.pre.p);
            };

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        { method: pre, assign: 'p' }
                    ],
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('Hello');
        });

        it('allows an empty prerequisite array', async () => {

            const handler = function (request, reply) {

                return reply('Hello');
            };

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [],
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('Hello');
        });

        it('takes over response', async () => {

            const pre1 = function (request, reply) {

                return reply('Hello');
            };

            const pre2 = function (request, reply) {

                return reply(request.pre.m1 + request.pre.m3 + request.pre.m4);
            };

            const pre3 = async function (request, reply) {

                await internals.wait(0);
                return reply(' ').takeover();
            };

            const pre4 = function (request, reply) {

                return reply('World');
            };

            const pre5 = function (request, reply) {

                return reply(request.pre.m2 + '!');
            };

            const handler = function (request, reply) {

                return reply(request.pre.m5);
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
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(' ');
        });

        it('returns error if prerequisite returns error', async () => {

            const pre1 = function (request, reply) {

                return reply('Hello');
            };

            const pre2 = function (request, reply) {

                return reply(Boom.internal('boom'));
            };

            const handler = function (request, reply) {

                return reply(request.pre.m1);
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
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(500);
        });

        it('returns error if prerequisite returns promise, and handler throws an error', async () => {

            const pre1 = function (request, reply) {

                return reply('Hello');
            };

            const pre2 = function (request, reply) {

                return reply(Promise.resolve('world'));
            };

            const handler = function (request, reply) {

                throw new Error();
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
                    handler
                }
            });

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('internal, implementation, error');
            };

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(500);
        });

        it('passes wrapped object', async () => {

            const pre = function (request, reply) {

                return reply('Hello').code(444);
            };

            const handler = function (request, reply) {

                return reply(request.preResponses.p);
            };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        { method: pre, assign: 'p' }
                    ],
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(444);
        });

        it('returns 500 if prerequisite throws', async () => {

            const pre1 = function (request, reply) {

                return reply('Hello');
            };

            const pre2 = function (request, reply) {

                const a = null;
                a.b.c = 0;
            };

            const handler = function (request, reply) {

                return reply(request.pre.m1);
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
                    handler
                }
            });

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(500);
        });

        it('returns 500 if prerequisite loses domain binding', async () => {

            const pre1 = function (request, reply) {

                return Promise.resolve().then(() => {

                    reply('Hello');
                });
            };

            const pre2 = function (request, reply) {

                const a = null;
                a.b.c = 0;
            };

            const handler = function (request, reply) {

                return reply(request.pre.m1);
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
                    handler
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
                            method: function (request, reply) {

                                return reply(Boom.forbidden());
                            },
                            failAction: 'error'
                        }
                    ],
                    handler: function (request, reply) {

                        return reply('ok');
                    }
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
                            method: function (request, reply) {

                                return reply(Boom.forbidden());
                            },
                            failAction: 'ignore'
                        }
                    ],
                    handler: function (request, reply) {

                        return reply('ok');
                    }
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
                            method: function (request, reply) {

                                return reply(Boom.forbidden());
                            },
                            failAction: 'log'
                        }
                    ],
                    handler: function (request, reply) {

                        if (request.pre.before === request.preResponses.before &&
                            request.pre.before instanceof Error) {

                            return reply('ok');
                        }

                        return reply(new Error());
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
                        method: function (request, reply) {

                            return reply(this.x);
                        }, assign: 'x'
                    }],
                    handler: function (request, reply) {

                        return reply(request.pre.x);
                    },
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
                    handler: function (request, reply) {

                        return reply(Boom.forbidden());
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

                return function (request, reply) {

                    return reply(request.route.settings.app);
                };
            };

            const server = new Hapi.Server();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            const res = await server.inject('/');
            expect(res.result).to.equal({});
        });

        it('returns handler with object defaults', async () => {

            const handler = function (route, options) {

                return function (request, reply) {

                    return reply(request.route.settings.app);
                };
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

                return function (request, reply) {

                    return reply(request.route.settings.app);
                };
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

                return function (request, reply) {

                    return reply(request.route.settings.app);
                };
            };

            handler.defaults = 'invalid';

            const server = new Hapi.Server();
            expect(() => {

                server.handler('test', handler);
            }).to.throw('Handler defaults property must be an object or function');
        });
    });

    describe('invoke()', () => {

        it.skip('returns 500 on ext method exception (same tick)', async () => {

            const server = new Hapi.Server({ debug: false });

            const onRequest = function (request) {

                const a = null;
                a.b.c;
            };

            server.ext('onRequest', onRequest);

            const handler = function (request, reply) {

                return reply('neven gonna happen');
            };

            server.route({ method: 'GET', path: '/domain', handler });

            const res = await server.inject('/domain');
            expect(res.statusCode).to.equal(500);
        });
    });
});


internals.wait = function (timeout) {

    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
};
