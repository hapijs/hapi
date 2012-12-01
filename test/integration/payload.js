// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Payload', function () {

    describe('raw mode', function () {

        it('returns a raw body', function (done) {

            var rawPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody).to.equal(rawPayload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: rawPayload }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(rawPayload);
                done();
            });
        });

        it('returns a parsed body and sets a raw body', function (done) {

            var rawPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.exist;
                expect(request.payload.z).to.equal('3');
                expect(request.rawBody).to.equal(rawPayload);
                request.reply(request.payload);
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: rawPayload }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.x).to.equal('1');
                done();
            });
        });
    });

    describe('unzip', function () {
        
        it('returns an error on malformed gzip payload', function (done) {

            var rawPayload = '7d8d78347h8347d58w347hd58w374d58w37h5d8w37hd4';

            var handler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.addRoute({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: rawPayload, headers: { 'content-encoding': 'gzip' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });
    });
});
