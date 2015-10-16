// Load modules

var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Server', function () {

    it('sets connections defaults', function (done) {

        var server = new Hapi.Server({ connections: { app: { message: 'test defaults' } } });
        server.connection();
        expect(server.connections[0].settings.app.message).to.equal('test defaults');
        done();
    });

    it('overrides mime settings', function (done) {

        var options = {
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

        var server = new Hapi.Server(options);
        expect(server.mime.path('file.npm').type).to.equal('node/module');
        expect(server.mime.path('file.npm').source).to.equal('steve');
        done();
    });

    describe('start()', function () {

        it('starts and stops', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'test'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
            server.connection({ labels: ['s4', 'b', 'test', 'cache'] });

            var started = 0;
            var stopped = 0;

            server.on('start', function () {

                ++started;
            });

            server.on('stop', function () {

                ++stopped;
            });

            server.start(function (err) {

                expect(err).to.not.exist();

                server.connections.forEach(function (connection) {

                    expect(connection._started).to.equal(true);
                });

                server.stop(function () {

                    server.connections.forEach(function (connection) {

                        expect(connection._started).to.equal(false);
                    });

                    expect(started).to.equal(1);
                    expect(stopped).to.equal(1);
                    done();
                });
            });
        });

        it('initializes, starts, and stops', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'test'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
            server.connection({ labels: ['s4', 'b', 'test', 'cache'] });

            var started = 0;
            var stopped = 0;

            server.on('start', function () {

                ++started;
            });

            server.on('stop', function () {

                ++stopped;
            });

            server.initialize(function (err) {

                expect(err).to.not.exist();

                server.start(function (err) {

                    expect(err).to.not.exist();

                    server.connections.forEach(function (connection) {

                        expect(connection._started).to.equal(true);
                    });

                    server.stop(function () {

                        server.connections.forEach(function (connection) {

                            expect(connection._started).to.equal(false);
                        });

                        expect(started).to.equal(1);
                        expect(stopped).to.equal(1);
                        done();
                    });
                });
            });
        });

        it('returns connection start error', function (done) {

            var server = new Hapi.Server();
            server.connection();

            server.start(function (err) {

                expect(err).to.not.exist();
                var port = server.info.port;

                server.connection({ port: port });
                server.connection({ port: port });
                server.stop(function (err) {

                    expect(err).to.not.exist();
                    server.start(function (err) {

                        expect(err).to.exist();
                        expect(err.message).to.match(/EADDRINUSE/);
                        server.stop(done);
                    });
                });
            });
        });

        it('returns onPostStart error', function (done) {

            var server = new Hapi.Server();
            server.connection();

            server.ext('onPostStart', function (srv, next) {

                return next(new Error('boom'));
            });

            server.start(function (err) {

                expect(err).to.exist();
                expect(err.message).to.equal('boom');
                server.stop(done);
            });
        });

        it('errors on bad cache start', function (done) {

            var cache = {
                engine: {
                    start: function (callback) {

                        return callback(new Error('oops'));
                    },
                    stop: function () { }
                }
            };

            var server = new Hapi.Server({ cache: cache });
            server.connection();
            server.start(function (err) {

                expect(err.message).to.equal('oops');
                server.stop(done);
            });
        });

        it('fails to start server without connections', function (done) {

            var server = new Hapi.Server();
            server.start(function (err) {

                expect(err).to.exist();
                expect(err.message).to.equal('No connections to start');
                done();
            });
        });

        it('fails to start server when registration incomplete', function (done) {

            var plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, Hoek.ignore);
            server.start(function (err) {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server before plugins finished registration');
                done();
            });
        });

        it('fails to start when no callback is passed', function (done) {

            var server = new Hapi.Server();

            expect(function () {

                server.start();
            }).to.throw('Missing required start callback function');
            done();
        });

        it('fails to initialize server when not stopped', function (done) {

            var plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            var server = new Hapi.Server();
            server.connection();
            server.start(function (err) {

                server.initialize(function (err) {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Cannot initialize server while it is in started state');
                    done();
                });
            });
        });

        it('fails to start server when starting', function (done) {

            var plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            var server = new Hapi.Server();
            server.connection();
            server.start(Hoek.ignore);
            server.start(function (err) {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot start server while it is in initializing state');
                done();
            });
        });
    });

    describe('stop()', function () {

        it('stops the cache', function (done) {

            var server = new Hapi.Server();
            server.connection();
            var cache = server.cache({ segment: 'test', expiresIn: 1000 });
            server.initialize(function (err) {

                expect(err).to.not.exist();

                cache.set('a', 'going in', 0, function (err) {

                    cache.get('a', function (err, value1, cached1, report1) {

                        expect(value1).to.equal('going in');

                        server.stop(function (err) {

                            cache.get('a', function (err, value2, cached2, report2) {

                                expect(value2).to.equal(null);
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('returns an extension error (onPreStop)', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.ext('onPreStop', function (srv, next) {

                return next(new Error('failed cleanup'));
            });

            server.start(function (err) {

                expect(err).to.not.exist();
                server.stop(function (err) {

                    expect(err.message).to.equal('failed cleanup');
                    done();
                });
            });
        });

        it('returns an extension error (onPostStop)', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.ext('onPostStop', function (srv, next) {

                return next(new Error('failed cleanup'));
            });

            server.start(function (err) {

                expect(err).to.not.exist();
                server.stop(function (err) {

                    expect(err.message).to.equal('failed cleanup');
                    done();
                });
            });
        });

        it('returns a connection stop error', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.connections[0]._stop = function (options, next) {

                return next(new Error('stop failed'));
            };

            server.start(function (err) {

                expect(err).to.not.exist();
                server.stop(function (err) {

                    expect(err.message).to.equal('stop failed');
                    done();
                });
            });
        });

        it('errors when stopping a stopping server', function (done) {

            var server = new Hapi.Server();
            server.connection();

            server.stop(Hoek.ignore);
            server.stop(function (err) {

                expect(err).to.exist();
                expect(err.message).to.equal('Cannot stop server while in stopping state');
                done();
            });
        });
    });

    describe('connection()', function () {

        it('returns a server with only the selected connection', function (done) {

            var server = new Hapi.Server();
            var p1 = server.connection({ port: 1 });
            var p2 = server.connection({ port: 2 });

            expect(server.connections.length).to.equal(2);
            expect(p1.connections.length).to.equal(1);
            expect(p2.connections.length).to.equal(1);
            expect(p1.connections[0].settings.port).to.equal(1);
            expect(p2.connections[0].settings.port).to.equal(2);
            done();
        });

        it('throws on invalid config', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ something: false });
            }).to.throw(/Invalid connection options/);
            done();
        });

        it('combines configuration from server and connection (cors)', function (done) {

            var server = new Hapi.Server({ connections: { routes: { cors: true } } });
            server.connection({ routes: { cors: { origin: ['example.com'] } } });
            expect(server.connections[0].settings.routes.cors.origin).to.deep.equal(['example.com']);
            done();
        });

        it('combines configuration from server and connection (security)', function (done) {

            var server = new Hapi.Server({ connections: { routes: { security: { hsts: 1, xss: false } } } });
            server.connection({ routes: { security: { hsts: 2 } } });
            expect(server.connections[0].settings.routes.security.hsts).to.equal(2);
            expect(server.connections[0].settings.routes.security.xss).to.be.false();
            expect(server.connections[0].settings.routes.security.xframe).to.equal('deny');
            done();
        });

        it('decorates and clears single connection shortcuts', function (done) {

            var server = new Hapi.Server();
            expect(server.info).to.not.exist();
            server.connection();
            expect(server.info).to.exist();
            server.connection();
            expect(server.info).to.not.exist();

            done();
        });
    });

    describe('load', { parallel: false }, function () {

        it('measures loop delay', function (done) {

            var server = new Hapi.Server({ load: { sampleInterval: 4 } });
            server.connection();

            var handler = function (request, reply) {

                var start = Date.now();
                while (Date.now() - start < 5) { }
                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start(function (err) {

                expect(err).to.not.exist();

                server.inject('/', function (res1) {

                    expect(server.load.eventLoopDelay).to.be.below(5);

                    setImmediate(function () {

                        server.inject('/', function (res2) {

                            expect(server.load.eventLoopDelay).to.be.above(0);

                            setImmediate(function () {

                                server.inject('/', function (res3) {

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
