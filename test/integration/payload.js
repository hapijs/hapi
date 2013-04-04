// Load modules

var Lab = require('lab');
var Request = require('request');
var Fs = require('fs');
var Http = require('http');
var Path = require('path');
var Stream = require('stream');
var Zlib = require('zlib');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Payload', function () {

    describe('raw mode', function () {

        it('returns an error on req socket error', function (done) {

            var handler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

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
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { close: true } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(500);
                done();
            });
        });

        it('returns a raw body', function (done) {

            var payload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody.toString()).to.equal(payload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: payload }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(payload);
                done();
            });
        });

        it('returns a parsed body and sets a raw body', function (done) {

            var payload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.exist;
                expect(request.payload.z).to.equal('3');
                expect(request.rawBody.toString()).to.equal(payload);
                request.reply(request.payload);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: payload }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.x).to.equal('1');
                done();
            });
        });

        it('doesn\'t set the request payload when the request is interrupted and its streaming', function (done) {

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                request.reply('Success');
            };

            var server = new Hapi.Server('0.0.0.0', 0);
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            var s = new Stream.PassThrough();

            server.start(function () {

                var options = {
                    hostname: 'localhost',
                    port: server.settings.port,
                    path: '/',
                    method: 'POST'
                };

                var iv = setInterval(function () {

                    s.write('Hello');
                }, 5);

                var req = Http.request(options, function (res) {

                });

                req.on('error', function (err) {

                    expect(err.code).to.equal('ECONNRESET');
                    done();
                });

                s.pipe(req);

                setTimeout(function () {

                    req.abort();
                    clearInterval(iv);
                }, 15);
            });
        });

        it('doesn\'t set the request payload when the request is interrupted', function (done) {

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                request.reply('Success');
            };

            var server = new Hapi.Server('0.0.0.0', 0);
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.start(function () {

                var options = {
                    hostname: 'localhost',
                    port: server.settings.port,
                    path: '/',
                    method: 'POST',
                    headers: {
                        'Content-Length': '10'
                    }
                };

                var req = Http.request(options, function (res) {

                });

                req.write('Hello\n');

                req.on('error', function (err) {

                    expect(err.code).to.equal('ECONNRESET');
                    done();
                });

                setTimeout(function () {

                    req.abort();
                }, 15);
            });
        });

        it('returns the correct raw body when content-length is smaller than payload', function (done) {

            var payload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody.toString()).to.equal(payload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'Content-Length': '5' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(payload);
                done();
            });
        });

        it('returns the correct raw body when content-length is larger than payload', function (done) {

            var payload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody.toString()).to.equal(payload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'Content-Length': '500' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(payload);
                done();
            });
        });
    });

    describe('stream mode', function () {

        var handler = function (request) {

            expect(request.payload).to.not.exist;
            request.reply('Success');
        };

        var server = new Hapi.Server('localhost', 0);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'stream' } });

        before(function (done) {

            server.start(done);
        });

        it('doesn\'t set the request payload when streaming data in and the connection is interrupted', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.settings.port,
                path: '/',
                method: 'POST'
            };

            var s = new Stream.PassThrough();

            var iv = setInterval(function () {

                s.write('Hello');
            }, 5);

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });

            req.on('error', function () {

            });

            s.pipe(req);

            setTimeout(function () {

                req.abort();
                clearInterval(iv);
            }, 25);
        });
    });

    describe('parse mode', function () {

        var handler = function (request) {

            request.reply(request.payload.key);
        };

        var server = new Hapi.Server('localhost', 0, { timeout: { client: 50 } });
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'parse' } });

        before(function (done) {

            server.start(done);
        });

        var TestStream = function () {

            Stream.Readable.call(this);
        };

        Hapi.utils.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            this.push('{ "key": "value" }');
            this.push(null);
        };

        it('sets the request payload with the streaming data', function (done) {

            var options = {
                uri: 'http://localhost:' + server.settings.port + '/?x=1',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            var req = Request(options, function (err, res, body) {

                expect(res.statusCode).to.equal(200);
                expect(body).to.equal('value');
                done();
            });

            var s = new TestStream();
            s.pipe(req);
        });

        it('times out when the request content-length is larger than payload', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.settings.port,
                path: '/?x=2',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '100'
                }
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(408);
                done();
            });

            req.end('{ "key": "value" }');
        });

        it('resets connection when the request content-length is smaller than payload', function (done) {

            var options = {
                uri: 'http://localhost:' + server.settings.port + '/?x=3',
                body: '{ "key": "value" }',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '1'
                }
            };

            Request(options, function (err, res, body) {

                expect(err.message).to.equal('socket hang up');
                done();
            });
        });

        it('returns an error on unsupported mime type', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.settings.port,
                path: '/?x=4',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/unknown',
                    'Content-Length': '18'
                }
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });

            req.end('{ "key": "value" }');
        });

        it('returns 200 on text mime type', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.settings.port,
                path: '/?x=5',
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': '18'
                }
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });

            req.end('{ "key": "value" }');
        });
    });

    describe('unzip', function () {

        it('returns an error on malformed payload', function (done) {

            var payload = '7d8d78347h8347d58w347hd58w374d58w37h5d8w37hd4';

            var handler = function () {

                throw new Error('never called');
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'content-encoding': 'gzip' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });

        it('doesn\'t return an error when the payload has the correct gzip header and gzipped payload', function (done) {

            var payload = '{"hi":"hello"}';

            Zlib.gzip(payload, function (err, result) {

                var handler = function () {

                   this.reply('Success');
                };

                var server = new Hapi.Server();
                server.route({ method: 'POST', path: '/', config: { handler: handler } });

                server.inject({ method: 'POST', url: '/', payload: result, headers: { 'content-encoding': 'gzip' } }, function (res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
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

        var _server = new Hapi.Server('0.0.0.0', 0);
        _server.route({ method: 'POST', path: '/invalid', handler: invalidHandler });
        _server.route({ method: 'POST', path: '/echo', handler: echo });

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

            var server = new Hapi.Server('0.0.0.0', 0);
            server.route({ method: 'POST', path: '/file', config: { handler: fileHandler } });
            server.start(function () {

                var r = Request.post(server.settings.uri + '/file');
                var form = r.form();
                form.append('my_file', file);
            });
        });
    });
});
