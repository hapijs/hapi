'use strict';

// Load modules

const Code = require('code');
const Hapi = require('..');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Server', () => {

    it('sets connections defaults', async () => {

        const server = new Hapi.Server({ app: { message: 'test defaults' } });
        expect(server.settings.app.message).to.equal('test defaults');
    });

    it('overrides mime settings', async () => {

        const options = {
            mime: {
                override: {
                    'node/module': {
                        source: 'steve',
                        compressible: false,
                        extensions: ['node', 'module', 'npm'],
                        type: 'node/module'
                    }
                }
            }
        };

        const server = new Hapi.Server(options);
        expect(server.mime.path('file.npm').type).to.equal('node/module');
        expect(server.mime.path('file.npm').source).to.equal('steve');
    });

    describe('start()', () => {

        it('starts and stops', async () => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            await server.start();
            expect(server._started).to.equal(true);

            await server.stop();
            expect(server._started).to.equal(false);
            expect(started).to.equal(1);
            expect(stopped).to.equal(1);
        });

        it('initializes, starts, and stops', async () => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            await server.initialize();
            await server.start();
            expect(server._started).to.equal(true);

            await server.stop();
            expect(server._started).to.equal(false);
            expect(started).to.equal(1);
            expect(stopped).to.equal(1);
        });

        it('does not re-initialize the server', async () => {

            const server = new Hapi.Server();
            await server.initialize();
            await server.initialize();
        });

        it('returns connection start error', async () => {

            const server1 = new Hapi.Server();
            await server1.start();
            const port = server1.info.port;

            const server2 = new Hapi.Server({ port });
            await expect(server2.start()).to.reject(/EADDRINUSE/);

            await server1.stop();
        });

        it('returns onPostStart error', async () => {

            const server = new Hapi.Server();

            const postStart = function (srv, next) {

                return next(new Error('boom'));
            };

            server.ext('onPostStart', postStart);

            await expect(server.start()).to.reject('boom');
        });

        it('errors on bad cache start', async () => {

            const cache = {
                engine: {
                    start: function (callback) {

                        return callback(new Error('oops'));
                    },
                    stop: function () { }
                }
            };

            const server = new Hapi.Server({ cache });
            await expect(server.start()).to.reject('oops');
        });

        it('fails to start server when registration incomplete', async () => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.register(plugin);
            await expect(server.start()).to.reject('Cannot start server before plugins finished registration');
        });

        it('fails to initialize server when not stopped', async () => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            await server.start();
            await expect(server.initialize()).to.reject('Cannot initialize server while it is in started phase');
        });

        it('fails to start server when starting', async () => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            const starting = server.start();
            await expect(server.start()).to.reject('Cannot start server while it is in initializing phase');
            await starting;
            await server.stop();
        });
    });

    describe('stop()', () => {

        it('stops the cache', async () => {

            const server = new Hapi.Server();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            await server.initialize();

            await cache.set('a', 'going in', 0);
            const { value: value1 } = await cache.get('a');
            expect(value1).to.equal('going in');
            await server.stop();
            await expect(cache.get('a')).to.reject();
        });

        it('returns an extension error (onPreStop)', async () => {

            const server = new Hapi.Server();
            const preStop = function (srv, next) {

                return next(new Error('failed cleanup'));
            };

            server.ext('onPreStop', preStop);

            await server.start();
            await expect(server.stop()).to.reject('failed cleanup');
        });

        it('returns an extension error (onPostStop)', async () => {

            const server = new Hapi.Server();

            const postStop = function (srv, next) {

                return next(new Error('failed cleanup'));
            };

            server.ext('onPostStop', postStop);

            await server.start();
            await expect(server.stop()).to.reject('failed cleanup');
        });

        it('errors when stopping a stopping server', async () => {

            const server = new Hapi.Server();

            const stopping = server.stop();
            await expect(server.stop()).to.reject('Cannot stop server while in stopping phase');
            await stopping;
        });
    });

    describe('connection()', () => {

        it('throws on invalid config', async () => {

            expect(() => {

                new Hapi.Server({ something: false });
            }).to.throw(/Invalid server options/);
        });

        it('combines configuration from server and defaults (cors)', async () => {

            const server = new Hapi.Server({ routes: { cors: { origin: ['example.com'] } } });
            expect(server.settings.routes.cors.origin).to.equal(['example.com']);
        });

        it('combines configuration from server and defaults (security)', async () => {

            const server = new Hapi.Server({ routes: { security: { hsts: 2, xss: false } } });
            expect(server.settings.routes.security.hsts).to.equal(2);
            expect(server.settings.routes.security.xss).to.be.false();
            expect(server.settings.routes.security.xframe).to.equal('deny');
        });
    });

    describe('load', { parallel: false }, () => {

        it('measures loop delay', async () => {

            const server = new Hapi.Server({ load: { sampleInterval: 4 } });

            const handler = function (request, reply) {

                const start = Date.now();
                while (Date.now() - start < 5) { }
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            await server.inject('/');
            expect(server.load.eventLoopDelay).to.be.below(6);

            await internals.wait(0);

            await server.inject('/');
            expect(server.load.eventLoopDelay).to.be.above(0);

            await internals.wait(0);

            await server.inject('/');
            expect(server.load.eventLoopDelay).to.be.above(0);
            expect(server.load.heapUsed).to.be.above(1024 * 1024);
            expect(server.load.rss).to.be.above(1024 * 1024);
            await server.stop();
        });
    });
});


internals.wait = function (timeout) {

    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
};
