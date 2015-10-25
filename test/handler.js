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

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('handler', () => {

    describe('execute()', () => {

        it('returns 500 on handler exception (same tick)', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            const handler = function (request) {

                a.b.c;
            };

            server.route({ method: 'GET', path: '/domain', handler: handler });

            server.inject('/domain', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('returns 500 on handler exception (next tick)', { parallel: false }, (done) => {

            const handler = function (request) {

                setImmediate(() => {

                    not.here;
                });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.on('request-error', (request, err) => {

                expect(err.message).to.equal('Uncaught error: not is not defined');
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
    });

    describe('handler()', () => {

        it('binds handler to route bind object', (done) => {

            const item = { x: 123 };

            const server = new Hapi.Server();
            server.connection();
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
            server.connection();

            const handler = function (request, reply) {

                expect(arguments.length).to.equal(2);
                expect(reply.send).to.not.exist();
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                done();
            });
        });
    });

    describe('register()', () => {

        it('returns a file', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } } });
            const handler = function (request, reply) {

                return reply.file('../package.json').code(499);
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', (res) => {

                expect(res.statusCode).to.equal(499);
                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist();
                expect(res.headers['content-disposition']).to.not.exist();
                done();
            });
        });

        it('returns a view', (done) => {

            const server = new Hapi.Server();
            server.register(Vision, Hoek.ignore);
            server.connection();

            server.views({
                engines: { 'html': Handlebars },
                relativeTo: Path.join(__dirname, '/templates/plugin')
            });

            const handler = function (request, reply) {

                return reply.view('test', { message: 'steve' });
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('<h1>steve</h1>');
                done();
            });
        });
    });

    describe('prerequisites()', () => {

        it('shows the complete prerequisite pipeline in the response', (done) => {

            const pre1 = function (request, reply) {

                return reply('Hello').code(444);
            };

            const pre2 = function (request, reply) {

                return reply(request.pre.m1 + request.pre.m3 + request.pre.m4);
            };

            const pre3 = function (request, reply) {

                process.nextTick(() => {

                    return reply(' ');
                });
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
            server.connection();
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
                    handler: handler
                }
            });

            server.inject('/', (res) => {

                expect(res.result).to.equal('Hello World!');
                done();
            });
        });

        it('allows a single prerequisite', (done) => {

            const pre = function (request, reply) {

                return reply('Hello');
            };

            const handler = function (request, reply) {

                return reply(request.pre.p);
            };

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        { method: pre, assign: 'p' }
                    ],
                    handler: handler
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
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [],
                    handler: handler
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

            const pre3 = function (request, reply) {

                process.nextTick(() => {

                    return reply(' ').takeover();
                });
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
            server.connection();
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
                    handler: handler
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
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        [{ method: pre1, assign: 'm1' }],
                        { method: pre2, assign: 'm2' }
                    ],
                    handler: handler
                }
            });

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
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        { method: pre, assign: 'p' }
                    ],
                    handler: handler
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

                a.b.c = 0;
            };

            const handler = function (request, reply) {

                return reply(request.pre.m1);
            };


            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        [{ method: pre1, assign: 'm1' }],
                        { method: pre2, assign: 'm2' }
                    ],
                    handler: handler
                }
            });

            server.inject('/', (res) => {

                expect(res.result.statusCode).to.equal(500);
                done();
            });
        });

        it('returns a user record using server method', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user', method);

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user(params.id)'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.user);
                    }
                }
            });

            server.inject('/user/5', (res) => {

                expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
                done();
            });
        });

        it('returns a user record using server method (nested method name)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user.get', method);

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user.get(params.id)'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre['user.get']);
                    }
                }
            });

            server.inject('/user/5', (res) => {

                expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
                done();
            });
        });

        it('returns a user record using server method in object', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user', method);

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        {
                            method: 'user(params.id)',
                            assign: 'steve'
                        }
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.steve);
                    }
                }
            });

            server.inject('/user/5', (res) => {

                expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
                done();
            });
        });

        it('returns a user name using multiple server methods', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const user = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user', user);

            const name = function (obj, next) {

                return next(null, obj.name);
            };

            server.method('name', name);

            server.route({
                method: 'GET',
                path: '/user/{id}/name',
                config: {
                    pre: [
                        'user(params.id)',
                        'name(pre.user)'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.name);
                    }
                }
            });

            server.inject('/user/5/name', (res) => {

                expect(res.result).to.equal('Bob');
                done();
            });
        });

        it('returns a user record using server method with trailing space', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user', method);

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user(params.id )'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.user);
                    }
                }
            });

            server.inject('/user/5', (res) => {

                expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
                done();
            });
        });

        it('returns a user record using server method with leading space', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user', method);

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user( params.id)'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.user);
                    }
                }
            });

            server.inject('/user/5', (res) => {

                expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
                done();
            });
        });

        it('returns a user record using server method with zero args', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (next) {

                return next(null, { name: 'Bob' });
            };

            server.method('user', method);

            server.route({
                method: 'GET',
                path: '/user',
                config: {
                    pre: [
                        'user()'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.user);
                    }
                }
            });

            server.inject('/user', (res) => {

                expect(res.result).to.deep.equal({ name: 'Bob' });
                done();
            });
        });

        it('returns a user record using server method with no args', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (request, next) {

                return next(null, { id: request.params.id, name: 'Bob' });
            };

            server.method('user', method);

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.user);
                    }
                }
            });

            server.inject('/user/5', (res) => {

                expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
                done();
            });
        });

        it('returns a user record using server method with nested name', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (next) {

                return next(null, { name: 'Bob' });
            };

            server.method('user.get', method);

            server.route({
                method: 'GET',
                path: '/user',
                config: {
                    pre: [
                        'user.get()'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre['user.get']);
                    }
                }
            });

            server.inject('/user', (res) => {

                expect(res.result).to.deep.equal({ name: 'Bob' });
                done();
            });
        });

        it('fails on bad method name', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const test = function () {

                server.route({
                    method: 'GET',
                    path: '/x/{id}',
                    config: {
                        pre: [
                            'xuser(params.id)'
                        ],
                        handler: function (request, reply) {

                            return reply(request.pre.user);
                        }
                    }
                });
            };

            expect(test).to.throw('Unknown server method in string notation: xuser(params.id)');
            done();
        });

        it('fails on bad method syntax name', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const test = function () {

                server.route({
                    method: 'GET',
                    path: '/x/{id}',
                    config: {
                        pre: [
                            'userparams.id)'
                        ],
                        handler: function (request, reply) {

                            return reply(request.pre.user);
                        }
                    }
                });
            };

            expect(test).to.throw('Invalid server method string notation: userparams.id)');
            done();
        });

        it('sets pre failAction to error', (done) => {

            const server = new Hapi.Server();
            server.connection();
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
            server.connection();
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
            server.connection();
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

                        return reply('ok');
                    }
                }
            });

            let log = null;
            server.on('request-internal', (request, event, tags) => {

                if (event.internal &&
                    tags.pre &&
                    tags.error) {

                    log = event.data.assign;
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(log).to.equal('before');
                done();
            });
        });

        it('binds pre to route bind object', (done) => {

            const item = { x: 123 };

            const server = new Hapi.Server();
            server.connection();
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

        it('logs boom error instance as data if handler returns boom error', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    handler: function (request, reply) {

                        return reply(Boom.forbidden());
                    }
                }
            });

            let log = null;
            server.on('request-internal', (request, event, tags) => {

                if (event.internal &&
                    tags.handler &&
                    tags.error) {

                    log = event.data;
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(403);
                expect(log.data.isBoom).to.equal(true);
                expect(log.data.output.statusCode).to.equal(403);
                expect(log.data.message).to.equal('Forbidden');
                done();
            });
        });

        it('logs server method using string notation when cache enabled', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob' });
            };

            server.method('user', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user(params.id)'
                    ],
                    handler: function (request, reply) {

                        return reply(request.getLog('method'));
                    }
                }
            });

            server.initialize((err) => {

                expect(err).to.not.exist();

                server.inject('/user/5', (res) => {

                    expect(res.result[0].tags).to.deep.equal(['pre', 'method', 'user']);
                    expect(res.result[0].internal).to.equal(true);
                    expect(res.result[0].data.msec).to.exist();
                    done();
                });
            });
        });

        it('uses server method with cache via string notation', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let gen = 0;
            const method = function (id, next) {

                return next(null, { id: id, name: 'Bob', gen: gen++ });
            };

            server.method('user', method, { cache: { expiresIn: 1000, generateTimeout: 10 } });

            server.route({
                method: 'GET',
                path: '/user/{id}',
                config: {
                    pre: [
                        'user(params.id)'
                    ],
                    handler: function (request, reply) {

                        return reply(request.pre.user.gen);
                    }
                }
            });

            server.initialize((err) => {

                expect(err).to.not.exist();

                server.inject('/user/5', (res1) => {

                    expect(res1.result).to.equal(0);

                    server.inject('/user/5', (res2) => {

                        expect(res2.result).to.equal(0);
                        done();
                    });
                });
            });
        });
    });

    describe('fromString()', () => {

        it('uses string handler', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (request, reply) {

                return reply(null, request.params.x + request.params.y).code(299);
            };

            server.method('handler.get', method);

            server.route({ method: 'GET', path: '/{x}/{y}', handler: 'handler.get' });
            server.inject('/a/b', (res) => {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('ab');
                done();
            });
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
            server.connection();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', (res) => {

                expect(res.result).to.deep.equal({});
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
            server.connection();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', (res) => {

                expect(res.result).to.deep.equal({ x: 1 });
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
            server.connection();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', (res) => {

                expect(res.result).to.deep.equal({ x: 'get' });
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
            server.connection();
            expect(() => {

                server.handler('test', handler);
            }).to.throw('Handler defaults property must be an object or function');

            done();
        });
    });

    describe('invoke()', () => {

        it('returns 500 on ext method exception (same tick)', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            const onRequest = function (request, next) {

                a.b.c;
            };

            server.ext('onRequest', onRequest);

            const handler = function (request, reply) {

                return reply('neven gonna happen');
            };

            server.route({ method: 'GET', path: '/domain', handler: handler });

            server.inject('/domain', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });
});
