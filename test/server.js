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

        const server = new Hapi.Server({ connections: { app: { message: 'test defaults' } } });
        server.connection();
        expect(server.connections[0].settings.app.message).to.equal('test defaults');
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
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'test'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
            server.connection({ labels: ['s4', 'b', 'test', 'cache'] });

            let started = 0;
            let stopped = 0;

            server.on('start', () => {

                ++started;
            });

            server.on('stop', () => {

                ++stopped;
            });

            server.start((err) => {

                expect(err).to.not.exist();

                server.connections.forEach((connection) => {

                    expect(connection._started).to.equal(true);
                });

                server.stop(() => {

                    server.connections.forEach((connection) => {

                        expect(connection._started).to.equal(false);
                    });

                    expect(started).to.equal(1);
                    expect(stopped).to.equal(1);
                    done();
                });
            });
        });

        it('initializes, starts, and stops', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'test'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
            server.connection({ labels: ['s4', 'b', 'test', 'cache'] });

            let started = 0;
            let stopped = 0;

            server.on('start', () => {

                ++started;
            });

            server.on('stop', () => {

                ++stopped;
            });

            server.initialize((err) => {

                expect(err).to.not.exist();

                server.start((err) => {

                    expect(err).to.not.exist();

                    server.connections.forEach((connection) => {

                        expect(connection._started).to.equal(true);
                    });

                    server.stop(() => {

                        server.connections.forEach((connection) => {

                            expect(connection._started).to.equal(false);
                        });

                        expect(started).to.equal(1);
                        expect(stopped).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('returns connection start error', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.start((err) => {

                expect(err).to.not.exist();
                const port = server.info.port;

                server.connection({ port: port });
                server.connection({ port: port });
                server.stop((err) => {

                    expect(err).to.not.exist();
                    server.start((err) => {

                        expect(err).to.exist();
                        expect(err.message).to.match(/EADDRINUSE/);
                        server.stop(done);
                    });
                });
            });
        });

        it('returns onPostStart error', (done) => {

            const server = new Hapi.Server();
            server.connection();

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

            const server = new Hapi.Server({ cache: cache });
            server.connection();
            server.start((err) => {

                expect(err.message).to.equal('oops');
                server.stop(done);
            });
        });

        it('fails to start server without connections', (done) => {

            const server = new Hapi.Server();
            server.start((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('No connections to start');
                done();
            });
        });

        it('fails to start server when registration incomplete', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.connection();
            server.register(plugin, Hoek.ignore);
            server.start((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server before plugins finished registration');
                done();
            });
        });

        it('fails to start when no callback is passed', (done) => {

            const server = new Hapi.Server();

            expect(() => {

                server.start();
            }).to.throw('Missing required start callback function');
            done();
        });

        it('fails to initialize server when not stopped', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.connection();
            server.start((err) => {

                server.initialize((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Cannot initialize server while it is in started state');
                    done();
                });
            });
        });

        it('fails to start server when starting', (done) => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.connection();
            server.start(Hoek.ignore);
            server.start((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server while it is in initializing state');
                done();
            });
        });
    });

    describe('stop()', () => {

        it('stops the cache', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            server.initialize((err) => {

                expect(err).to.not.exist();

                cache.set('a', 'going in', 0, (err) => {

                    cache.get('a', (err, value1, cached1, report1) => {

                        expect(value1).to.equal('going in');

                        server.stop((err) => {

                            cache.get('a', (err, value2, cached2, report2) => {

                                expect(value2).to.equal(null);
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('returns an extension error (onPreStop)', (done) => {

            const server = new Hapi.Server();
            server.connection();
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
            server.connection();

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

        it('returns a connection stop error', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.connections[0]._stop = function (options, next) {

                return next(new Error('stop failed'));
            };

            server.start((err) => {

                expect(err).to.not.exist();
                server.stop((err) => {

                    expect(err.message).to.equal('stop failed');
                    done();
                });
            });
        });

        it('errors when stopping a stopping server', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.stop(Hoek.ignore);
            server.stop((err) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot stop server while in stopping state');
                done();
            });
        });
    });

    describe('connection()', () => {

        it('returns a server with only the selected connection', (done) => {

            const server = new Hapi.Server();
            const p1 = server.connection({ port: 1 });
            const p2 = server.connection({ port: 2 });

            expect(server.connections.length).to.equal(2);
            expect(p1.connections.length).to.equal(1);
            expect(p2.connections.length).to.equal(1);
            expect(p1.connections[0].settings.port).to.equal(1);
            expect(p2.connections[0].settings.port).to.equal(2);
            done();
        });

        it('throws on invalid config', (done) => {

            const server = new Hapi.Server();
            expect(() => {

                server.connection({ something: false });
            }).to.throw(/Invalid connection options/);
            done();
        });

        it('combines configuration from server and connection (cors)', (done) => {

            const server = new Hapi.Server({ connections: { routes: { cors: true } } });
            server.connection({ routes: { cors: { origin: ['example.com'] } } });
            expect(server.connections[0].settings.routes.cors.origin).to.deep.equal(['example.com']);
            done();
        });

        it('combines configuration from server and connection (security)', (done) => {

            const server = new Hapi.Server({ connections: { routes: { security: { hsts: 1, xss: false } } } });
            server.connection({ routes: { security: { hsts: 2 } } });
            expect(server.connections[0].settings.routes.security.hsts).to.equal(2);
            expect(server.connections[0].settings.routes.security.xss).to.be.false();
            expect(server.connections[0].settings.routes.security.xframe).to.equal('deny');
            done();
        });

        it('decorates and clears single connection shortcuts', (done) => {

            const server = new Hapi.Server();
            expect(server.info).to.not.exist();
            server.connection();
            expect(server.info).to.exist();
            server.connection();
            expect(server.info).to.not.exist();

            done();
        });
    });

    describe('load', { parallel: false }, () => {

        it('measures loop delay', (done) => {

            const server = new Hapi.Server({ load: { sampleInterval: 4 } });
            server.connection();

            const handler = function (request, reply) {

                const start = Date.now();
                while (Date.now() - start < 5) { }
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res1) => {

                    expect(server.load.eventLoopDelay).to.be.below(5);

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
