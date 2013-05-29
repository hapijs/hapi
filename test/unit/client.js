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
    });
});
