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
            }, 60);

            setTimeout(function () {

                self.push(null);
            }, 70);
        };

        reply(new TestStream());
    };

    describe('with timeout set', function () {

        var _server = new Hapi.Server('127.0.0.1', 0, { timeout: { client: 50 } });
        _server.route([
            { method: 'POST', path: '/fast', config: { handler: fastHandler } },
            { method: 'GET', path: '/stream', config: { handler: streamHandler } }
        ]);

        before(function (done) {

            _server.start(done);
        });

        it('returns client error message when client request taking too long', function (done) {

            var timer = new Hapi.utils.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: _server.info.port,
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

        it('does not return a client error message when client request is fast', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: _server.info.port,
                path: '/fast',
                method: 'POST'
            };


            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });

            req.end();
        });

        it('does not return a client error message when response is taking a long time to send', function (done) {

            var timer = new Hapi.utils.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: _server.info.port,
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

        it('client does not return an error', function (done) {

            var timer = new Hapi.utils.Bench();
            var options = {
                hostname: '127.0.0.1',
                port: _server.info.port,
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