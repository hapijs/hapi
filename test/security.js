'use strict';

// Load modules

const Code = require('code');
const Hapi = require('..');
const Joi = require('joi');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('security', () => {

    it('blocks response splitting through the request.create method', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const createItemHandler = function (request, reply) {

            return reply('Moved').created('/item/' + request.payload.name);
        };

        server.route({ method: 'POST', path: '/item', handler: createItemHandler });

        server.inject({
            method: 'POST', url: '/item',
            payload: '{"name": "foobar\r\nContent-Length: \r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 19\r\n\r\n<html>Shazam</html>"}',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('prevents xss with invalid content types', (done) => {

        const handler = function (request, reply) {

            return reply('Success');
        };

        const server = new Hapi.Server();
        server.connection();
        server.state('encoded', { encoding: 'iron' });
        server.route({ method: 'POST', path: '/', handler: handler });

        server.inject({
            method: 'POST',
            url: '/',
            payload: '{"something":"something"}',
            headers: { 'content-type': '<script>alert(1)</script>;' }
        },
        (res) => {

            expect(res.result.message).to.not.contain('script');
            done();
        });
    });

    it('prevents xss with invalid cookie values in the request', (done) => {

        const handler = function (request, reply) {

            return reply('Success');
        };

        const server = new Hapi.Server();
        server.connection();
        server.state('encoded', { encoding: 'iron' });
        server.route({ method: 'POST', path: '/', handler: handler });

        server.inject({
            method: 'POST',
            url: '/',
            payload: '{"something":"something"}',
            headers: { cookie: 'encoded="<script></script>";' }
        },
        (res) => {

            expect(res.result.message).to.not.contain('<script>');
            done();
        });
    });

    it('prevents xss with invalid cookie name in the request', (done) => {

        const handler = function (request, reply) {

            return reply('Success');
        };

        const server = new Hapi.Server();
        server.connection();
        server.state('encoded', { encoding: 'iron' });
        server.route({ method: 'POST', path: '/', handler: handler });

        server.inject({
            method: 'POST',
            url: '/',
            payload: '{"something":"something"}',
            headers: { cookie: '<script></script>=value;' }
        },
        (res) => {

            expect(res.result.message).to.not.contain('<script>');
            done();
        });
    });

    it('prevents xss in path validation response message', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.state('encoded', { encoding: 'iron' });

        server.route({
            method: 'GET', path: '/fail/{name}', handler: function (request, reply) {

                return reply('Success');
            },
            config: {
                validate: { params: { name: Joi.number() } }
            }
        });

        server.inject({
            method: 'GET',
            url: '/fail/<script>'
        },
        (res) => {

            expect(res.result.message).to.not.contain('<script>');
            expect(JSON.stringify(res.result.validation)).to.not.contain('<script>');
            done();
        });
    });

    it('prevents xss in payload validation response message', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'POST', path: '/fail/payload', handler: function (request, reply) {

                return reply('Success');
            },
            config: {
                validate: { payload: { name: Joi.number() } }
            }
        });

        server.inject({
            method: 'POST',
            url: '/fail/payload',
            payload: '{"<script></script>":"other"}',
            headers: { 'content-type': 'application/json' }
        },
        (res) => {

            expect(res.result.message).to.not.contain('<script>');
            expect(JSON.stringify(res.result.validation)).to.not.contain('<script>');
            done();
        });
    });

    it('prevents xss in query validation response message', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET', path: '/fail/query', handler: function (request, reply) {

                return reply('Success');
            },
            config: {
                validate: { query: { name: Joi.string() } }
            }
        });

        server.inject({
            method: 'GET',
            url: '/fail/query?<script></script>=value'
        },
        (res) => {

            expect(res.result.message).to.not.contain('<script>');
            expect(JSON.stringify(res.result.validation)).to.not.contain('<script>');
            done();
        });
    });
});
