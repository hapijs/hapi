// Load modules

var Lab = require('lab');
var Http = require('http');
var Stream = require('stream');
var Request = require('request');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Server Timeout', function () {

    var timeoutHandler = function (request) {

    };

    var cachedTimeoutHandler = function (request) {

        var reply = request.reply;
        setTimeout(function () {

            reply.bind(request, new Hapi.response.Text('Cached'));
        }, 70);
    };

    var slowHandler = function (request) {

        setTimeout(function () {

            request.reply('Slow');
        }, 30);
    };

    var respondingHandler = function (request) {

        var s = new Stream.PassThrough();
        request.reply(s);

        for (var i = 10000; i > 0; --i) {
            s.write(i.toString());
        }

        setTimeout(function () {

            s.emit('end');
        }, 40);
    };

    var fastHandler = function (request) {

        request.reply('Fast');
    };

    var streamHandler = function (request) {

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

        request.reply(new TestStream());
    };

    var server = new Hapi.Server(0, { timeout: { server: 50 } });
    server.route([
        { method: 'GET', path: '/timeout', config: { handler: timeoutHandler } },
        { method: 'GET', path: '/timeoutcache', config: { handler: cachedTimeoutHandler } },
        { method: 'GET', path: '/slow', config: { handler: slowHandler } },
        { method: 'GET', path: '/fast', config: { handler: fastHandler } },
        { method: 'GET', path: '/stream', config: { handler: streamHandler } },
        { method: 'GET', path: '/responding', config: { handler: respondingHandler } }
    ]);

    before(function (done) {

        server.start(done);
    });

    it('returns server error message when server taking too long', function (done) {

        var timer = new Hapi.utils.Timer();

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

    it('doesn\'t return an error response when server is slow but faster than timeout', function (done) {

        var timer = new Hapi.utils.Timer();
        server.inject('/slow', function (res) {

            expect(timer.elapsed()).to.be.at.least(29);
            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('doesn\'t return an error when server is responding when the timeout occurs', function (done) {

        var timer = new Hapi.utils.Timer();

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

    it('doesn\'t return an error response when server is slower than timeout but response has started', function (done) {

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

    it('doesn\'t return an error response when server takes less than timeout to respond', function (done) {

        server.inject('/fast', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('response timeouts aren\'t cached on subsequent requests', function (done) {

        var timer = new Hapi.utils.Timer();
        server.inject('/timeoutcache', function (res1) {

            expect(timer.elapsed()).to.be.at.least(49);
            expect(res1.statusCode).to.equal(503);

            server.inject('/timeoutcache', function (res2) {

                expect(timer.elapsed()).to.be.at.least(98);
                expect(res2.statusCode).to.equal(503);
                done();
            });
        });
    });
});

describe('Server and Client timeouts', function () {

    var timeoutHandler = function (request) {

    };

    var cachedTimeoutHandler = function (request) {

        var reply = request.reply;
        setTimeout(function () {

            reply.bind(request, new Hapi.response.Text('Cached'));
        }, 70);
    };

    var server = new Hapi.Server('127.0.0.1', 0, { timeout: { server: 50, client: 50 } });
    server.route([
        { method: 'POST', path: '/timeout', config: { handler: timeoutHandler } },
        { method: 'POST', path: '/timeoutcache', config: { handler: cachedTimeoutHandler } }
    ]);

    before(function (done) {

        server.start(done);
    });

    it('are returned when both client and server timeouts are the same and the client times out', function (done) {

        var timer = new Hapi.utils.Timer();
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

    it('initial long running requests don\'t prevent server timeouts from occuring on future requests', function (done) {

        var timer = new Hapi.utils.Timer();
        var options = {
            hostname: '127.0.0.1',
            port: server.info.port,
            path: '/timeoutcache',
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

describe('Socket timeout', function () {

    var server = new Hapi.Server('0.0.0.0', 0, { timeout: { client: 45, socket: 50 } });
    server.route({
        method: 'GET', path: '/', config: {
            handler: function (request) {

                setTimeout(function () {

                    request.reply('too late');
                }, 70);
            }
        }
    });

    var port = 0;
    before(function (done) {

        server.start(function () {

            port = server.info.port;
            done();
        });
    });

    it('closes connection on socket timeout', function (done) {

        Request('http://localhost:' + port + '/', function (err, response, body) {

            expect(err).to.exist;
            expect(err.message).to.equal('socket hang up');
            done();
        });
    });
});
