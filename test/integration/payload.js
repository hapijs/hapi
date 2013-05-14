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
                expect(request.rawPayload.toString()).to.equal(payload);
                request.reply(request.rawPayload);
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
                expect(request.rawPayload.toString()).to.equal(payload);
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

            var handler = function (request) {

                expect(request.payload).to.not.exist;
                expect(request.rawPayload.toString()).to.equal(payload);
                request.reply(request.rawPayload);
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
                expect(request.rawPayload.toString()).to.equal(payload);
                request.reply(request.rawPayload);
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

    describe('parse mode', function () {

        var handler = function () {

            this.reply(this.payload.key);
        };

        var textHandler = function () {

            this.reply(this.payload + '+456');
        };

        var tryHandler = function () {

            this.reply(this.rawPayload.toString() + 'failed');
        };

        var server = new Hapi.Server('localhost', 0, { timeout: { client: 50 } });
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: 'parse' } });
        server.route({ method: 'POST', path: '/override', config: { handler: handler, payload: { override: 'application/json' } } });
        server.route({ method: 'POST', path: '/text', config: { handler: textHandler } });
        server.route({ method: 'POST', path: '/textOnly', config: { handler: textHandler, payload: { allow: 'text/plain' } } });
        server.route({ method: '*', path: '/any', handler: handler });
        server.route({ method: 'POST', path: '/try', config: { handler: tryHandler, payload: { mode: 'try' } } });

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

            server.inject({ url: '/any', method: 'POST', headers: { 'Content-Type': 'application/json' }, payload: '{ "key": "09876" }' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('09876');
                done();
            });
        });

        it('sets the request payload with the streaming data', function (done) {

            var options = {
                uri: 'http://localhost:' + server.info.port + '/?x=1',
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
                uri: 'http://localhost:' + server.info.port + '/?x=3',
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

        it('returns 200 on invalid payload with try mode', function (done) {

            server.inject({ method: 'POST', url: '/try', payload: 'tried but ' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('tried but failed');
                done();
            });
        });

        it('returns 200 on application/octet-stream mime type', function (done) {

            server.inject({ method: 'POST', url: '/try', payload: 'not ', headers: { 'content-type': 'application/octet-stream' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('not failed');
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

        var server = new Hapi.Server('0.0.0.0', 0);
        server.route({ method: 'POST', path: '/invalid', handler: invalidHandler });
        server.route({ method: 'POST', path: '/echo', handler: echo });

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

        it('returns parsed multipart data', function (done) {

            server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, function (res) {

                expect(Object.keys(res.result).length).to.equal(3);
                expect(res.result.field1).to.exist;
                expect(res.result.field1.length).to.equal(2);
                expect(res.result.field1[1]).to.equal('Repeated name segment');
                expect(res.result.pics).to.exist;
                done();
            });
        });

        it('parses a file correctly', function (done) {

            var path = Path.join(__dirname, '../../images/hapi.png');
            var stats = Fs.statSync(path);
            var fileStream = Fs.createReadStream(path);
            var fileContents = Fs.readFileSync(path, { encoding: 'binary' });

            var fileHandler = function (request) {

                expect(request.raw.req.headers['content-type']).to.contain('multipart/form-data');
                expect(request.payload['my_file'].size).to.equal(stats.size);

                var tmpContents = Fs.readFileSync(request.payload['my_file'].path, { encoding: 'binary' });
                expect(fileContents).to.deep.equal(tmpContents);
                done();
            };

            var server = new Hapi.Server('0.0.0.0', 0);
            server.route({ method: 'POST', path: '/file', config: { handler: fileHandler } });
            server.start(function () {

                var r = Request.post(server.info.uri + '/file');
                var form = r.form();
                form.append('my_file', fileStream);
            });
        });
    });
});
