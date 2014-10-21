// Load modules

var Code = require('code');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Handler', function () {

    it('shows the complete prerequisite pipeline in the response', function (done) {

        var pre1 = function (request, reply) {

            reply('Hello').code(444);
            reply();    // Ignored
        };

        var pre2 = function (request, reply) {

            reply(request.pre.m1 + request.pre.m3 + request.pre.m4);
        };

        var pre3 = function (request, reply) {

            process.nextTick(function () {

                reply(' ');
            });
        };

        var pre4 = function (request, reply) {

            reply('World');
        };

        var pre5 = function (request, reply) {

            reply(request.pre.m2 + '!');
        };

        var handler = function (request, reply) {

            reply(request.pre.m5);
        };

        var server = new Hapi.Server();
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

        server.inject('/', function (res) {

            expect(res.result).to.equal('Hello World!');
            done();
        });
    });

    it('shows a single prerequisite when only one is used', function (done) {

        var pre = function (request, reply) {

            reply('Hello');
        };

        var handler = function (request, reply) {

            reply(request.pre.p);
        };

        var server = new Hapi.Server();

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

        server.inject('/', function (res) {

            expect(res.result).to.equal('Hello');
            done();
        });
    });

    it('does not explode if an empty prerequisite array is specified', function (done) {

        var handler = function (request, reply) {

            reply('Hello');
        };

        var server = new Hapi.Server();

        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [],
                handler: handler
            }
        });

        server.inject('/', function (res) {

            expect(res.result).to.equal('Hello');
            done();
        });
    });

    it('takes over response', function (done) {

        var pre1 = function (request, reply) {

            reply('Hello');
        };

        var pre2 = function (request, reply) {

            reply(request.pre.m1 + request.pre.m3 + request.pre.m4);
        };

        var pre3 = function (request, reply) {

            process.nextTick(function () {

                reply(' ').takeover();
            });
        };

        var pre4 = function (request, reply) {

            reply('World');
        };

        var pre5 = function (request, reply) {

            reply(request.pre.m2 + '!');
        };

        var handler = function (request, reply) {

            reply(request.pre.m5);
        };

        var server = new Hapi.Server();
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

        server.inject('/', function (res) {

            expect(res.result).to.equal(' ');
            done();
        });
    });

    it('returns error if prerequisite returns error', function (done) {

        var pre1 = function (request, reply) {

            reply('Hello');
        };

        var pre2 = function (request, reply) {

            reply(Hapi.error.internal('boom'));
        };

        var handler = function (request, reply) {

            reply(request.pre.m1);
        };

        var server = new Hapi.Server();
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

        server.inject('/', function (res) {

            expect(res.result.statusCode).to.equal(500);
            done();
        });
    });

    it('passes wrapped object', function (done) {

        var pre = function (request, reply) {

            reply('Hello').code(444);
        };

        var handler = function (request, reply) {

            reply(request.responses.p);
        };

        var server = new Hapi.Server();
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

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(444);
            done();
        });
    });

    it('returns 500 if prerequisite throws', function (done) {

        var pre1 = function (request, reply) {

            reply('Hello');
        };

        var pre2 = function (request, reply) {

            a.b.c = 0;
        };

        var handler = function (request, reply) {

            reply(request.pre.m1);
        };


        var server = new Hapi.Server({ debug: false });
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

        server.inject('/', function (res) {

            expect(res.result.statusCode).to.equal(500);
            done();
        });
    });

    it('returns a user record using server method', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (id, next) {

            return next(null, { id: id, name: 'Bob' });
        });

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

        server.inject('/user/5', function (res) {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('returns a user record using server method in object', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (id, next) {

            return next(null, { id: id, name: 'Bob' });
        });

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

        server.inject('/user/5', function (res) {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('returns a user name using multiple server methods', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (id, next) {

            return next(null, { id: id, name: 'Bob' });
        });

        server.method('name', function (user, next) {

            return next(null, user.name);
        });

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

        server.inject('/user/5/name', function (res) {

            expect(res.result).to.equal('Bob');
            done();
        });
    });

    it('returns a user record using server method with trailing space', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (id, next) {

            return next(null, { id: id, name: 'Bob' });
        });

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

        server.inject('/user/5', function (res) {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('returns a user record using server method with leading space', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (id, next) {

            return next(null, { id: id, name: 'Bob' });
        });

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

        server.inject('/user/5', function (res) {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('returns a user record using server method with zero args', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (next) {

            return next(null, { name: 'Bob' });
        });

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

        server.inject('/user', function (res) {

            expect(res.result).to.deep.equal({ name: 'Bob' });
            done();
        });
    });

    it('returns a user record using server method with no args', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (request, next) {

            return next(null, { id: request.params.id, name: 'Bob' });
        });

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

        server.inject('/user/5', function (res) {

            expect(res.result).to.deep.equal({ id: '5', name: 'Bob' });
            done();
        });
    });

    it('returns a user record using server method with nested name', function (done) {

        var server = new Hapi.Server();

        server.method('user.get', function (next) {

            return next(null, { name: 'Bob' });
        });

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

        server.inject('/user', function (res) {

            expect(res.result).to.deep.equal({ name: 'Bob' });
            done();
        });
    });

    it('fails on bad method name', function (done) {

        var server = new Hapi.Server();
        var test = function () {

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

    it('fails on bad method syntax name', function (done) {

        var server = new Hapi.Server();
        var test = function () {

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

    it('sets pre failAction to error', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [
                    {
                        method: function (request, reply) {

                            reply(Hapi.error.forbidden());
                        },
                        failAction: 'error'
                    }
                ],
                handler: function (request, reply) {

                    reply('ok');
                }
            }
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('sets pre failAction to ignore', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [
                    {
                        method: function (request, reply) {

                            reply(Hapi.error.forbidden());
                        },
                        failAction: 'ignore'
                    }
                ],
                handler: function (request, reply) {

                    reply('ok');
                }
            }
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('sets pre failAction to log', function (done) {

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [
                    {
                        assign: 'before',
                        method: function (request, reply) {

                            reply(Hapi.error.forbidden());
                        },
                        failAction: 'log'
                    }
                ],
                handler: function (request, reply) {

                    reply('ok');
                }
            }
        });

        var log = null;
        server.on('request', function (request, event, tags) {

            if (tags.hapi && tags.pre && tags.error) {
                log = event.data.assign;
            }
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(log).to.equal('before');
            done();
        });
    });

    it('uses string handler', function (done) {

        var server = new Hapi.Server();
        server.method('handler.get', function (request, next) {

            return next(null, request.params.x + request.params.y);
        });

        server.route({ method: 'GET', path: '/{x}/{y}', handler: 'handler.get' });
        server.inject('/a/b', function (res) {

            expect(res.result).to.equal('ab');
            done();
        });
    });

    it('binds handler to route bind object', function (done) {

        var item = { x: 123 };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', config: { handler: function (request, reply) { reply(this.x); }, bind: item } });

        server.inject('/', function (res) {

            expect(res.result).to.equal(item.x);
            done();
        });
    });

    it('binds pre to route bind object', function (done) {

        var item = { x: 123 };

        var server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [{ method: function (request, reply) { reply(this.x); }, assign: 'x' }],
                handler: function (request, reply) { reply(request.pre.x); },
                bind: item
            }
        });

        server.inject('/', function (res) {

            expect(res.result).to.equal(item.x);
            done();
        });
    });

    it('logs server method using string notation', function (done) {

        var server = new Hapi.Server();

        server.method('user', function (id, next) {

            return next(null, { id: id, name: 'Bob' });
        });

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

        server.inject('/user/5', function (res) {

            expect(res.result[0].tags).to.deep.equal(['hapi', 'pre', 'method', 'user']);
            expect(res.result[0].data.msec).to.exist();
            done();
        });
    });

    describe('#defaults', function () {

        it('returns handler without defaults', function (done) {

            var handler = function (route, options) {

                return function (request, reply) {

                    return reply(request.route.app);
                };
            };

            var server = new Hapi.Server();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', function (res) {

                expect(res.result).to.deep.equal({});
                done();
            });
        });

        it('returns handler with object defaults', function (done) {

            var handler = function (route, options) {

                return function (request, reply) {

                    return reply(request.route.app);
                };
            };

            handler.defaults = {
                app: {
                    x: 1
                }
            };

            var server = new Hapi.Server();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', function (res) {

                expect(res.result).to.deep.equal({ x: 1 });
                done();
            });
        });

        it('returns handler with function defaults', function (done) {

            var handler = function (route, options) {

                return function (request, reply) {

                    return reply(request.route.app);
                };
            };

            handler.defaults = function (method) {
                return {
                    app: {
                        x: method
                    }
                };
            };

            var server = new Hapi.Server();
            server.handler('test', handler);
            server.route({ method: 'get', path: '/', handler: { test: 'value' } });
            server.inject('/', function (res) {

                expect(res.result).to.deep.equal({ x: 'get' });
                done();
            });
        });

        it('throws on handler with invalid defaults', function (done) {

            var handler = function (route, options) {

                return function (request, reply) {

                    return reply(request.route.app);
                };
            };

            handler.defaults = 'invalid';

            var server = new Hapi.Server();
            expect(function () {

                server.handler('test', handler);
            }).to.throw('Handler defaults property must be an object or function');

            done();
        });
    });
});
