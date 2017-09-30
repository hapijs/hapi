'use strict';

// Load modules

const Code = require('code');
const Hapi = require('..');
const Joi = require('joi');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('security', () => {

    it('blocks response splitting through the request.create method', async () => {

        const server = new Hapi.Server();
        const handler = (request, responder) => responder.wrap('Moved').created('/item/' + request.payload.name);
        server.route({ method: 'POST', path: '/item', handler });

        const res = await server.inject({
            method: 'POST', url: '/item',
            payload: '{"name": "foobar\r\nContent-Length: \r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 19\r\n\r\n<html>Shazam</html>"}',
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).to.equal(400);
    });

    it('prevents xss with invalid content types', async () => {

        const server = new Hapi.Server();
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

        const server = new Hapi.Server();
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

        const server = new Hapi.Server();
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

    it('prevents xss in path validation response message', async () => {

        const server = new Hapi.Server();
        server.state('encoded', { encoding: 'iron' });

        server.route({
            method: 'GET', path: '/fail/{name}',
            handler: () => 'Success',
            config: {
                validate: { params: { name: Joi.number() } }
            }
        });

        const res = await server.inject({
            method: 'GET',
            url: '/fail/<script>'
        });

        expect(res.result.message).to.not.contain('<script>');
        expect(JSON.stringify(res.result.validation)).to.not.contain('<script>');
    });

    it('prevents xss in payload validation response message', async () => {

        const server = new Hapi.Server();
        server.route({
            method: 'POST', path: '/fail/payload',
            handler: () => 'Success',
            config: {
                validate: { payload: { name: Joi.number() } }
            }
        });

        const res = await server.inject({
            method: 'POST',
            url: '/fail/payload',
            payload: '{"<script></script>":"other"}',
            headers: { 'content-type': 'application/json' }
        });

        expect(res.result.message).to.not.contain('<script>');
        expect(JSON.stringify(res.result.validation)).to.not.contain('<script>');
    });

    it('prevents xss in query validation response message', async () => {

        const server = new Hapi.Server();
        server.route({
            method: 'GET', path: '/fail/query',
            handler: () => 'Success',
            config: {
                validate: { query: { name: Joi.string() } }
            }
        });

        const res = await server.inject({
            method: 'GET',
            url: '/fail/query?<script></script>=value'
        });

        expect(res.result.message).to.not.contain('<script>');
        expect(JSON.stringify(res.result.validation)).to.not.contain('<script>');
    });
});
