'use strict';

// Load modules

const Boom = require('boom');
const Code = require('code');
const Hapi = require('..');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('CORS', () => {

    it('returns 404 on OPTIONS when cors disabled', async () => {

        const server = new Hapi.Server({ routes: { cors: false } });
        server.route({ method: 'GET', path: '/', handler: () => null });

        const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res.statusCode).to.equal(404);
    });

    it('returns OPTIONS response', async () => {

        const handler = function () {

            throw Boom.badRequest();
        };

        const server = new Hapi.Server({ routes: { cors: true } });
        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
    });

    it('returns OPTIONS response (server config)', async () => {

        const handler = function () {

            throw Boom.badRequest();
        };

        const server = new Hapi.Server({ routes: { cors: true } });
        server.route({ method: 'GET', path: '/x', handler });

        const res = await server.inject({ method: 'OPTIONS', url: '/x', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
    });

    it('returns headers on single route', async () => {


        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/a', handler: () => 'ok', config: { cors: true } });
        server.route({ method: 'GET', path: '/b', handler: () => 'ok' });

        const res1 = await server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res1.statusCode).to.equal(200);
        expect(res1.result).to.be.null();
        expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

        const res2 = await server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result.message).to.equal('CORS is disabled for this route');
        expect(res2.headers['access-control-allow-origin']).to.not.exist();
    });

    it('allows headers on multiple routes but not all', async () => {

        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/a', handler: () => 'ok', config: { cors: true } });
        server.route({ method: 'GET', path: '/b', handler: () => 'ok', config: { cors: true } });
        server.route({ method: 'GET', path: '/c', handler: () => 'ok' });

        const res1 = await server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res1.statusCode).to.equal(200);
        expect(res1.result).to.be.null();
        expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

        const res2 = await server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.be.null();
        expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');

        const res3 = await server.inject({ method: 'OPTIONS', url: '/c', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res3.statusCode).to.equal(200);
        expect(res3.result.message).to.equal('CORS is disabled for this route');
        expect(res3.headers['access-control-allow-origin']).to.not.exist();
    });

    it('allows same headers on multiple routes with same path', async () => {

        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/a', handler: () => 'ok', config: { cors: true } });
        server.route({ method: 'POST', path: '/a', handler: () => 'ok', config: { cors: true } });

        const res = await server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.be.null();
        expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
    });

    it('returns headers on single route (overrides defaults)', async () => {

        const server = new Hapi.Server({ routes: { cors: { origin: ['b'] } } });
        server.route({ method: 'GET', path: '/a', handler: () => 'ok', config: { cors: { origin: ['a'] } } });
        server.route({ method: 'GET', path: '/b', handler: () => 'ok' });

        const res1 = await server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'a', 'access-control-request-method': 'GET' } });
        expect(res1.statusCode).to.equal(200);
        expect(res1.result).to.be.null();
        expect(res1.headers['access-control-allow-origin']).to.equal('a');

        const res2 = await server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'b', 'access-control-request-method': 'GET' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.be.null();
        expect(res2.headers['access-control-allow-origin']).to.equal('b');
    });

    it('sets access-control-allow-credentials header', async () => {

        const server = new Hapi.Server({ routes: { cors: { credentials: true } } });
        server.route({ method: 'GET', path: '/', handler: () => null });

        const res = await server.inject({ url: '/', headers: { origin: 'http://example.com/' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(null);
        expect(res.headers['access-control-allow-credentials']).to.equal('true');
    });

    it('combines connection defaults with route config', async () => {

        const server = new Hapi.Server({ routes: { cors: { origin: ['http://example.com/'] } } });
        server.route({ method: 'GET', path: '/', handler: () => null, config: { cors: { credentials: true } } });

        const res1 = await server.inject({ url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res1.statusCode).to.equal(200);
        expect(res1.result).to.equal(null);
        expect(res1.headers['access-control-allow-credentials']).to.equal('true');

        const res2 = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
        expect(res2.statusCode).to.equal(200);
        expect(res2.result).to.equal(null);
        expect(res2.headers['access-control-allow-credentials']).to.equal('true');

        const res3 = await server.inject({ url: '/', headers: { origin: 'http://example.org/', 'access-control-request-method': 'GET' } });
        expect(res3.statusCode).to.equal(200);
        expect(res3.result).to.equal(null);
        expect(res3.headers['access-control-allow-credentials']).to.not.exist();

        const res4 = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.org/', 'access-control-request-method': 'GET' } });
        expect(res4.statusCode).to.equal(200);
        expect(res4.result).to.equal({ message: 'CORS error: Origin not allowed' });
        expect(res4.headers['access-control-allow-credentials']).to.not.exist();
        expect(res4.headers['access-control-allow-origin']).to.not.exist();
    });

    describe('headers()', () => {

        it('returns CORS origin (route level)', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok', config: { cors: true } });

            const res1 = await server.inject({ url: '/', headers: { origin: 'http://example.com/' } });
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.exist();
            expect(res1.result).to.equal('ok');
            expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

            const res2 = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.be.null();
            expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');
        });

        it('returns CORS origin (GET)', async () => {

            const server = new Hapi.Server({ routes: { cors: { origin: ['http://x.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({ url: '/', headers: { origin: 'http://x.example.com' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('ok');
            expect(res.headers['access-control-allow-origin']).to.equal('http://x.example.com');
        });

        it('returns CORS origin (OPTIONS)', async () => {

            const server = new Hapi.Server({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://test.example.com', 'access-control-request-method': 'GET' } });
            expect(res.statusCode).to.equal(200);
            expect(res.payload.length).to.equal(0);
            expect(res.headers['access-control-allow-origin']).to.equal('http://test.example.com');
        });

        it('merges CORS access-control-expose-headers header', async () => {

            const handler = (request, h) => {

                return h.response('ok').header('access-control-expose-headers', 'something');
            };

            const server = new Hapi.Server({ routes: { cors: { additionalExposedHeaders: ['xyz'] } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { origin: 'http://example.com/' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('ok');
            expect(res.headers['access-control-expose-headers']).to.equal('something,WWW-Authenticate,Server-Authorization,xyz');
        });

        it('returns no CORS headers when route CORS disabled', async () => {

            const server = new Hapi.Server({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok', config: { cors: false } });

            const res = await server.inject({ url: '/', headers: { origin: 'http://x.example.com' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('ok');
            expect(res.headers['access-control-allow-origin']).to.not.exist();
        });

        it('returns matching CORS origin', async () => {

            const handler = (request, h) => {

                return h.response('Tada').header('vary', 'x-test');
            };

            const server = new Hapi.Server({ compression: { minBytes: 1 }, routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { origin: 'http://www.example.com' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('Tada');
            expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
            expect(res.headers.vary).to.equal('x-test,origin,accept-encoding');
        });

        it('returns origin header when matching against *', async () => {

            const handler = (request, h) => {

                return h.response('Tada').header('vary', 'x-test');
            };

            const server = new Hapi.Server({ compression: { minBytes: 1 }, routes: { cors: { origin: ['*'] } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { origin: 'http://www.example.com' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('Tada');
            expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
            expect(res.headers.vary).to.equal('x-test,origin,accept-encoding');
        });

        it('returns matching CORS origin wildcard', async () => {

            const handler = (request, h) => {

                return h.response('Tada').header('vary', 'x-test');
            };

            const server = new Hapi.Server({ compression: { minBytes: 1 }, routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { origin: 'http://www.a.com' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('Tada');
            expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
            expect(res.headers.vary).to.equal('x-test,origin,accept-encoding');
        });

        it('returns matching CORS origin wildcard when more than one wildcard', async () => {

            const handler = (request, h) => {

                return h.response('Tada').header('vary', 'x-test', true);
            };

            const server = new Hapi.Server({ compression: { minBytes: 1 }, routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.b.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { origin: 'http://www.a.com' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('Tada');
            expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
            expect(res.headers.vary).to.equal('x-test,origin,accept-encoding');
        });

        it('does not set empty CORS expose headers', async () => {

            const server = new Hapi.Server({ routes: { cors: { exposedHeaders: [] } } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res1 = await server.inject({ url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
            expect(res1.statusCode).to.equal(200);
            expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');
            expect(res1.headers['access-control-expose-headers']).to.not.exist();

            const res2 = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');
            expect(res2.headers['access-control-expose-headers']).to.not.exist();
        });
    });

    describe('options()', () => {

        it('ignores OPTIONS route', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'OPTIONS',
                path: '/',
                handler: () => null
            });

            expect(server._core.router.special.options).to.not.exist();
        });
    });

    describe('handler()', () => {

        it('errors on missing origin header', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { 'access-control-request-method': 'GET' } });
            expect(res.statusCode).to.equal(404);
            expect(res.result.message).to.equal('CORS error: Missing Origin header');
        });

        it('errors on missing access-control-request-method header', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/' } });
            expect(res.statusCode).to.equal(404);
            expect(res.result.message).to.equal('CORS error: Missing Access-Control-Request-Method header');
        });

        it('errors on missing route', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });

            const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
            expect(res.statusCode).to.equal(404);
        });

        it('errors on mismatching origin header', async () => {

            const server = new Hapi.Server({ routes: { cors: { origin: ['a'] } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result.message).to.equal('CORS error: Origin not allowed');
        });

        it('matches allowed headers', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Authorization'
                }
            });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
        });

        it('matches allowed headers (case insensitive)', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'authorization'
                }
            });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
        });

        it('matches allowed headers (Origin explicit)', async () => {

            const server = new Hapi.Server({ routes: { cors: { additionalHeaders: ['Origin'] } } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Origin'
                }
            });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match,Origin');
            expect(res.headers['access-control-expose-headers']).to.equal('WWW-Authenticate,Server-Authorization');
        });

        it('matches allowed headers (Origin implicit)', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Origin'
                }
            });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
        });

        it('errors on disallowed headers', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const res = await server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'X'
                }
            });

            expect(res.statusCode).to.equal(200);
            expect(res.result.message).to.equal('CORS error: Some headers are not allowed');
        });

        it('allows credentials', async () => {

            const server = new Hapi.Server({ routes: { cors: { credentials: true } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const res = await server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-credentials']).to.equal('true');
        });

        it('correctly finds route when using vhost setting', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({
                method: 'POST',
                vhost: 'example.com',
                path: '/',
                handler: () => null
            });

            const res = await server.inject({ method: 'OPTIONS', url: 'http://example.com:4000/', headers: { origin: 'http://localhost', 'access-control-request-method': 'POST' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-methods']).to.equal('POST');
        });
    });

    describe('headers()', () => {

        it('skips CORS when missing origin header', async () => {

            const server = new Hapi.Server({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => 'ok'
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['access-control-allow-origin']).to.not.exist();
        });
    });
});
