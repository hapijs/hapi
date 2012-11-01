// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


describe('Request', function () {

    var customErrorHandler = function (request) {

        request.reply(Hapi.error.passThrough(599, 'heya', 'text/plain'));
    };

    var server = new Hapi.Server('0.0.0.0', 18085);
    server.addRoutes([
        { method: 'GET', path: '/custom', config: { handler: customErrorHandler } },
    ]);

    var makeRequest = function (path, callback) {

        var next = function (res) {

            return callback(res);
        };

        server.inject({
            method: 'GET',
            url: path
        }, next);
    }

    function parseHeaders(res) {

        var headersObj = {};
        var headers = res._header.split('\r\n');
        for (var i = 0, il = headers.length; i < il; i++) {
            var header = headers[i].split(':');
            var headerValue = header[1] ? header[1].trim() : '';
            headersObj[header[0]] = headerValue;
        }

        return headersObj;
    }

    it('returns custom error response', function (done) {

        makeRequest('/custom', function (rawRes) {

            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Content-Type']).to.equal('text/plain');
            done();
        });
    });
});