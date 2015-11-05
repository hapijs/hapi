'use strict';

// Load modules

const Boom = require('boom');
const Code = require('code');
const Hapi = require('..');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('CORS', () => {

    it('returns 404 on OPTIONS when cors disabled', (done) => {

        const handler = function (request, reply) {

            return reply();
        };

        const server = new Hapi.Server();
        server.connection({ routes: { cors: false } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('returns OPTIONS response', (done) => {

        const handler = function (request, reply) {

            return reply(Boom.badRequest());
        };

        const server = new Hapi.Server();
        server.connection({ routes: { cors: true } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

            expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
            done();
        });
    });

    it('returns OPTIONS response (server config)', (done) => {

        const handler = function (request, reply) {

            return reply(Boom.badRequest());
        };

        const server = new Hapi.Server({ connections: { routes: { cors: true } } });
        server.connection();
        server.route({ method: 'GET', path: '/x', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/x', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

            expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
            done();
        });
    });

    it('returns headers on single route', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: true } });
        server.route({ method: 'GET', path: '/b', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res1) => {

            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.be.null();
            expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

            server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res2) => {

                expect(res2.statusCode).to.equal(200);
                expect(res2.result.message).to.equal('CORS is disabled for this route');
                expect(res2.headers['access-control-allow-origin']).to.not.exist();
                done();
            });
        });
    });

    it('allows headers on multiple routes but not all', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: true } });
        server.route({ method: 'GET', path: '/b', handler: handler, config: { cors: true } });
        server.route({ method: 'GET', path: '/c', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res1) => {

            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.be.null();
            expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

            server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res2) => {

                expect(res2.statusCode).to.equal(200);
                expect(res2.result).to.be.null();
                expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');

                server.inject({ method: 'OPTIONS', url: '/c', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res3) => {

                    expect(res3.statusCode).to.equal(200);
                    expect(res3.result.message).to.equal('CORS is disabled for this route');
                    expect(res3.headers['access-control-allow-origin']).to.not.exist();
                    done();
                });
            });
        });
    });

    it('allows same headers on multiple routes with same path', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: true } });
        server.route({ method: 'POST', path: '/a', handler: handler, config: { cors: true } });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.be.null();
            expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
            done();
        });
    });

    it('returns headers on single route (overrides defaults)', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const server = new Hapi.Server();
        server.connection({ routes: { cors: { origin: ['b'] } } });
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: { origin: ['a'] } } });
        server.route({ method: 'GET', path: '/b', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'a', 'access-control-request-method': 'GET' } }, (res1) => {

            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.be.null();
            expect(res1.headers['access-control-allow-origin']).to.equal('a');

            server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'b', 'access-control-request-method': 'GET' } }, (res2) => {

                expect(res2.statusCode).to.equal(200);
                expect(res2.result).to.be.null();
                expect(res2.headers['access-control-allow-origin']).to.equal('b');
                done();
            });
        });
    });

    it('sets access-control-allow-credentials header', (done) => {

        const handler = function (request, reply) {

            return reply();
        };

        const server = new Hapi.Server();
        server.connection({ routes: { cors: { credentials: true } } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { origin: 'http://example.com/' } }, (res) => {

            expect(res.result).to.equal(null);
            expect(res.headers['access-control-allow-credentials']).to.equal('true');
            done();
        });
    });

    describe('headers()', () => {

        it('returns CORS origin (route level)', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler, config: { cors: true } });

            server.inject({ url: '/', headers: { origin: 'http://example.com/' } }, (res1) => {

                expect(res1.result).to.exist();
                expect(res1.result).to.equal('ok');
                expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

                server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res2) => {

                    expect(res2.result).to.be.null();
                    expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');
                    done();
                });
            });
        });

        it('returns CORS origin (GET)', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://x.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.equal('http://x.example.com');
                done();
            });
        });

        it('returns CORS origin (OPTIONS)', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://test.example.com', 'access-control-request-method': 'GET' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.payload.length).to.equal(0);
                expect(res.headers['access-control-allow-origin']).to.equal('http://test.example.com');
                done();
            });
        });

        it('merges CORS access-control-expose-headers header', (done) => {

            const handler = function (request, reply) {

                return reply('ok').header('access-control-expose-headers', 'something');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { additionalExposedHeaders: ['xyz'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://example.com/' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-expose-headers']).to.equal('something,WWW-Authenticate,Server-Authorization,xyz');
                done();
            });
        });

        it('returns no CORS headers when route CORS disabled', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler, config: { cors: false } });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.not.exist();
                done();
            });
        });

        it('returns matching CORS origin', (done) => {

            const handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.example.com' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns origin header when matching against *', (done) => {

            const handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['*'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.example.com' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns matching CORS origin wildcard', (done) => {

            const handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.a.com' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns matching CORS origin wildcard when more than one wildcard', (done) => {

            const handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test', true);
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.b.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.a.com' } }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('does not set empty CORS expose headers', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { exposedHeaders: [] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res1) => {

                expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');
                expect(res1.headers['access-control-expose-headers']).to.not.exist();

                server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res2) => {

                    expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');
                    expect(res2.headers['access-control-expose-headers']).to.not.exist();
                    done();
                });
            });
        });
    });

    describe('options()', () => {

        it('ignores OPTIONS route', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'OPTIONS',
                path: '/',
                handler: function (request, reply) { }
            });

            expect(server.connections[0]._router.special.options).to.not.exist();
            done();
        });
    });

    describe('handler()', () => {

        it('errors on missing origin header', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { 'access-control-request-method': 'GET' } }, (res) => {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('CORS error: Missing Origin header');
                done();
            });
        });

        it('errors on missing access-control-request-method header', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/' } }, (res) => {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('CORS error: Missing Access-Control-Request-Method header');
                done();
            });
        });

        it('errors on missing route', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('errors on mismatching origin header', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['a'] } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result.message).to.equal('CORS error: Origin not allowed');
                done();
            });
        });

        it('matches allowed headers', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Authorization'
                }
            }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
                done();
            });
        });

        it('matches allowed headers (case insensitive)', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'authorization'
                }
            }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
                done();
            });
        });

        it('matches allowed headers (Origin explicit)', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { additionalHeaders: ['Origin'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Origin'
                }
            }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match,Origin');
                done();
            });
        });

        it('matches allowed headers (Origin implicit)', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Origin'
                }
            }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
                done();
            });
        });

        it('errors on disallowed headers', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'X'
                }
            }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result.message).to.equal('CORS error: Some headers are not allowed');
                done();
            });
        });

        it('allows credentials', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: { credentials: true } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-credentials']).to.equal('true');
                done();
            });
        });

        it('correctly finds route when using vhost setting', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'POST',
                vhost: 'example.com',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: 'http://example.com:4000/', headers: { origin: 'http://localhost', 'access-control-request-method': 'POST' } }, (res) => {


                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-methods']).to.equal('POST');
                done();
            });
        });
    });

    describe('headers()', () => {

        it('skips CORS when missing origin header', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('ok');
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-origin']).to.not.exist();
                done();
            });
        });
    });
});
