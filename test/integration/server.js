// Load modules

var Lab = require('lab');
var Net = require('net');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Server', function () {

    it('calls start twice', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            server.start(function () {

                server.stop(function () {

                    done();
                });
            });
        });
    });

    it('won\'t stop until all connections are closed', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();
            socket1.on('error', function () { });
            socket2.on('error', function () { });

            socket1.connect(server.info.port, '127.0.0.1', function () {

                socket2.connect(server.info.port, '127.0.0.1', function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);

                        server.stop(function () {

                            server.listener.getConnections(function (err, count) {

                                expect(count).to.equal(0);
                                done();
                            });
                        });

                        socket1.end();
                        socket2.end();
                    });
                });
            });
        });
    });

    it('won\'t destroy connections until after the timeout', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket2.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket1.connect(server.info.port, server.settings.host, function () {

                socket2.connect(server.info.port, server.settings.host, function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);
                        var timer = new Hapi.utils.Bench();

                        server.stop({ timeout: 20 }, function () {

                            expect(timer.elapsed()).to.be.at.least(19);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('won\'t destroy connections if they close by themselves', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket2.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket1.connect(server.info.port, server.settings.host, function () {

                socket2.connect(server.info.port, server.settings.host, function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);
                        var timer = new Hapi.utils.Bench();

                        server.stop(function () {

                            server.listener.getConnections(function (err, count) {

                                expect(count).to.equal(0);
                                expect(timer.elapsed()).to.be.at.least(9);
                                done();
                            });
                        });

                        setTimeout(function () {

                            socket1.end();
                            socket2.end();
                        }, 10);
                    });
                });
            });
        });
    });

    it('removes connection event listeners after it stops', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            server.stop(function () {

                server.start(function () {

                    server.stop(function () {

                        expect(server.listeners('connection').length).to.be.eql(0);
                        done();
                    });
                });
            });
        });
    });

    it('provisions a server cache', function (done) {

        var server = new Hapi.Server(0);
        var cache = server.cache('test', { expiresIn: 1000 });
        server.start(function () {

            cache.set('a', 'going in', 0, function (err) {

                cache.get('a', function (err, value) {

                    expect(value.item).to.equal('going in');

                    server.stop(function () {

                        done();
                    });
                });
            });
        });
    });

    it('measures loop delay', function (done) {

        var server = new Hapi.Server(0, { load: { sampleInterval: 4 } });
        var handler = function (request, reply) {

            var start = Date.now();
            while (Date.now() - start < 5);
            reply('ok');
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

    it('rejects request due to high load', function (done) {

        var server = new Hapi.Server(0, { load: { sampleInterval: 5, maxRssBytes: 1 } });
        var handler = function (request, reply) {

            var start = Date.now();
            while (Date.now() - start < 10);
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.start(function (err) {

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);

                setImmediate(function () {

                    server.inject('/', function (res) {

                        expect(res.statusCode).to.equal(503);
                        server.stop(function () {

                            done();
                        });
                    });
                });
            });
        });
    });

    it('reuses the same cache segment', function (done) {

        var server = new Hapi.Server({ cache: { engine: 'memory', shared: true } });
        expect(function () {

            var a1 = server.cache('a', { expiresIn: 1000 });
            var a2 = server.cache('a', { expiresIn: 1000 });
        }).to.not.throw;
        done();
    });
});
