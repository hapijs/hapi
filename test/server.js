// Load modules

var Code = require('code');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Server', function () {

    it('does not cache etags', function (done) {

        var server = new Hapi.Server({ files: { etagsCacheMaxSize: 0 } });
        server.connection({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/note', handler: { file: './file/note.txt' } });

        server.inject('/note', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('Test');
            expect(res.headers.etag).to.not.exist();

            server.inject('/note', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('Test');
                expect(res.headers.etag).to.not.exist();
                done();
            });
        });
    });

    it('sets connections defaults', function (done) {

        var server = new Hapi.Server({ connections: { app: { message: 'test defaults' } } });
        server.connection();
        expect(server.connections[0].settings.app.message).to.equal('test defaults');
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

            server.on('start', function () { ++started; });
            server.on('stop', function () { ++stopped; });

            server.start(function () {

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

        it('starts a server without callback', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.start();
            setTimeout(function () {

                server.stop();
                done();
            }, 10);
        });

        it('errors on bad cache start', function (done) {

            var cache = {
                engine: {
                    start: function (callback) {

                        return callback(new Error('oops'));
                    }
                }
            };

            var server = new Hapi.Server({ cache: cache });
            server.connection();
            server.start(function (err) {

                expect(err.message).to.equal('oops');
                done();
            });
        });

        it('fails to start server without connections', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.start();
            }).to.throw('No connections to start');
            done();
        });
    });

    describe('stop()', function () {

        it('stops the cache', function (done) {

            var server = new Hapi.Server();
            server.connection();
            var cache = server.cache({ segment: 'test', expiresIn: 1000 });
            server.start(function () {

                cache.set('a', 'going in', 0, function (err) {

                    cache.get('a', function (err, value, cached, report) {

                        expect(value).to.equal('going in');

                        server.stop(function () {

                            cache.get('a', function (err, value, cached, report) {

                                expect(value).to.equal(null);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('connection()', function () {

        it('throws on invalid config', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ something: false });
            }).to.throw(/Invalid connection options/);
            done();
        });

        it('validates server timeout is less then socket timeout', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ timeout: { server: 60000, socket: 120000 } });
            }).to.not.throw();
            done();
        });

        it('validates server timeout is less then socket timeout (node default)', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ timeout: { server: 60000, socket: false } });
            }).to.not.throw();
            done();
        });

        it('combines configuration from server and connection (cors)', function (done) {

            var server = new Hapi.Server({ connections: { cors: true } });
            server.connection({ cors: { origin: ['example.com'] } });
            expect(server.connections[0].settings.cors.origin).to.deep.equal(['example.com']);
            done();
        });

        it('combines configuration from server and connection (security)', function (done) {

            var server = new Hapi.Server({ connections: { security: { hsts: 1, xss: false } } });
            server.connection({ security: { hsts: 2 } });
            expect(server.connections[0].settings.security.hsts).to.equal(2);
            expect(server.connections[0].settings.security.xss).to.be.false();
            expect(server.connections[0].settings.security.xframe).to.equal('deny');
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

                server.inject('/', function (res) {

                    expect(server.load.eventLoopDelay).to.equal(0);

                    setImmediate(function () {

                        server.inject('/', function (res) {

                            expect(server.load.eventLoopDelay).to.be.above(0);

                            setImmediate(function () {

                                server.inject('/', function (res) {

                                    expect(server.load.eventLoopDelay).to.be.above(0);
                                    expect(server.load.heapUsed).to.be.above(1024 * 1024);
                                    expect(server.load.rss).to.be.above(1024 * 1024);
                                    server.stop(function () {

                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
