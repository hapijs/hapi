// Load modules

var Lab = require('lab');
var Http = require('http');
var Stream = require('stream');
var Hapi = require('..');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Client Timeout', function () {

    it('returns client error message when client request taking too long', function (done) {

        var server = new Hapi.Server(0, { timeout: { client: 50 } });
        server.route({ method: 'POST', path: '/fast', config: { handler: function (request, reply) { reply('fast'); } } });
        server.start(function () {

            var timer = new Hoek.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/fast',
                method: 'POST'
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(408);
                expect(timer.elapsed()).to.be.at.least(49);
                done();
            });

            req.on('error', function (err) { });                    // Will error out, so don't allow error to escape test

            req.write('{}\n');
            var now = Date.now();
            setTimeout(function () {

                req.end();
            }, 100);
        });
    });

    it('does not return a client error message when client request is fast', function (done) {

        var server = new Hapi.Server(0, { timeout: { client: 50 } });
        server.route({ method: 'POST', path: '/fast', config: { handler: function (request, reply) { reply('fast'); } } });
        server.start(function () {

            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
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

    it('does not return a client error message when response is taking a long time to send', function (done) {

        var streamHandler = function (request, reply) {

            var TestStream = function () {

                Stream.Readable.call(this);
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                var self = this;

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                setTimeout(function () {

                    self.push('Hello');
                }, 60);

                setTimeout(function () {

                    self.push(null);
                }, 70);
            };

            reply(new TestStream());
        };

        var server = new Hapi.Server(0, { timeout: { client: 50 } });
        server.route({ method: 'GET', path: '/', config: { handler: streamHandler } });
        server.start(function () {

            var timer = new Hoek.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/',
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

    it('does not return an error with timeout disabled', function (done) {

        var server = new Hapi.Server(0, { timeout: { client: false } });
        server.route({ method: 'POST', path: '/', config: { handler: function (request, reply) { reply('fast'); } } });

        server.start(function () {

            var timer = new Hoek.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/',
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
        })
    });
});