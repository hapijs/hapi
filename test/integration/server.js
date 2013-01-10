// Load modules

var Chai = require('chai');
var Http = require('http');
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

    var server = new Hapi.Server('127.0.0.1', 21999, { timeout: { server: 50 } });
    server.addRoutes([
        { method: 'GET', path: '/timeout', config: { handler: timeoutHandler } },
        { method: 'GET', path: '/slow', config: { handler: slowHandler } },
        { method: 'GET', path: '/fast', config: { handler: fastHandler } }
    ]);

    var serverClientTimeout = new Hapi.Server('127.0.0.1', 21998, { timeout: { client: 50 } });
    serverClientTimeout.addRoutes([
        { method: 'POST', path: '/fast', config: { handler: fastHandler } }
    ]);

    var serverClientNoTimeout = new Hapi.Server('127.0.0.1', 21997, { timeout: { client: false } });
    serverClientNoTimeout.addRoutes([
        { method: 'POST', path: '/fast', config: { handler: fastHandler } }
    ]);

    before(function (done) {

        serverClientTimeout.start(function () {

            serverClientNoTimeout.start(done);
        });
    });

    it('returns server error message when server taking too long', function (done) {

        var timer = new Hapi.utils.Timer();

        server.inject({ method: 'GET', url: '/timeout' }, function (res) {

            expect(res.statusCode).to.equal(503);
            expect(timer.elapsed()).to.be.at.least(49);
            done();
        });
    });

    it('doesn\'t return an error response when server is slow but faster than timerout', function (done) {

        var timer = new Hapi.utils.Timer();
        server.inject({ method: 'GET', url: '/slow' }, function (res) {

            expect(timer.elapsed()).to.be.at.least(29);
            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('doesn\'t return an error response when server takes less than timeout to respond', function (done) {

        server.inject({ method: 'GET', url: '/fast' }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
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

    it('client timeout can be disabled', function (done) {

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