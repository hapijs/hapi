// Load modules

var Chai = require('chai');
var Request = require('request');
var Fs = require('fs');
var Path = require('path');
var Hapi = require('../helpers');


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

        var echo = function (request) {

            request.reply(request.payload);
        };

        var _server = new Hapi.Server('0.0.0.0', 18991);
        _server.addRoute({ method: 'POST', path: '/invalid', handler: invalidHandler });
        _server.addRoute({ method: 'POST', path: '/echo', handler: echo });

        var multipartPayload =
                '--AaB03x\r\n' +
                'content-disposition: form-data; name="field1"\r\n' +
                '\r\n' +
                'Joe Blow\r\nalmost tricked you!\r\n' +
                '--AaB03x\r\n' +
                'content-disposition: form-data; name="field1"\r\n' +
                '\r\n' +
                'Repeated name segment\r\n' +
                '--AaB03x\r\n' +
                'content-disposition: form-data; name="pics"; filename="file1.txt"\r\n' +
                'Content-Type: text/plain\r\n' +
                '\r\n' +
                '... contents of file1.txt ...\r\r\n' +
                '--AaB03x--\r\n';

        it('returns an error on missing boundary in content-type header', function (done) {

            _server.inject({ method: 'POST', url: '/invalid', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });

        it('returns an error on empty separator in content-type header', function (done) {

            _server.inject({ method: 'POST', url: '/invalid', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });

        it('returns parsed multipart data', function (done) {

            _server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(Object.keys(res.result).length).to.equal(2);
                expect(res.result.field1).to.exist;
                expect(res.result.field1.length).to.equal(2);
                expect(res.result.field1[1]).to.equal('Repeated name segment');
                expect(res.result.pics).to.exist;
                done();
            });
        });

        it('parses a file correctly', function (done) {

            var file = Fs.readFileSync(Path.join(__dirname, '../../images/hapi.png'));
            var fileHandler = function (request) {

                expect(request.raw.req.headers['content-type']).to.contain('multipart/form-data');
                expect(request.payload['my_file']).to.contain('Photoshop');
                done();
            };

            var server = new Hapi.Server('0.0.0.0', 18990);
            server.addRoute({ method: 'POST', path: '/file', config: { handler: fileHandler } });
            server.start(function () {

                var r = Request.post('http://127.0.0.1:18990/file');
                var form = r.form();
                form.append('my_file', file);
            });
        });
    });
});
