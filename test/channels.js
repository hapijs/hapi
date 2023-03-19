'use strict';

const DC = require('diagnostics_channel');

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Hoek = require('@hapi/hoek');

const Hapi = require('..');

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;

describe('DiagnosticChannel', () => {

    describe('hapi.onServer', () => {

        const channel = DC.channel('hapi.onServer');

        it('server should be exposed on creation through the channel hapi.onServer', async () => {

            let server;

            const exposedServer = await new Promise((resolve) => {

                channel.subscribe(resolve);

                server = Hapi.server();
            });

            expect(exposedServer).to.shallow.equal(server);
        });
    });

    describe('hapi.onRoute', () => {

        const channel = DC.channel('hapi.onRoute');

        it('route should be exposed on creation through the channel hapi.onRoute', async () => {

            const server = Hapi.server();

            const exposedRoute = await new Promise((resolve) => {

                channel.subscribe(resolve);

                server.route({
                    method: 'GET',
                    path: '/',
                    options: { app: { x: 'o' } },
                    handler: () => 'ok'
                });
            });

            expect(exposedRoute).to.be.an.object();
            expect(exposedRoute.settings.app.x).to.equal('o');
        });
    });

    describe('hapi.onResponse', () => {

        const channel = DC.channel('hapi.onResponse');

        it('response should be exposed on creation through the channel hapi.onResponse', async () => {

            const server = Hapi.server();

            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const event = new Promise((resolve) => {

                channel.subscribe(resolve);
            });

            const response = await server.inject('/');
            const responseExposed = await event;
            expect(response.request.response).to.shallow.equal(responseExposed);
        });
    });

    describe('hapi.onRequest', () => {

        const channel = DC.channel('hapi.onRequest');

        it('request should be exposed on creation through the channel hapi.onRequest', async () => {

            const server = Hapi.server();

            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const event = new Promise((resolve) => {

                channel.subscribe(resolve);
            });

            const response = await server.inject('/');
            const requestExposed = await event;
            expect(response.request).to.shallow.equal(requestExposed);
        });

        it('request should not have been routed when hapi.onRequest is triggered', async () => {

            const server = Hapi.server();

            server.route({ method: 'GET', path: '/test/{p}', handler: () => 'ok' });

            server.ext('onRequest', async (request, h) => {

                await Hoek.wait(10);
                return h.continue;
            });

            const event = new Promise((resolve) => {

                channel.subscribe(resolve);
            });

            const request = server.inject('/test/foo');
            const requestExposed = await event;
            expect(requestExposed.params).to.be.null();

            const response = await request;
            expect(response.request).to.shallow.equal(requestExposed);
        });
    });

    describe('hapi.onRequestLifecycle', () => {

        const channel = DC.channel('hapi.onRequestLifecycle');

        it('request should be exposed after routing through the channel hapi.onRequestLifecycle', async () => {

            const server = Hapi.server();

            server.route({
                method: 'POST',
                path: '/test/{p}',
                options: { app: { x: 'o' } },
                handler: () => 'ok'
            });

            server.ext('onPreAuth', async (request, h) => {

                await Hoek.wait(10);
                return h.continue;
            });

            const event = new Promise((resolve) => {

                channel.subscribe(resolve);
            });

            const request = server.inject({ method: 'POST', url: '/test/foo', payload: '{"a":"b"}' });
            const requestExposed = await event;
            expect(requestExposed.params).to.be.an.object();
            expect(requestExposed.params.p).to.equal('foo');
            expect(requestExposed.route).to.be.an.object();
            expect(requestExposed.route.settings.app.x).to.equal('o');
            expect(requestExposed.payload).to.be.undefined();

            const response = await request;
            expect(response.request).to.shallow.equal(requestExposed);
            expect(response.request.payload).to.be.an.object();
            expect(response.request.payload.a).to.equal('b');
        });
    });

    describe('hapi.onError', () => {

        const channel = DC.channel('hapi.onError');

        it('should expose the request as well as the error object when an error happens during the request lifetime', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                handler: () => {

                    throw new Error('some error message')
                }
            });

            const event = new Promise((resolve) => {

                channel.subscribe(resolve);
            });

            const response = await server.inject('/');
            const { request: requestExposed, error: errorExposed } = await event;
            expect(response.request).to.shallow.equal(requestExposed);
            expect(errorExposed).to.be.an.instanceof(Error);
            expect(errorExposed.message).to.equal('some error message');
        });
    });
});
