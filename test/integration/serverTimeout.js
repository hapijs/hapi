// Load modules

var Chai = require('chai');
var Http = require('http');
var NodeUtil = require('util');
var Stream = require('stream');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Server Timeout', function () {

    var timeoutHandler = function (request) {

    };

    var cachedTimeoutHandler = function (request) {

        var reply = request.reply;
        setTimeout(function () {

            reply.bind(request, new Hapi.Response.Text('Cached'));
        }, 70);
    };

    var slowHandler = function (request) {

        setTimeout(function () {

            request.reply('Slow');
        }, 30);
    };

    var fastHandler = function (request) {

        request.reply('Fast');
    };

    var directHandler = function (request) {

        var response = new Hapi.Response.Direct(request)
            .created('me')
            .type('text/plain')
            .bytes(13)
            .ttl(1000)
            .write('!hola ')
            .write('amigos!');

        setTimeout(function () {

            request.reply(response);
        }, 55);
    };

    var streamHandler = function (request) {

        var s = new Stream();
        s.readable = true;

        s.resume = function () {

            setTimeout(function () {

                s.emit('data', 'Hello');
            }, 60);

            setTimeout(function () {

                s.emit('end');
            }, 70);
        };

        request.reply.stream(s).send();
    };

    var _server = new Hapi.Server('127.0.0.1', 0, { timeout: { server: 50 }, cache: { engine: 'memory' } });
    _server.addRoutes([
        { method: 'GET', path: '/timeout', config: { handler: timeoutHandler } },
        { method: 'GET', path: '/timeoutcache', config: { handler: cachedTimeoutHandler } },
        { method: 'GET', path: '/slow', config: { handler: slowHandler } },
        { method: 'GET', path: '/fast', config: { handler: fastHandler } },
        { method: 'GET', path: '/direct', config: { handler: directHandler } },
        { method: 'GET', path: '/stream', config: { handler: streamHandler } }
    ]);

    before(function (done) {

        _server.start(done);
    });

    it('returns server error message when server taking too long', function (done) {

        var timer = new Hapi.utils.Timer();

        _server.inject({ method: 'GET', url: '/timeout' }, function (res) {

            expect(res.statusCode).to.equal(503);
            expect(timer.elapsed()).to.be.at.least(49);
            done();
        });
    });

    it('doesn\'t return an error response when server is slow but faster than timeout', function (done) {

        var timer = new Hapi.utils.Timer();
        _server.inject({ method: 'GET', url: '/slow' }, function (res) {

            expect(timer.elapsed()).to.be.at.least(29);
            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('doesn\'t return an error response when server is slower than timeout but response has started', function (done) {

        var options = {
            hostname: '127.0.0.1',
            port: _server.settings.port,
            path: '/stream',
            method: 'GET'
        };

        var timer = new Hapi.utils.Timer();
        var req = Http.request(options, function (res) {

            expect(timer.elapsed()).to.be.at.least(59);
            expect(res.statusCode).to.equal(200);
            done();
        });
        req.end();
    });

    it('doesn\'t return an error response when server takes less than timeout to respond', function (done) {

        _server.inject({ method: 'GET', url: '/fast' }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('response timeouts aren\'t cached on subsequent requests', function (done) {

        var timer = new Hapi.utils.Timer();
        _server.inject({ method: 'GET', url: '/timeoutcache' }, function (res1) {

            expect(timer.elapsed()).to.be.at.least(49);
            expect(res1.statusCode).to.equal(503);

            _server.inject({ method: 'GET', url: '/timeoutcache' }, function (res2) {

                expect(timer.elapsed()).to.be.at.least(98);
                expect(res2.statusCode).to.equal(503);
                done();
            });
        });
    });

    it('doesn\'t return an error when handling a direct response that takes longer than timeout', function (done) {

        _server.inject({ method: 'GET', url: '/direct' }, function (res) {

            expect(res.statusCode).to.equal(201);
            expect(res.readPayload()).to.equal('!hola amigos!');
            done();
        });
    });
});

describe('Server and Client timeouts', function () {

    var timeoutHandler = function (request) {

    };

    var cachedTimeoutHandler = function (request) {

        var reply = request.reply;
        setTimeout(function () {

            reply.bind(request, new Hapi.Response.Text('Cached'));
        }, 70);
    };

    var _server = new Hapi.Server('127.0.0.1', 0, { timeout: { server: 50, client: 50 }, cache: { engine: 'memory' } });
    _server.addRoutes([
        { method: 'POST', path: '/timeout', config: { handler: timeoutHandler } },
        { method: 'POST', path: '/timeoutcache', config: { handler: cachedTimeoutHandler } }
    ]);

    before(function (done) {

        _server.start(done);
    });

    it('are returned when both client and server timeouts are the same and the client times out', function (done) {

        var timer = new Hapi.utils.Timer();
        var options = {
            hostname: '127.0.0.1',
            port: _server.settings.port,
            path: '/timeout',
            method: 'POST'
        };


        var req = Http.request(options, function (res) {

            expect([503, 408]).to.contain(res.statusCode);
            expect(timer.elapsed()).to.be.at.least(49);
            done();
        });

        req.write('\n');
        setTimeout(function() {

            req.end();
        }, 100);
    });

    it('initial long running requests don\'t prevent server timeouts from occuring on future requests', function (done) {

        var timer = new Hapi.utils.Timer();
        var options = {
            hostname: '127.0.0.1',
            port: _server.settings.port,
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

            req2.end();
        });

        req1.write('\n');
        setTimeout(function() {

            req1.end();
        }, 100);
    });
});