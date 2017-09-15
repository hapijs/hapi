'use strict';

// Load modules

const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Server', () => {

    it('sets connections defaults', (done) => {

        const server = new Hapi.Server({ app: { message: 'test defaults' } });
        expect(server.settings.app.message).to.equal('test defaults');
        done();
    });

    it('overrides mime settings', (done) => {

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
        done();
    });

    describe('start()', () => {

        it('starts and stops', (done) => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            server.start((err) => {

                expect(err).to.not.exist();
                expect(server._started).to.equal(true);

                server.stop(() => {

                    expect(server._started).to.equal(false);
                    expect(started).to.equal(1);
                    expect(stopped).to.equal(1);
                    done();
                });
            });
        });

        it('initializes, starts, and stops', (done) => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            server.initialize((err) => {

                expect(err).to.not.exist();

                server.start((err) => {

                    expect(err).to.not.exist();
                    expect(server._started).to.equal(true);

                    server.stop(() => {

                        expect(server._started).to.equal(false);
                        expect(started).to.equal(1);
                        expect(stopped).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('initializes, starts, and stops (promises)', (done) => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            server.initialize().then(() => {

                server.start().then(() => {

                    expect(server._started).to.equal(true);

                    server.stop().then(() => {

                        expect(server._started).to.equal(false);
                        expect(started).to.equal(1);
                        expect(stopped).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('does not re-initialize the server', (done) => {

            const server = new Hapi.Server();

            server.initialize((err) => {

                expect(err).to.not.exist();

                server.initialize((err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });

        it('returns connection start error', (done) => {

            const server1 = new Hapi.Server();
            server1.start((err) => {

                expect(err).to.not.exist();
                const port = server1.info.port;

                const server2 = new Hapi.Server({ port });
                server2.start((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.match(/EADDRINUSE/);
                    server1.stop(done);
                });
            });
        });

        it('returns onPostStart error', (done) => {

            const server = new Hapi.Server();

            const postStart = function (srv, next) {

                return next(new Error('boom'));
            };

            server.ext('onPostStart', postStart);

            server.start((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('boom');
                server.stop(done);
            });
        });

        it('errors on bad cache start', (done) => {

            const cache = {
                engine: {
                    start: function (callback) {

                        return callback(new Error('oops'));
                    },
                    stop: function () { }
                }
            };

            const server = new Hapi.Server({ cache });
            server.start((err) => {

                expect(err.message).to.equal('oops');
                server.stop(done);
            });
        });

        it('fails to start server when registration incomplete', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.register(plugin, Hoek.ignore);
            server.start((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server before plugins finished registration');
                done();
            });
        });

        it('fails to start server when registration incomplete (promise)', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.register(plugin, Hoek.ignore);
            server.start().catch((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server before plugins finished registration');
                done();
            });
        });

        it('fails to initialize server when not stopped', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.start((err) => {

                expect(err).to.not.exist();
                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Cannot initialize server while it is in started phase');
                    done();
                });
            });
        });

        it('fails to start server when starting', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.start(Hoek.ignore);
            server.start((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server while it is in initializing phase');
                done();
            });
        });
    });

    describe('stop()', () => {

        it('stops the cache', (done) => {

            const server = new Hapi.Server();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            server.initialize((err) => {

                expect(err).to.not.exist();
                cache.set('a', 'going in', 0, (err) => {

                    expect(err).to.not.exist();
                    cache.get('a', (err, value1, cached1, report1) => {

                        expect(err).to.not.exist();
                        expect(value1).to.equal('going in');

                        server.stop((err) => {

                            expect(err).to.not.exist();
                            cache.get('a', (err, value2, cached2, report2) => {

                                expect(err).to.exist();
                                expect(value2).to.equal(null);
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('stops the cache (promise)', (done) => {

            const server = new Hapi.Server();
            server.start().then(() => {

                server.stop({}).then(() => {

                    done();
                });
            });
        });

        it('returns an extension error (onPreStop)', (done) => {

            const server = new Hapi.Server();
            const preStop = function (srv, next) {

                return next(new Error('failed cleanup'));
            };

            server.ext('onPreStop', preStop);

            server.start((err) => {

                expect(err).to.not.exist();
                server.stop((err) => {

                    expect(err.message).to.equal('failed cleanup');
                    done();
                });
            });
        });

        it('returns an extension error (onPostStop)', (done) => {

            const server = new Hapi.Server();

            const postStop = function (srv, next) {

                return next(new Error('failed cleanup'));
            };

            server.ext('onPostStop', postStop);

            server.start((err) => {

                expect(err).to.not.exist();
                server.stop((err) => {

                    expect(err.message).to.equal('failed cleanup');
                    done();
                });
            });
        });

        it('errors when stopping a stopping server', (done) => {

            const server = new Hapi.Server();

            server.stop(Hoek.ignore);
            server.stop((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot stop server while in stopping phase');
                done();
            });
        });
    });

    describe('connection()', () => {

        it('throws on invalid config', (done) => {

            expect(() => {

                new Hapi.Server({ something: false });
            }).to.throw(/Invalid server options/);
            done();
        });

        it('combines configuration from server and defaults (cors)', (done) => {

            const server = new Hapi.Server({ routes: { cors: { origin: ['example.com'] } } });
            expect(server.settings.routes.cors.origin).to.equal(['example.com']);
            done();
        });

        it('combines configuration from server and defaults (security)', (done) => {

            const server = new Hapi.Server({ routes: { security: { hsts: 2, xss: false } } });
            expect(server.settings.routes.security.hsts).to.equal(2);
            expect(server.settings.routes.security.xss).to.be.false();
            expect(server.settings.routes.security.xframe).to.equal('deny');
            done();
        });
    });

    describe('load', { parallel: false }, () => {

        it('measures loop delay', (done) => {

            const server = new Hapi.Server({ load: { sampleInterval: 4 } });

            const handler = function (request, reply) {

                const start = Date.now();
                while (Date.now() - start < 5) { }
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler });
            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res1) => {

                    expect(server.load.eventLoopDelay).to.be.below(6);

                    setImmediate(() => {

                        server.inject('/', (res2) => {

                            expect(server.load.eventLoopDelay).to.be.above(0);

                            setImmediate(() => {

                                server.inject('/', (res3) => {

                                    expect(server.load.eventLoopDelay).to.be.above(0);
                                    expect(server.load.heapUsed).to.be.above(1024 * 1024);
                                    expect(server.load.rss).to.be.above(1024 * 1024);
                                    server.stop(done);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
