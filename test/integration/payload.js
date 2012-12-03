// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Payload', function () {

    describe('raw mode', function () {

        it('returns an error on req socket error', function (done) {

            var handler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { error: true } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns an error on req socket close', function (done) {

            var handler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { close: true } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns a raw body', function (done) {

            var multipartPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody).to.equal(multipartPayload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(multipartPayload);
                done();
            });
        });

        it('returns a parsed body and sets a raw body', function (done) {

            var multipartPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.exist;
                expect(request.payload.z).to.equal('3');
                expect(request.rawBody).to.equal(multipartPayload);
                request.reply(request.payload);
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.x).to.equal('1');
                done();
            });
        });
    });

    describe('unzip', function () {
        
        it('returns an error on malformed payload', function (done) {

            var multipartPayload = '7d8d78347h8347d58w347hd58w374d58w37h5d8w37hd4';

            var handler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload, headers: { 'content-encoding': 'gzip' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });
    });

    describe('multi-part', function () {

        var invalidHandler = function (request) {

            expect(request).to.not.exist;       // Must not be called
        };

        var server = new Hapi.Server();
        server.addRoute({ method: 'POST', path: '/invalid', config: { handler: invalidHandler } });

        var multipartPayload =
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

        it('returns an error on missing boundary in content-type header', function (done) {

            server.inject({ method: 'POST', url: '/invalid', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });

        it('returns an error on empty separator in content-type header', function (done) {

            server.inject({ method: 'POST', url: '/invalid', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });

        var echo = function (request) {

            request.reply(request.payload);
        };

        server.addRoute({ method: 'POST', path: '/', config: { handler: echo } });

        it('returns parsed multipart data', function (done) {

            server.inject({ method: 'POST', url: '/', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=simple boundary' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.length).to.equal(2);
                done();
            });
        });

        var invalidPayload =
            '--simple boundary\r\n' +
            'blah' +
            '\r\n';

        it('returns an error on bad payload', function (done) {

            server.inject({ method: 'POST', url: '/invalid', payload: invalidPayload, headers: { 'content-type': 'multipart/form-data; boundary=simple boundary' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });
    });
});
