'use strict';

const Code = require('@hapi/code');
const Hapi = require('..');
const Lab = require('@hapi/lab');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('security', () => {

    it('handles missing routes', async () => {

        const server = Hapi.server({ port: 8080, routes: { security: { xframe: true } } });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(404);
        expect(res.headers['x-frame-options']).to.exist();
    });

    it('blocks response splitting through the request.create method', async () => {

        const server = Hapi.server();
        const handler = (request, h) => h.response('Moved').created('/item/' + request.payload.name);
        server.route({ method: 'POST', path: '/item', handler });

        const res = await server.inject({
            method: 'POST', url: '/item',
            payload: '{"name": "foobar\r\nContent-Length: \r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 19\r\n\r\n<html>Shazam</html>"}',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).to.equal(400);
    });

    it('prevents xss with invalid content types', async () => {

        const server = Hapi.server();
        server.state('encoded', { encoding: 'iron' });
        server.route({
            method: 'POST', path: '/',
            handler: () => 'Success'
        });

        const res = await server.inject({
            method: 'POST',
            url: '/',
            payload: '{"something":"something"}',
            headers: { 'content-type': '<script>alert(1)</script>;' }
        });

        expect(res.result.message).to.not.contain('script');
    });

    it('prevents xss with invalid cookie values in the request', async () => {

        const server = Hapi.server();
        server.state('encoded', { encoding: 'iron' });
        server.route({
            method: 'POST', path: '/',
            handler: () => 'Success'
        });

        const res = await server.inject({
            method: 'POST',
            url: '/',
            payload: '{"something":"something"}',
            headers: { cookie: 'encoded="<script></script>";' }
        });

        expect(res.result.message).to.not.contain('<script>');
    });

    it('prevents xss with invalid cookie name in the request', async () => {

        const server = Hapi.server();
        server.state('encoded', { encoding: 'iron' });
        server.route({
            method: 'POST', path: '/',
            handler: () => 'Success'
        });

        const res = await server.inject({
            method: 'POST',
            url: '/',
            payload: '{"something":"something"}',
            headers: { cookie: '<script></script>=value;' }
        });

        expect(res.result.message).to.not.contain('<script>');
    });
});
