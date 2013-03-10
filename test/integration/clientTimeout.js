// Load modules

var Lab = require('lab');
var Http = require('http');
var Stream = require('stream');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Client Timeout', function () {

    var fastHandler = function (request) {

        request.reply('Fast');
    };

    var directHandler = function (request) {

        var response = new Hapi.Response.Raw(request)
            .created('me')
            .type('text/plain')
            .bytes(13)
            .ttl(1000);

        response.begin(function (err) {

            response.write('!hola ')
                    .write('amigos!');

            setTimeout(function () {

                request.reply(response);
            }, 55);
        });
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

    describe('with timeout set', function () {

        var _server = new Hapi.Server('127.0.0.1', 0, { timeout: { client: 50 } });
        _server.route([
            { method: 'POST', path: '/fast', config: { handler: fastHandler } },
            { method: 'GET', path: '/direct', config: { handler: directHandler } },
            { method: 'GET', path: '/stream', config: { handler: streamHandler } }
        ]);

        before(function (done) {

            _server.start(done);
        });

        it('returns client error message when client request taking too long', function (done) {

            var timer = new Hapi.utils.Timer();
            var options = {
                hostname: '127.0.0.1',
                port: _server.settings.port,
                path: '/fast',
                method: 'POST'
            };


            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(408);
                expect(timer.elapsed()).to.be.at.least(49);
                done();
            });

            req.on('error', function (err) {                    // Will error out, so don't allow error to escape test

            });

            req.write('\n');
            setTimeout(function () {

                req.end();
            }, 100);
        });

        it('doesn\'t return a client error message when client request is fast', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: _server.settings.port,
                path: '/fast',
                method: 'POST'
            };


            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });

            req.end();
        });

        it('doesn\'t return a client error message when response is direct type', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: _server.settings.port,
                path: '/direct',
                method: 'GET'
            };


            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(201);
                done();
            });

            req.end();
        });

        it('doesn\'t return a client error message when response is taking a long time to send', function (done) {

            var timer = new Hapi.utils.Timer();
            var options = {
                hostname: '127.0.0.1',
                port: _server.settings.port,
                path: '/stream',
                method: 'GET'
            };

            var req = Http.request(options, function (res) {

                expect(timer.elapsed()).to.be.at.least(59);
                expect(res.statusCode).to.equal(200);
                done();
            });

            req.once('error', function (err) {

                done();
            });

            req.end();
        });
    });

    describe('with timeout disabled', function () {

        var _server = new Hapi.Server('127.0.0.1', 0, { timeout: { client: false } });
        _server.route([
            { method: 'POST', path: '/fast', config: { handler: fastHandler } }
        ]);

        before(function (done) {

            _server.start(done);
        });

        it('client doesn\'t return an error', function (done) {

            var timer = new Hapi.utils.Timer();
            var options = {
                hostname: '127.0.0.1',
                port: _server.settings.port,
                path: '/fast',
                method: 'POST'
            };


            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(timer.elapsed()).to.be.at.least(99);
                done();
            });

            setTimeout(function () {

                req.end();
            }, 100);
        });
    });
});