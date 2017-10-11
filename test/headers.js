'use strict';

// Load modules

const Boom = require('boom');
const CatboxMemory = require('catbox-memory');
const Code = require('code');
const Hapi = require('..');
const Inert = require('inert');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Headers', () => {

    describe('cache()', () => {

        it('sets max-age value (method and route)', async () => {

            const server = new Hapi.Server();

            const method = function (id) {

                return {
                    'id': 'fa0dbda9b1b',
                    'name': 'John Doe'
                };
            };

            server.method('profile', method, { cache: { expiresIn: 120000, generateTimeout: 10 } });

            const profileHandler = (request) => {

                return server.methods.profile(0);
            };

            server.route({ method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } });
            await server.start();

            const res = await server.inject('/profile');
            expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
            await server.stop();
        });

        it('sets max-age value (expiresAt)', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: () => null, cache: { expiresAt: '10:00' } } });
            await server.start();

            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.match(/^max-age=\d+, must-revalidate$/);
            await server.stop();
        });

        it('returns no-cache on error', async () => {

            const handler = () => {

                throw Boom.badRequest();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler, cache: { expiresIn: 120000 } } });
            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('no-cache');
        });

        it('returns custom value on error', async () => {

            const handler = () => {

                throw Boom.badRequest();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler, cache: { otherwise: 'no-store' } } });
            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('no-store');
        });

        it('sets cache-control on error with status override', async () => {

            const handler = () => {

                throw Boom.badRequest();
            };

            const server = new Hapi.Server({ routes: { cache: { statuses: [200, 400] } } });
            server.route({ method: 'GET', path: '/', config: { handler, cache: { expiresIn: 120000 } } });
            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate');
        });

        it('does not return max-age value when route is not cached', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/item2', config: { handler: () => ({ 'id': '55cf687663', 'name': 'Active Items' }) } });
            const res = await server.inject('/item2');
            expect(res.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
        });

        it('caches using non default cache', async () => {

            const server = new Hapi.Server({ cache: { name: 'primary', engine: CatboxMemory } });
            const defaults = server.cache({ segment: 'a', expiresIn: 2000 });
            const primary = server.cache({ segment: 'a', expiresIn: 2000, cache: 'primary' });

            await server.start();

            await defaults.set('b', 1);
            await primary.set('b', 2);
            const { value: value1 } = await defaults.get('b');
            expect(value1).to.equal(1);

            const { cached: cached2 } = await primary.get('b');
            expect(cached2.item).to.equal(2);

            await server.stop();
        });

        it('leaves existing cache-control header', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('text').code(400).header('cache-control', 'some value') });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(400);
            expect(res.headers['cache-control']).to.equal('some value');
        });

        it('sets cache-control header from ttl without policy', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('text').ttl(10000) });

            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('max-age=10, must-revalidate');
        });

        it('sets cache-control header from ttl with disabled policy', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { cache: false, handler: (request, h) => h.response('text').ttl(10000) } });

            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('max-age=10, must-revalidate');
        });

        it('leaves existing cache-control header (ttl)', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('text').ttl(1000).header('cache-control', 'none') });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('none');
        });

        it('includes caching header with 304', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' }, config: { cache: { expiresIn: 60000 } } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['cache-control']).to.equal('max-age=60, must-revalidate');
        });

        it('forbids caching on 304 if 200 is not included', async () => {

            const server = new Hapi.Server({ routes: { cache: { statuses: [400] } } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' }, config: { cache: { expiresIn: 60000 } } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['cache-control']).to.equal('no-cache');
        });
    });

    describe('security()', () => {

        it('does not set security headers by default', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.not.exist();
            expect(res.headers['x-frame-options']).to.not.exist();
            expect(res.headers['x-xss-protection']).to.not.exist();
            expect(res.headers['x-download-options']).to.not.exist();
            expect(res.headers['x-content-type-options']).to.not.exist();
        });

        it('returns default security headers when security is true', async () => {

            const server = new Hapi.Server({ routes: { security: true } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
            expect(res.headers['x-frame-options']).to.equal('DENY');
            expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('does not set default security headers when the route sets security false', async () => {

            const server = new Hapi.Server({ routes: { security: true } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test', config: { security: false } });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.not.exist();
            expect(res.headers['x-frame-options']).to.not.exist();
            expect(res.headers['x-xss-protection']).to.not.exist();
            expect(res.headers['x-download-options']).to.not.exist();
            expect(res.headers['x-content-type-options']).to.not.exist();
        });

        it('does not return hsts header when secuirty.hsts is false', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: false } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.not.exist();
            expect(res.headers['x-frame-options']).to.equal('DENY');
            expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('returns only default hsts header when security.hsts is true', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: true } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
        });

        it('returns correct hsts header when security.hsts is a number', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: 123456789 } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
        });

        it('returns correct hsts header when security.hsts is an object', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: { maxAge: 123456789, includeSubDomains: true } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=123456789; includeSubDomains');
        });

        it('returns the correct hsts header when security.hsts is an object only sepcifying maxAge', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: { maxAge: 123456789 } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubdomains', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: { includeSubdomains: true } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains');
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubDomains', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: { includeSubDomains: true } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains');
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubDomains and preload', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: { includeSubDomains: true, preload: true } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains; preload');
        });

        it('does not return the xframe header whe security.xframe is false', async () => {

            const server = new Hapi.Server({ routes: { security: { xframe: false } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.not.exist();
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
            expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('returns only default xframe header when security.xframe is true', async () => {

            const server = new Hapi.Server({ routes: { security: { xframe: true } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('DENY');
        });

        it('returns correct xframe header when security.xframe is a string', async () => {

            const server = new Hapi.Server({ routes: { security: { xframe: 'sameorigin' } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
        });

        it('returns correct xframe header when security.xframe is an object', async () => {

            const server = new Hapi.Server({ routes: { security: { xframe: { rule: 'allow-from', source: 'http://example.com' } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('ALLOW-FROM http://example.com');
        });

        it('returns correct xframe header when security.xframe is an object', async () => {

            const server = new Hapi.Server({ routes: { security: { xframe: { rule: 'deny' } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('DENY');
        });

        it('returns sameorigin xframe header when rule is allow-from but source is unspecified', async () => {

            const server = new Hapi.Server({ routes: { security: { xframe: { rule: 'allow-from' } } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });

            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
        });

        it('does not set x-download-options if noOpen is false', async () => {

            const server = new Hapi.Server({ routes: { security: { noOpen: false } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-download-options']).to.not.exist();
        });

        it('does not set x-content-type-options if noSniff is false', async () => {

            const server = new Hapi.Server({ routes: { security: { noSniff: false } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-content-type-options']).to.not.exist();
        });

        it('does not set the x-xss-protection header when security.xss is false', async () => {

            const server = new Hapi.Server({ routes: { security: { xss: false } } });
            server.route({ method: 'GET', path: '/', handler: () => 'Test' });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-xss-protection']).to.not.exist();
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
            expect(res.headers['x-frame-options']).to.equal('DENY');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });
    });

    describe('content()', () => {

        it('does not modify content-type header when charset manually set', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('text').type('text/plain; charset=ISO-8859-1') });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/plain; charset=ISO-8859-1');
        });

        it('does not modify content-type header when charset is unset', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('text').type('text/plain').charset() });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/plain');
        });

        it('does not modify content-type header when charset is unset (default type)', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('text').charset() });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html');
        });
    });
});
