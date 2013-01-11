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


describe('Server', function () {

    var timeoutHandler = function (request) {

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

    describe('response timeout', function () {

        var server = new Hapi.Server('127.0.0.1', 21999, { timeout: { server: 50 } });
        server.addRoutes([
            { method: 'GET', path: '/timeout', config: { handler: timeoutHandler } },
            { method: 'GET', path: '/slow', config: { handler: slowHandler } },
            { method: 'GET', path: '/fast', config: { handler: fastHandler } },
            { method: 'GET', path: '/direct', config: { handler: directHandler } },
            { method: 'GET', path: '/stream', config: { handler: streamHandler } }
        ]);

        before(function (done) {

            server.start(done);
        });

        it('returns server error message when server taking too long', function (done) {

            var timer = new Hapi.utils.Timer();

            server.inject({ method: 'GET', url: '/timeout' }, function (res) {

                expect(res.statusCode).to.equal(503);
                expect(timer.elapsed()).to.be.at.least(49);
                done();
            });
        });

        it('doesn\'t return an error response when server is slow but faster than timeout', function (done) {

            var timer = new Hapi.utils.Timer();
            server.inject({ method: 'GET', url: '/slow' }, function (res) {

                expect(timer.elapsed()).to.be.at.least(29);
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('doesn\'t return an error response when server is slower than timeout but response has started', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: 21999,
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

            server.inject({ method: 'GET', url: '/fast' }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('doesn\'t return an error when handling a direct response that takes longer than timeout', function (done) {

            server.inject({ method: 'GET', url: '/direct' }, function (res) {

                expect(res.statusCode).to.equal(201);
                expect(res.readPayload()).to.equal('!hola amigos!');
                done();
            });
        });
    });

    describe('request timeout', function () {

        describe('with timeout set', function () {

            var server = new Hapi.Server('127.0.0.1', 21998, { timeout: { client: 50 } });
            server.addRoutes([
                { method: 'POST', path: '/fast', config: { handler: fastHandler } }
            ]);

            before(function (done) {

                server.start(done);
            });

            it('returns client error message when client request taking too long', function (done) {

                var timer = new Hapi.utils.Timer();
                var options = {
                    hostname: '127.0.0.1',
                    port: 21998,
                    path: '/fast',
                    method: 'POST'
                };


                var req = Http.request(options, function (res) {

                    expect(res.statusCode).to.equal(408);
                    expect(timer.elapsed()).to.be.at.least(49);
                    done();
                });

                req.write('\n');
                setTimeout(function() {

                    req.end();
                }, 100);
            });

            it('doesn\'t return a client error message when client request is fast', function (done) {

                var timer = new Hapi.utils.Timer();
                var options = {
                    hostname: '127.0.0.1',
                    port: 21998,
                    path: '/fast',
                    method: 'POST'
                };


                var req = Http.request(options, function (res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });

                req.end();
            });
        });

        describe('with timeout disabled', function () {

            var server = new Hapi.Server('127.0.0.1', 21997, { timeout: { client: false } });
            server.addRoutes([
                { method: 'POST', path: '/fast', config: { handler: fastHandler } }
            ]);

            before(function (done) {

                server.start(done);
            });

            it('client doesn\'t return an error', function (done) {

                var timer = new Hapi.utils.Timer();
                var options = {
                    hostname: '127.0.0.1',
                    port: 21997,
                    path: '/fast',
                    method: 'POST'
                };


                var req = Http.request(options, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(timer.elapsed()).to.be.at.least(99);
                    done();
                });

                setTimeout(function() {

                    req.end();
                }, 100);
            });
        });
    });
});