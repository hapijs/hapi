// Load modules

var Lab = require('lab');
var Http = require('http');
var Boom = require('boom');
var Events = require('events');
var Client = require('../../lib/client');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Client', function () {

    describe('#parse', function () {

        it('handles errors with a boom response', function (done) {

            var res = new Events.EventEmitter();
            res.pipe = function () { };

            Client.parse(res, function (err) {

                expect(err).to.be.instanceOf(Boom);
                done();
            });

            res.emit('error', new Error('my error'));
        });

        it('handles responses that close early', function (done) {

            var res = new Events.EventEmitter();
            res.pipe = function () { };

            Client.parse(res, function (err) {

                expect(err).to.be.instanceOf(Boom);
                done();
            });

            res.emit('close');
        });
    });

    describe('#request', function () {

        it('handles request errors with a boom response', function (done) {

            var server = Http.createServer(function (req, res) {

                req.destroy();
                res.end();
            });

            server.once('listening', function () {

                Client.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, function (err) {

                    expect(err.data.err.code).to.equal('ECONNRESET');
                    done();
                });
            });

            server.listen(0);
        });

        it('handles request errors with a boom response when payload is being sent', function (done) {

            var server = Http.createServer(function (req, res) {

                req.destroy();
                res.end();
            });

            server.once('listening', function () {

                Client.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, function (err) {

                    expect(err.data.err.code).to.equal('ECONNRESET');
                    done();
                });
            });

            server.listen(0);
        });

        it('handles response errors with a boom response', function (done) {

            var server = Http.createServer(function (req, res) {

                res.destroy();
            });

            server.once('listening', function () {

                Client.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '' }, function (err) {

                    expect(err.data.err.code).to.equal('ECONNRESET');
                    done();
                });
            });

            server.listen(0);
        });

        it('handles errors when remote server is unavailable', function (done) {

            Client.request('get', 'http://127.0.0.1:0', { payload: '' }, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('handles a timeout during a socket close', function (done) {

            var server = Http.createServer(function (req, res) {

                req.once('error', function () { });
                res.once('error', function () { });

                setTimeout(function () {

                    req.destroy();
                }, 5);
            });

            server.once('error', function () { });

            server.once('listening', function () {

                Client.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '', timeout: 5 }, function (err) {

                    expect(err).to.exist;
                    server.close();

                    setTimeout(done, 5);
                });
            });

            server.listen(0);
        });

        it('handles an error after a timeout', function (done) {

            var server = Http.createServer(function (req, res) {

                req.once('error', function () { });
                res.once('error', function () { });

                setTimeout(function () {

                    res.socket.write('ERROR');
                }, 5);
            });

            server.once('error', function () { });

            server.once('listening', function () {

                Client.request('get', 'http://127.0.0.1:' + server.address().port, { payload: '', timeout: 5 }, function (err) {

                    expect(err).to.exist;
                    server.close();

                    setTimeout(done, 5);
                });
            });

            server.listen(0);
        });

        it('allows request without a callback', function (done) {

            var server = Http.createServer(function (req, res) {

                res.end('ok');
            });

            server.once('listening', function () {

                Client.request('get', 'http://127.0.0.1:' + server.address().port);
                done();
            });

            server.listen(0);
        });
    });
});
