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

            var multipartPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody).to.equal(multipartPayload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

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
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload }, function (res) {

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

            var s = new Stream();
            s.readable = true;

            server.start(function () {

                var options = {
                    hostname: '127.0.0.1',
                    port: server.settings.port,
                    path: '/',
                    method: 'POST'
                };

                var iv = setInterval(function () {

                    s.emit('data', 'Hello');
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
                    hostname: '127.0.0.1',
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

            var multipartPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody).to.equal(multipartPayload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload, headers: { 'Content-Length': '5' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(multipartPayload);
                done();
            });
        });

        it('returns the correct raw body when content-length is larger than payload', function (done) {

            var multipartPayload = '{"x":"1","y":"2","z":"3"}';

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawBody).to.equal(multipartPayload);
                request.reply(request.rawBody);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'raw' } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload, headers: { 'Content-Length': '500' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result).to.equal(multipartPayload);
                done();
            });
        });
    });

    describe('stream mode', function () {

        var handler = function (request) {

            expect(request.payload).to.not.exist;
            request.reply('Success');
        };

        var server = new Hapi.Server('127.0.0.1', 0);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'stream' } });

        before(function (done) {

            server.start(done);
        });

        it('doesn\'t set the request payload when streaming data in and the connection is interrupted', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: server.settings.port,
                path: '/',
                method: 'POST'
            };

            var s = new Stream();
            s.readable = true;

            var iv = setInterval(function () {

                s.emit('data', 'Hello');
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

            expect(request.payload.key).to.equal('value');
            request.reply('Success');
        };

        var server = new Hapi.Server('127.0.0.1', 0, { timeout: { client: 50 } });
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'parse' } });

        before(function (done) {

            server.start(done);
        });

        it('sets the request payload with the streaming data', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: server.settings.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            var s = new Stream();
            s.readable = true;

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(200);
                res.on('data', function (data) {

                    expect(data.toString()).to.equal('Success');
                    done();
                });
            });

            s.pipe(req);
            s.emit('data', '{ "key": "value" }');
            req.end();
        });

        it('times out when the request content-length is larger than payload', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: server.settings.port,
                path: '/',
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

        it('returns a 400 status code when the request content-length is smaller than payload', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: server.settings.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '1'
                }
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });

            req.end('{ "key": "value" }');
        });

        it('returns an error on unsupported mime type', function (done) {

            var options = {
                hostname: '127.0.0.1',
                port: server.settings.port,
                path: '/',
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
                hostname: '127.0.0.1',
                port: server.settings.port,
                path: '/',
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

        it('returns a 400 status code when the request payload is streaming data with content-length being too small', function (done) {

            var s = new Stream();
            s.readable = true;

            var options = {
                uri: 'http://127.0.0.1:' + server.settings.port + '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '1'
                }
            };

            var req = Request(options, function (err, res) {

                expect(res.statusCode).to.equal(400);
                done();
            });

            s.pipe(req);
            s.emit('data', '{ "key": "value" }');
            req.end();
        });

        it('returns a 200 status code when the request payload is streaming data with content-length being smaller than payload but payload truncates to a valid value ', function (done) {

            var s = new Stream();
            s.readable = true;

            var options = {
                uri: 'http://127.0.0.1:' + server.settings.port + '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '18'
                }
            };

            var req = Request(options, function (err, res) {

                expect(res.statusCode).to.equal(200);
                done();
            });

            s.pipe(req);
            s.emit('data', '{ "key": "value" } garbage here');
            req.end();
        });
    });

    describe('unzip', function () {

        it('returns an error on malformed payload', function (done) {

            var multipartPayload = '7d8d78347h8347d58w347hd58w374d58w37h5d8w37hd4';

            var handler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload, headers: { 'content-encoding': 'gzip' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.code).to.equal(400);
                done();
            });
        });

        it('doesn\'t return an error when the payload has the correct gzip header and gzipped payload', function (done) {

            var multipartPayload = '{"hi":"hello"}';

            Zlib.gzip(multipartPayload, function (err, result) {

                var handler = function (request) {

                   request.reply('Success');
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
