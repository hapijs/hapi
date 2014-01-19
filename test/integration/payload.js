// Load modules

var Fs = require('fs');
var Http = require('http');
var Path = require('path');
var Stream = require('stream');
var Zlib = require('zlib');
var FormData = require('form-data');
var Lab = require('lab');
var Nipple = require('nipple');
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

    it('returns an error on req socket error', function (done) {

        var handler = function (request) {

            expect(request).to.not.exist;       // Must not be called
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { error: true, end: false } }, function (res) {

            expect(res.result).to.exist;
            expect(res.result.statusCode).to.equal(500);
            done();
        });
    });

    it('returns an error on req socket close', function (done) {

        var handler = function (request) {

            expect(request).to.not.exist;       // Must not be called
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { close: true, end: false } }, function (res) {

            expect(res.result).to.exist;
            expect(res.result.statusCode).to.equal(500);
            done();
        });
    });

    it('returns a raw body', function (done) {

        var payload = '{"x":"1","y":"2","z":"3"}';

        var handler = function (request, reply) {

            expect(request.payload.toString()).to.equal(payload);
            reply(request.payload);
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        server.inject({ method: 'POST', url: '/', payload: payload }, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal(payload);
            done();
        });
    });

    it('returns a parsed body and sets a raw body', function (done) {

        var payload = '{"x":"1","y":"2","z":"3"}';

        var handler = function (request, reply) {

            expect(request.payload).to.exist;
            expect(request.payload.z).to.equal('3');
            expect(request.mime).to.equal('application/json');
            reply(request.payload);
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.inject({ method: 'POST', url: '/', payload: payload }, function (res) {

            expect(res.result).to.exist;
            expect(res.result.x).to.equal('1');
            done();
        });
    });

    it('does not set the request payload when the request is interrupted and its streaming', function (done) {

        var handler = function (request, reply) {

            reply('Success');
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        var s = new Stream.PassThrough();

        server.start(function () {

            var options = {
                hostname: 'localhost',
                port: server.info.port,
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

    it('does not set the request payload when the request is interrupted', function (done) {

        var handler = function (request, reply) {

            reply('Success');
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        server.start(function () {

            var options = {
                hostname: 'localhost',
                port: server.info.port,
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

        var handler = function (request, reply) {

            expect(request.payload.toString()).to.equal(payload);
            reply(request.payload);
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'Content-Length': '5' } }, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal(payload);
            done();
        });
    });

    it('returns the correct raw body when content-length is larger than payload', function (done) {

        var payload = '{"x":"1","y":"2","z":"3"}';

        var handler = function (request, reply) {

            expect(request.payload.toString()).to.equal(payload);
            reply(request.payload);
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'Content-Length': '500' } }, function (res) {

            expect(res.result).to.exist;
            expect(res.result).to.equal(payload);
            done();
        });
    });

    it('errors on payload too big', function (done) {

        var payload = '{"x":"1","y":"2","z":"3"}';

        var handler = function (request, reply) {

            expect(request.payload.toString()).to.equal(payload);
            reply(request.payload);
        };

        var server = new Hapi.Server();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { maxBytes: 10 } } });

        server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'content-length': payload.length } }, function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.result).to.exist;
            expect(res.result.message).to.equal('Payload content length greater than maximum allowed: 10');
            done();
        });
    });

    it('peeks at unparsed data', function (done) {

        var data = null;
        var ext = function (request, reply) {

            var chunks = [];
            request.on('peek', function (chunk) {

                chunks.push(chunk);
            });

            request.once('finish', function () {

                data = Buffer.concat(chunks);
            });

            reply();
        };

        var handler = function (request, reply) {

            reply(data);
        };

        var server = new Hapi.Server();
        server.ext('onRequest', ext);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        var payload = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
        server.inject({ method: 'POST', url: '/', payload: payload }, function (res) {

            expect(res.result).to.equal(payload);
            done();
        });
    });

    describe('stream output', function () {

        var handler = function (request, reply) {

            reply('Success');
        };

        var server = new Hapi.Server('localhost', 0);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { output: 'stream' } } });

        before(function (done) {

            server.start(done);
        });

        it('does not set the request payload when streaming data in and the connection is interrupted', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.info.port,
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

    describe('file output', function () {

        var path = Path.join(__dirname, '../../images/hapi.png');
        var sourceContents = Fs.readFileSync(path);
        var stats = Fs.statSync(path);

        var compressed;
        before(function (done) {

            Zlib.gzip(sourceContents, function (err, result) {

                compressed = result;
                done()
            });
        });

        it('saves a file after content decoding', function (done) {

            var handler = function (request, reply) {

                var receivedContents = Fs.readFileSync(request.payload.path);
                expect(receivedContents).to.deep.equal(sourceContents);
                reply(request.payload.bytes);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file' } } });
            server.inject({ method: 'POST', url: '/file', payload: compressed, headers: { 'content-encoding': 'gzip' } }, function (res) {

                expect(res.result).to.equal(stats.size);
                done();
            });
        });

        it('saves a file before content decoding', function (done) {

            var path = Path.join(__dirname, '../../images/hapi.png');
            var sourceContents = Fs.readFileSync(path);
            var stats = Fs.statSync(path);

            var handler = function (request, reply) {

                var receivedContents = Fs.readFileSync(request.payload.path);
                expect(receivedContents).to.deep.equal(compressed);
                reply(request.payload.bytes);
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file', parse: false } } });
            server.inject({ method: 'POST', url: '/file', payload: compressed, headers: { 'content-encoding': 'gzip' } }, function (res) {

                expect(res.result).to.equal(compressed.length);
                done();
            });
        });

        it('errors saving a file with parse', function (done) {

            var handler = function (request, reply) { };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file', uploads: '/a/b/c/d/not' } } });
            server.inject({ method: 'POST', url: '/file', payload: 'abcde' }, function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('errors saving a file without parse', function (done) {

            var handler = function (request, reply) { };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file', parse: false, uploads: '/a/b/c/d/not' } } });
            server.inject({ method: 'POST', url: '/file', payload: 'abcde' }, function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('parse mode', function () {

        var handler = function (request, reply) {

            reply(request.payload.key);
        };

        var textHandler = function (request, reply) {

            reply(request.payload + '+456');
        };

        var server = new Hapi.Server('localhost', 0, { timeout: { client: 50 } });
        server.route({ method: 'POST', path: '/', config: { handler: handler } });
        server.route({ method: 'POST', path: '/override', config: { handler: handler, payload: { override: 'application/json' } } });
        server.route({ method: 'POST', path: '/text', config: { handler: textHandler } });
        server.route({ method: 'POST', path: '/textOnly', config: { handler: textHandler, payload: { allow: 'text/plain' } } });
        server.route({ method: '*', path: '/any', handler: handler });

        before(function (done) {

            server.start(done);
        });

        var TestStream = function () {

            Stream.Readable.call(this);
        };

        Hapi.utils.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            if (this.isDone) {
                return;
            }
            this.isDone = true;

            this.push('{ "key": "value" }');
            this.push(null);
        };

        it('sets parse mode when route methos is * and request is POST', function (done) {

            server.inject({ url: '/any', method: 'POST', payload: { key: '09876' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('09876');
                done();
            });
        });

        it('sets the request payload with the streaming data', function (done) {

            var options = {
                payload: new TestStream(),
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            Nipple.post('http://localhost:' + server.info.port + '/?x=1', options, function (err, res, body) {

                expect(res.statusCode).to.equal(200);
                expect(body).to.equal('value');
                done();
            });
        });

        it('times out when the request content-length is larger than payload', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.info.port,
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
                payload: '{ "key": "value" }',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '1'
                }
            };

            Nipple.post('http://localhost:' + server.info.port + '/?x=3', options, function (err, res, body) {

                expect(err.message).to.equal('Client request error');
                done();
            });
        });

        it('returns an error on unsupported mime type', function (done) {

            var options = {
                hostname: 'localhost',
                port: server.info.port,
                path: '/?x=4',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/unknown',
                    'Content-Length': '18'
                }
            };

            var req = Http.request(options, function (res) {

                expect(res.statusCode).to.equal(415);
                done();
            });

            req.end('{ "key": "value" }');
        });

        it('ignores unsupported mime type', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', config: { handler: function (request, reply) { reply(request.payload); }, payload: { failAction: 'ignore' } } });
            server.inject({ method: 'POST', url: '/', payload: 'testing123', headers: { 'content-type': 'application/unknown' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.deep.equal({});
                done();
            });
        });

        it('returns 200 on octet mime type', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', handler: function (request, reply) { reply('ok'); } });
            server.inject({ method: 'POST', url: '/', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('ok');
                done();
            });
        });

        it('returns 200 on text mime type', function (done) {

            server.inject({ method: 'POST', url: '/text', payload: 'testing123', headers: { 'content-type': 'text/plain' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('testing123+456');
                done();
            });
        });

        it('returns 200 on override mime type', function (done) {

            server.inject({ method: 'POST', url: '/override', payload: '{"key":"cool"}', headers: { 'content-type': 'text/plain' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('cool');
                done();
            });
        });

        it('returns 200 on text mime type when allowed', function (done) {

            server.inject({ method: 'POST', url: '/textOnly', payload: 'testing123', headers: { 'content-type': 'text/plain' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('testing123+456');
                done();
            });
        });

        it('returns 415 on nonn text mime type when disallowed', function (done) {

            server.inject({ method: 'POST', url: '/textOnly', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } }, function (res) {

                expect(res.statusCode).to.equal(415);
                done();
            });
        });

        it('parses application/x-www-form-urlencoded', function (done) {

            var server = new Hapi.Server();

            server.route({
                method: 'POST',
                path: '/',
                handler: function (request, reply) {

                    reply('got ' + request.payload.x);
                }
            });

            server.inject({ method: 'POST', url: '/', payload: 'x=abc', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('got abc');
                done();
            });
        });

        it('parses application/x-www-form-urlencoded with arrays', function (done) {

            var server = new Hapi.Server();

            server.route({
                method: 'POST',
                path: '/',
                handler: function (request, reply) {

                    reply(request.payload.x.y + request.payload.x.z);
                }
            });

            server.inject({ method: 'POST', url: '/', payload: 'x[y]=1&x[z]=2', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('12');
                done();
            });
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
                expect(res.result.statusCode).to.equal(400);
                done();
            });
        });

        it('does not return an error when the payload has the correct gzip header and gzipped payload', function (done) {

            var payload = '{"hi":"hello"}';

            Zlib.gzip(payload, function (err, result) {

                var handler = function (request, reply) {

                    reply('Success');
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

        var multipartPayload =
                '--AaB03x\r\n' +
                'content-disposition: form-data; name="x"\r\n' +
                '\r\n' +
                'First\r\n' +
                '--AaB03x\r\n' +
                'content-disposition: form-data; name="x"\r\n' +
                '\r\n' +
                'Second\r\n' +
                '--AaB03x\r\n' +
                'content-disposition: form-data; name="x"\r\n' +
                '\r\n' +
                'Third\r\n' +
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

        var echo = function (request, reply) {

            var result = {};
            var keys = Object.keys(request.payload);
            for (var i = 0, il = keys.length; i < il; ++i) {
                var key = keys[i];
                var value = request.payload[key]
                result[key] = value._readableState ? true : value;
            }

            reply(result);
        };

        it('returns an error on missing boundary in content-type header', function (done) {

            var invalidHandler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/invalid', config: { handler: invalidHandler } });

            server.inject({ method: 'POST', url: '/invalid', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.statusCode).to.equal(400);
                done();
            });
        });

        it('returns an error on empty separator in content-type header', function (done) {

            var invalidHandler = function (request) {

                expect(request).to.not.exist;       // Must not be called
            };

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/invalid', config: { handler: invalidHandler } });

            server.inject({ method: 'POST', url: '/invalid', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=' } }, function (res) {

                expect(res.result).to.exist;
                expect(res.result.statusCode).to.equal(400);
                done();
            });
        });

        it('returns parsed multipart data', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/echo', config: { handler: echo } });

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(Object.keys(res.result).length).to.equal(3);
                expect(res.result.field1).to.exist;
                expect(res.result.field1.length).to.equal(2);
                expect(res.result.field1[1]).to.equal('Repeated name segment');
                expect(res.result.pics).to.exist;
                done();
            });
        });

        it('parses file without content-type', function (done) {

            var multipartPayload =
                    '--AaB03x\r\n' +
                    'content-disposition: form-data; name="pics"; filename="file1.txt"\r\n' +
                    '\r\n' +
                    '... contents of file1.txt ...\r\r\n' +
                    '--AaB03x--\r\n';

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/echo', config: { handler: function (request, reply) { reply(request.payload.pics); } } });

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(res.result.toString()).to.equal('... contents of file1.txt ...\r');
                done();
            });
        });

        it('parses empty file', function (done) {

            var multipartPayload =
                    '--AaB03x\r\n' +
                    'content-disposition: form-data; name="pics"; filename="file1.txt"\r\n' +
                    'Content-Type: text/plain\r\n' +
                    '\r\n' +
                    '\r\n' +
                    '--AaB03x--\r\n';

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/echo', config: { handler: function (request, reply) { reply(request.payload); } } });

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(res.result).to.deep.equal({ pics: {} });
                done();
            });
        });

        it('errors on missing upload folder', function (done) {

            var multipartPayload =
                    '--AaB03x\r\n' +
                    'content-disposition: form-data; name="pics"; filename="file1.txt"\r\n' +
                    'Content-Type: text/plain\r\n' +
                    '\r\n' +
                    'something to fail with\r\n' +
                    '--AaB03x--\r\n';

            var server = new Hapi.Server({ payload: { uploads: '/a/b/c/d/e/f/g/not' } });
            server.route({ method: 'POST', path: '/echo', config: { handler: function (request, reply) { reply(request.payload); }, payload: { output: 'file' } } });

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('errors while processing a parsed data stream in multiple form', function (done) {

            var payload = '--AaB03x\r\n' +
                          'content-disposition: form-data; name="pics"; filename="file1.txt"\r\n' +
                          'Content-Type: text/plain\r\n' +
                          '\r\n';

            var server = new Hapi.Server(0);
            server.route({ method: 'POST', path: '/', handler: function () { } });
            server.ext('onPreResponse', function (request, reply) {

                expect(request.response.isBoom).to.equal(true);
                expect(request.response.output.statusCode).to.equal(400);
                expect(request.response.message).to.equal('Invalid multipart payload format');
                done();
            });

            server.start(function () {

                var options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/',
                    method: 'POST',
                    headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' }
                };

                var req = Http.request(options, function (res) { });
                req.write(payload);
                setTimeout(function () {

                    req.destroy();
                }, 100);

                req.on('error', function () { });
            });
        });

        it('parses multiple file as streams', function (done) {

            var multipartPayload =
                    '--AaB03x\r\n' +
                    'content-disposition: form-data; name="files"; filename="file1.txt"\r\n' +
                    'Content-Type: text/plain\r\n' +
                    '\r\n' +
                    'one\r\n' +
                    '--AaB03x\r\n' +
                    'content-disposition: form-data; name="files"; filename="file2.txt"\r\n' +
                    'Content-Type: text/plain\r\n' +
                    '\r\n' +
                    'two\r\n' +
                    '--AaB03x\r\n' +
                    'content-disposition: form-data; name="files"; filename="file3.txt"\r\n' +
                    'Content-Type: text/plain\r\n' +
                    '\r\n' +
                    'three\r\n' +
                    '--AaB03x--\r\n';

            var handler = function (request, reply) {

                Nipple.read(request.payload.files[1], function (err, payload2) {

                    Nipple.read(request.payload.files[0], function (err, payload1) {

                        Nipple.read(request.payload.files[2], function (err, payload3) {

                            reply([payload1, payload2, payload3].join('-'));
                        });
                    });
                });
            }

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/echo', config: { handler: handler, payload: { output: 'stream' } } });

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(res.result).to.equal('one-two-three');
                done();
            });
        });

        it('parses a file', function (done) {

            var path = Path.join(__dirname, '../../images/hapi.png');
            var stats = Fs.statSync(path);

            var handler = function (request, reply) {

                expect(request.headers['content-type']).to.contain('multipart/form-data');
                expect(request.payload.my_file.bytes).to.equal(stats.size);

                var sourceContents = Fs.readFileSync(path);
                var receivedContents = Fs.readFileSync(request.payload['my_file'].path);
                expect(sourceContents).to.deep.equal(receivedContents);
                done();
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file' } } });
            server.start(function () {

                var form = new FormData();
                form.append('my_file', Fs.createReadStream(path));
                Nipple.post(server.info.uri + '/file', { payload: form, headers: form.getHeaders() }, function (err, res, payload) { });
            });
        });

        it('parses a file as data', function (done) {

            var path = Path.join(__dirname, '../../package.json');

            var handler = function (request, reply) {

                var fileContents = Fs.readFileSync(path);
                expect(request.payload.my_file.name).to.equal('hapi');
                done();
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'data' } } });
            server.start(function () {

                var form = new FormData();
                form.append('my_file', Fs.createReadStream(path));
                Nipple.post(server.info.uri + '/file', { payload: form, headers: form.getHeaders() }, function (err, res, payload) { });
            });
        });

        it('returns fields when multipart is set to stream mode', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/echo', config: { handler: echo, payload: { output: 'stream' } } });

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(Object.keys(res.result).length).to.equal(3);
                expect(res.result.field1).to.exist;
                expect(res.result.field1.length).to.equal(2);
                expect(res.result.field1[1]).to.equal('Repeated name segment');
                expect(res.result.pics).to.exist;
                done();
            });
        });

        it('parses a file correctly om stream mode', function (done) {

            var path = Path.join(__dirname, '../../images/hapi.png');
            var stats = Fs.statSync(path);
            var fileStream = Fs.createReadStream(path);
            var fileContents = Fs.readFileSync(path);

            var fileHandler = function (request) {

                expect(request.headers['content-type']).to.contain('multipart/form-data');

                Nipple.read(request.payload['my_file'], function (err, buffer) {

                    expect(err).to.not.exist;
                    expect(fileContents.length).to.equal(buffer.length);
                    expect(fileContents.toString()).to.equal(buffer.toString());
                    done();
                });
            };

            var server = new Hapi.Server(0);
            server.route({ method: 'POST', path: '/file', config: { handler: fileHandler, payload: { output: 'stream' } } });
            server.start(function () {

                var form = new FormData();
                form.append('my_file', fileStream);
                Nipple.post(server.info.uri + '/file', { payload: form, headers: form.getHeaders() }, function (err, res, payload) { });
            });
        });

        it('peeks at parsed multipart data', function (done) {

            var data = null;
            var ext = function (request, reply) {

                var chunks = [];
                request.on('peek', function (chunk) {

                    chunks.push(chunk);
                });

                request.once('finish', function () {

                    data = Buffer.concat(chunks);
                });

                reply();
            };

            var handler = function (request, reply) {

                reply(data);
            };

            var server = new Hapi.Server();
            server.ext('onRequest', ext);
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.inject({ method: 'POST', url: '/', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(res.result).to.equal(multipartPayload);
                done();
            });
        });

        it('parses field names with arrays', function (done) {

            var payload = '--AaB03x\r\n' +
                          'Content-Disposition: form-data; name="a[b]"\r\n' +
                          '\r\n' +
                          '3\r\n' +
                          '--AaB03x\r\n' +
                          'Content-Disposition: form-data; name="a[c]"\r\n' +
                          '\r\n' +
                          '4\r\n' +
                          '--AaB03x--\r\n';

            var handler = function (request, reply) {

                reply(request.payload.a.b + request.payload.a.c);
            }

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'content-Type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(res.result).to.equal('34');
                done();
            });
        });

        it('parses field names with arrays', function (done) {

            var payload = '----WebKitFormBoundaryE19zNvXGzXaLvS5C\r\n' +
                      'Content-Disposition: form-data; name="a[b]"\r\n' +
                      '\r\n' +
                      '3\r\n' +
                      '----WebKitFormBoundaryE19zNvXGzXaLvS5C\r\n' +
                      'Content-Disposition: form-data; name="a[c]"\r\n' +
                      '\r\n' +
                      '4\r\n' +
                      '----WebKitFormBoundaryE19zNvXGzXaLvS5C\r\n' + 
                      'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n'+
                      'Content-Type: plain/text\r\n' +
                      '\r\n' +
                      'and\r\n' +
                      '----WebKitFormBoundaryE19zNvXGzXaLvS5C\r\n';

            var handler = function (request, reply) {

                reply(request.payload.a.b + request.payload.file + request.payload.a.c);
            }

            var server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'content-Type': 'multipart/form-data; boundary=--WebKitFormBoundaryE19zNvXGzXaLvS5C' } }, function (res) {

                expect(res.result).to.equal('3and4');
                done();
            });
        });
    });
});
