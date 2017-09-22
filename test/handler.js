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

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('handler', () => {

    describe('execute()', () => {

        it('returns 500 on handler exception (same tick)', (done) => {

            const server = new Hapi.Server({ debug: false });

            const handler = function (request) {

                const a = null;
                a.b.c;
            };

            server.route({ method: 'GET', path: '/domain', handler });

            server.inject('/domain', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it.skip('returns 500 on handler exception (promise inners)', { parallel: false }, (done) => {

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
            server.events.on('request-error', (request, err) => {

                expect(err.message).to.equal('Uncaught error: Cannot read property \'here\' of null');
                done();
            });

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('internal, implementation, error');
            };

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
            });
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

        it('binds handler to route bind object', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result).to.equal(item.x);
                done();
            });
        });

        it('invokes handler with right arguments', (done) => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                expect(arguments.length).to.equal(2);
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                done();
            });
        });

        it.skip('catches asynchronous exceptions in promise constructors via the standard \'protect\' mechanism', (done) => {

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

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result.error).to.equal('Internal Server Error');
                done();
            });
        });

        it('catches synchronous exceptions which lead to unhandled promise rejections when then promise is returned', (done) => {

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

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result.error).to.equal('Internal Server Error');
                done();
            });
        });

        it('catches unhandled promise rejections when a promise is returned', (done) => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return Promise.reject(new Error('This should be caught.'));
            };

            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result.error).to.equal('Internal Server Error');
                done();
            });
        });

        it('wraps unhandled promise rejections in an error if needed', (done) => {

            const server = new Hapi.Server({ debug: false });

            const handler = function (request, reply) {

                return Promise.reject('this should be wrapped in an error');
            };

            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result.error).to.equal('Internal Server Error');
                done();
            });
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

        it('allows a single prerequisite', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result).to.equal('Hello');
                done();
            });
        });

        it('allows an empty prerequisite array', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result).to.equal('Hello');
                done();
            });
        });

        it('takes over response', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result).to.equal(' ');
                done();
            });
        });

        it('returns error if prerequisite returns error', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result.statusCode).to.equal(500);
                done();
            });
        });

        it('returns error if prerequisite returns promise, and handler throws an error', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result.statusCode).to.equal(500);
                done();
            });
        });

        it('passes wrapped object', (done) => {

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

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(444);
                done();
            });
        });

        it('returns 500 if prerequisite throws', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result.statusCode).to.equal(500);
                done();
            });
        });

        it('returns 500 if prerequisite loses domain binding', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result.statusCode).to.equal(500);
                done();
            });
        });

        it('sets pre failAction to error', (done) => {

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

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('sets pre failAction to ignore', (done) => {

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

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('sets pre failAction to log', (done) => {

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

            server.events.on('request-internal', (request, event, tags) => {

                if (event.internal &&
                    tags.pre &&
                    tags.error) {

                    expect(event.data.assign).to.equal('before');
                    done();
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('binds pre to route bind object', (done) => {

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

            server.inject('/', (res) => {

                expect(res.result).to.equal(item.x);
                done();
            });
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

        it('returns handler without defaults', (done) => {

            const handler = function (route, options) {

                return function (request, reply) {

                    return reply(request.route.settings.app);
                };
            };

            const server = new Hapi.Server();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', (res) => {

                expect(res.result).to.equal({});
                done();
            });
        });

        it('returns handler with object defaults', (done) => {

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
            server.inject('/', (res) => {

                expect(res.result).to.equal({ x: 1 });
                done();
            });
        });

        it('returns handler with function defaults', (done) => {

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
            server.inject('/', (res) => {

                expect(res.result).to.equal({ x: 'get' });
                done();
            });
        });

        it('throws on handler with invalid defaults', (done) => {

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

            done();
        });
    });

    describe('invoke()', () => {

        it.skip('returns 500 on ext method exception (same tick)', (done) => {

            const server = new Hapi.Server({ debug: false });

            const onRequest = function (request, next) {

                const a = null;
                a.b.c;
            };

            server.ext('onRequest', onRequest);

            const handler = function (request, reply) {

                return reply('neven gonna happen');
            };

            server.route({ method: 'GET', path: '/domain', handler });

            server.inject('/domain', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });
});


internals.wait = function (timeout) {

    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
};
