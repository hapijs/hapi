// Load modules

var expect = require('chai').expect;
var Fs = require('fs');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


describe('Multipart Request', function () {

    var echo = function (request) {

        request.reply(request.payload);
    };

    var multiPartPayload =
        'This is the preamble.  It is to be ignored, though it\r\n' +
            'is a handy place for mail composers to include an\r\n' +
            'explanatory note to non-MIME compliant readers.\r\n' +
            '--simple boundary\r\n' +
            '\r\n' +
            'blah' +
            '\r\n' +
            '--simple boundary\r\n' +
            'Content-type: text/plain; charset=us-ascii\r\n' +
            '\r\n' +
            'blah2' +
            '\r\n' +
            '--simple boundary--\r\n' +
            'This is the epilogue.  It is also to be ignored.\r\n';

    var server = new Hapi.Server('0.0.0.0', 18097);
    server.addRoutes([
        { method: 'POST', path: '/', config: { handler: echo, payload: 'parse' } }
    ]);

    var makeRequest = function (payload, callback) {

        var next = function (res) {

            return callback(res);
        };

        server.inject({
            method: 'POST',
            url: '/',
            headers: { 'content-type': 'multipart/form-data; boundary=simple boundary' },
            payload: payload
        }, next);
    };

    it('returns parsed multipart data', function (done) {

        makeRequest(multiPartPayload, function (rawRes) {

            expect(rawRes.result).to.exist;
            expect(rawRes.result.length).to.equal(2);
            done();
        });
    });
});