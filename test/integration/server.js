// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Server', function () {

    var timeoutHandler = function (request) {

    };

    var fastHandler = function (request) {

        request.reply('Fast');
    };

    var server = new Hapi.Server({ timeout: 5 });
    server.addRoutes([
        { method: 'GET', path: '/timeout', config: { handler: timeoutHandler } },
        { method: 'GET', path: '/fast', config: { handler: fastHandler } }
    ]);

    var makeRequest = function (method, path, callback) {

        var next = function (res) {

            return callback(res);
        };

        server.inject({
            method: method,
            url: path
        }, next);
    };

    it('returns error response when server taking too long', function (done) {

        makeRequest('GET', '/timeout', function (res) {

            expect(res.statusCode).to.equal(503);
            done();
        });
    });

    it('doesn\'t return an error response when server takes less than timeout to respond', function (done) {

        makeRequest('GET', '/fast', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });
});