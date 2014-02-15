// Load modules

var Lab = require('lab');
var Http = require('http');
var Stream = require('stream');
var Nipple = require('nipple');
var Hapi = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Server Timeouts', function () {

    var slowHandler = function (request, reply) {

        setTimeout(function () {

            reply('Slow');
        }, 30);
    };

    var respondingHandler = function (request, reply) {

        var s = new Stream.PassThrough();
        reply(s);

        for (var i = 10000; i > 0; --i) {
            s.write(i.toString());
        }

        setTimeout(function () {

            s.emit('end');
        }, 40);
    };

    var fastHandler = function (request, reply) {

        reply('Fast');
    };

    var streamHandler = function (request, reply) {

        var TestStream = function () {

            Stream.Readable.call(this);
        };

        Hapi.utils.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            var self = this;

            if (this.isDone) {
                return;
            }
            this.isDone = true;

            setTimeout(function () {

                self.push('Hello');
            }, 30);

            setTimeout(function () {

                self.push(null);
            }, 60);
        };

        reply(new TestStream());
    };

    it('returns server error message when server taking too long', function (done) {

        var timeoutHandler = function (request, reply) { };

        var server = new Hapi.Server({ timeout: { server: 50 } });
        server.route({ method: 'GET', path: '/timeout', config: { handler: timeoutHandler } });

        var timer = new Hapi.utils.Bench();

        server.inject('/timeout', function (res) {

            expect(res.statusCode).to.equal(503);
            expect(timer.elapsed()).to.be.at.least(49);
            done();
        });
    });

    it('returns server error message when server timeout happens during request execution (and handler yields)', function (done) {

        var serverShort = new Hapi.Server({ timeout: { server: 2 } });
        serverShort.route({ method: 'GET', path: '/', config: { handler: slowHandler } });

        serverShort.inject('/', function (res) {

            expect(res.statusCode).to.equal(503);
            done();
        });
    });

    it('returns server error message when server timeout is short and already occurs when request executes', function (done) {

        var serverExt = new Hapi.Server({ timeout: { server: 2 } });
        serverExt.route({ method: 'GET', path: '/', config: { handler: function () { } } });
        serverExt.ext('onRequest', function (request, next) {

            setTimeout(next, 10);
        });

        serverExt.inject('/', function (res) {

            expect(res.statusCode).to.equal(503);
            done();
        });
    });

    it('does not return an error response when server is slow but faster than timeout', function (done) {

        var server = new Hapi.Server({ timeout: { server: 50 } });
        server.route({ method: 'GET', path: '/slow', config: { handler: slowHandler } });

        var timer = new Hapi.utils.Bench();
        server.inject('/slow', function (res) {

            expect(timer.elapsed()).to.be.at.least(29);
            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('does not return an error when server is responding when the timeout occurs', function (done) {

        var timer = new Hapi.utils.Bench();

        var server = new Hapi.Server(0, { timeout: { server: 50 } });
        server.route({ method: 'GET', path: '/responding', config: { handler: respondingHandler } });
        server.start(function () {

            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/responding',
                method: 'GET'
            };

            var req = Http.request(options, function (res) {

                expect(timer.elapsed()).to.be.at.least(70);
                expect(res.statusCode).to.equal(200);
                done();
            });

            req.write('\n');
        });
    });

    it('does not return an error response when server is slower than timeout but response has started', function (done) {

        var server = new Hapi.Server(0, { timeout: { server: 50 } });
        server.route({ method: 'GET', path: '/stream', config: { handler: streamHandler } });
        server.start(function () {

            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/stream',
                method: 'GET'
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
            req.end();
        });
    });

    it('does not return an error response when server takes less than timeout to respond', function (done) {

        var server = new Hapi.Server({ timeout: { server: 50 } });
        server.route({ method: 'GET', path: '/fast', config: { handler: fastHandler } });

        server.inject('/fast', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('returned when both client and server timeouts are the same and the client times out', function (done) {

        var timeoutHandler = function (request, reply) { };

        var server = new Hapi.Server(0, { timeout: { server: 50, client: 50 } });
        server.route({ method: 'POST', path: '/timeout', config: { handler: timeoutHandler } });

        server.start(function () {

            var timer = new Hapi.utils.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/timeout',
                method: 'POST'
            };

            var req = Http.request(options, function (res) {

                expect([503, 408]).to.contain(res.statusCode);
                expect(timer.elapsed()).to.be.at.least(49);
                done();
            });

            req.on('error', function (err) {

            });

            req.write('\n');
            setTimeout(function () {

                req.end();
            }, 100);
        });
    });

    it('initial long running requests don\'t prevent server timeouts from occuring on future requests', function (done) {

        var handler = function (request, reply) {

            setTimeout(function () {

                reply('ok');
            }, 70);
        };

        var server = new Hapi.Server(0, { timeout: { server: 50, client: 50 } });
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.start(function () {

            var timer = new Hapi.utils.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/',
                method: 'POST'
            };

            var req1 = Http.request(options, function (res1) {

                expect([503, 408]).to.contain(res1.statusCode);
                expect(timer.elapsed()).to.be.at.least(49);

                var req2 = Http.request(options, function (res2) {

                    expect(res2.statusCode).to.equal(503);
                    done();
                });

                req2.on('error', function (err) {

                });

                req2.end();
            });

            req1.on('error', function (err) {

            });

            req1.write('\n');
            setTimeout(function () {

                req1.end();
            }, 100);
        });
    });

    it('closes connection on socket timeout', function (done) {

        var server = new Hapi.Server(0, { timeout: { client: 45, socket: 50 } });
        server.route({
            method: 'GET', path: '/', config: {
                handler: function (request, reply) {

                    setTimeout(function () {

                        reply('too late');
                    }, 70);
                }
            }
        });

        server.start(function () {

            Nipple.request('GET', 'http://localhost:' + server.info.port + '/', {}, function (err, res) {

                expect(err).to.exist;
                expect(err.message).to.equal('Client request error: socket hang up');
                done();
            });
        });
    });
});
