// Load modules

var Lab = require('lab');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


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

            a.b.c;
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

    it('returns a user record using helper', function (done) {

        var server = new Hapi.Server();

        server.helper('user', function (id, next) {

            return next({ id: id, name: 'Bob' });
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

    it('returns a user name using multiple helpers', function (done) {

        var server = new Hapi.Server();

        server.helper('user', function (id, next) {

            return next({ id: id, name: 'Bob' });
        });

        server.helper('name', function (user, next) {

            return next(user.name);
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

    it('fails on bad helper name', function (done) {

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

        expect(test).to.throw('Unknown server helper method in prerequisite string');
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

        expect(test).to.throw('Invalid prerequisite string method syntax');
        done();
    });
});

