'use strict';

const DC = require('diagnostics_channel');

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');

const Hapi = require('..');

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;

describe('DiagnosticChannel', () => {

    describe('onServerChannel', () => {

        const channel = DC.channel('hapi.onServer');

        it('server should be exposed on creation through the channel hapi.onServer', async () => {

            let exposedServer;
            let server;

            await new Promise((resolve) => {

                channel.subscribe((srv) => {

                    exposedServer = srv;
                    resolve();
                });

                server = Hapi.server();
            });

            expect(exposedServer).to.equal(server);
        });
    });

    describe('onRouteChannel', () => {

        const channel = DC.channel('hapi.onRoute');

        it('route should be exposed on creation through the channel hapi.onRoute', async () => {

            const server = Hapi.server();
            let route;

            await new Promise((resolve) => {

                channel.subscribe((rte) => {

                    route = rte;
                    resolve();
                });

                server.route({
                    method: 'GET',
                    path: '/',
                    options: { app: { x: 'o' } },
                    handler: () => 'ok'
                });
            });

            expect(route).to.be.an.object();
            expect(route.settings.app.x).to.equal('o');
        });
    });

    describe('onResponseChannel', () => {

        const channel = DC.channel('hapi.onResponse');

        it('response should be exposed on creation through the channel hapi.onResponse', async () => {

            const server = Hapi.server();
            let responseExposed;

            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const eventPromise = new Promise((resolve) => {

                channel.subscribe((res) => {

                    responseExposed = res;
                    resolve();
                });
            });

            const response = await server.inject('/');
            await eventPromise;

            expect(response.request.response).to.equal(responseExposed);
        });
    });

    describe('onRequestChannel', () => {

        const channel = DC.channel('hapi.onRequest');

        it('request should be exposed on creation through the channel hapi.onRequest', async () => {

            const server = Hapi.server();
            let requestExposed;

            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const eventPromise = new Promise((resolve) => {

                channel.subscribe((req) => {

                    requestExposed = req;
                    resolve();
                });
            });

            const response = await server.inject('/');
            await eventPromise;
            expect(response.request).to.equal(requestExposed);
        });
    });
});
