'use strict';

// Load modules

const Fs = require('fs');
const Http = require('http');
const Path = require('path');
const Zlib = require('zlib');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('payload', () => {

    it('sets payload', (done) => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const handler = function (request, reply) {

            expect(request.payload).to.exist();
            expect(request.payload.z).to.equal('3');
            expect(request.mime).to.equal('application/json');
            return reply(request.payload);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.inject({ method: 'POST', url: '/', payload: payload }, (res) => {

            expect(res.result).to.exist();
            expect(res.result.x).to.equal('1');
            done();
        });
    });

    it('handles request socket error', (done) => {

        const handler = function () {

            throw new Error('never called');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { error: true, end: false } }, (res) => {

            expect(res.result).to.exist();
            expect(res.result.statusCode).to.equal(500);
            done();
        });
    });

    it('handles request socket close', (done) => {

        const handler = function () {

            throw new Error('never called');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.once('response', (request) => {

            expect(request._isBailed).to.equal(true);
            done();
        });

        server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { close: true, end: false } }, (res) => { });
    });

    it('handles aborted request', (done) => {

        const handler = function (request, reply) {

            return reply('Success');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        let message = null;
        server.on('log', (event, tags) => {

            message = event.data.message;
        });

        server.start((err) => {

            expect(err).to.not.exist();

            const options = {
                hostname: 'localhost',
                port: server.info.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Length': '10'
                }
            };

            const req = Http.request(options, (res) => {

            });

            req.write('Hello\n');

            req.on('error', (err) => {

                expect(message).to.equal('Parse Error');
                expect(err.code).to.equal('ECONNRESET');
                server.stop(done);
            });

            setTimeout(() => {

                req.abort();
            }, 15);
        });
    });

    it('errors when payload too big', (done) => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const handler = function (request, reply) {

            expect(request.payload.toString()).to.equal(payload);
            return reply(request.payload);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { maxBytes: 10 } } });

        server.inject({ method: 'POST', url: '/', payload: payload, headers: { 'content-length': payload.length } }, (res) => {

            expect(res.statusCode).to.equal(400);
            expect(res.result).to.exist();
            expect(res.result.message).to.equal('Payload content length greater than maximum allowed: 10');
            done();
        });
    });

    it('returns 400 with response when payload is not consumed', (done) => {

        const payload = new Buffer(10 * 1024 * 1024).toString();

        const handler = function (request, reply) {

            return reply();
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { maxBytes: 1024 * 1024 } } });

        server.start((err) => {

            expect(err).to.not.exist();

            const uri = 'http://localhost:' + server.info.port;

            Wreck.post(uri, { payload: payload }, (err, res, body) => {

                expect(err).to.not.exist();
                expect(res.statusCode).to.equal(400);
                expect(body.toString()).to.equal('{"statusCode":400,"error":"Bad Request","message":"Payload content length greater than maximum allowed: 1048576"}');

                server.stop(done);
            });
        });
    });

    it('peeks at unparsed data', (done) => {

        let data = null;
        const ext = function (request, reply) {

            const chunks = [];
            request.on('peek', (chunk) => {

                chunks.push(chunk);
            });

            request.once('finish', () => {

                data = Buffer.concat(chunks);
            });

            return reply.continue();
        };

        const handler = function (request, reply) {

            return reply(data);
        };

        const server = new Hapi.Server();
        server.connection();
        server.ext('onRequest', ext);
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { parse: false } } });

        const payload = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
        server.inject({ method: 'POST', url: '/', payload: payload }, (res) => {

            expect(res.result).to.equal(payload);
            done();
        });
    });

    it('handles gzipped payload', (done) => {

        const handler = function (request, reply) {

            return reply(request.payload);
        };

        const message = { 'msg': 'This message is going to be gzipped.' };
        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', handler: handler });

        Zlib.gzip(JSON.stringify(message), (err, buf) => {

            expect(err).to.not.exist();

            const request = {
                method: 'POST',
                url: '/',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'gzip',
                    'content-length': buf.length
                },
                payload: buf
            };

            server.inject(request, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.deep.equal(message);
                done();
            });
        });
    });

    it('saves a file after content decoding', (done) => {

        const path = Path.join(__dirname, './file/image.jpg');
        const sourceContents = Fs.readFileSync(path);
        const stats = Fs.statSync(path);

        const handler = function (request, reply) {

            const receivedContents = Fs.readFileSync(request.payload.path);
            Fs.unlinkSync(request.payload.path);
            expect(receivedContents).to.deep.equal(sourceContents);
            return reply(request.payload.bytes);
        };

        Zlib.gzip(sourceContents, (err, compressed) => {

            expect(err).to.not.exist();
            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file' } } });
            server.inject({ method: 'POST', url: '/file', payload: compressed, headers: { 'content-encoding': 'gzip' } }, (res) => {

                expect(res.result).to.equal(stats.size);
                done();
            });
        });
    });

    it('errors saving a file without parse', (done) => {

        const handler = function (request, reply) { };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/file', config: { handler: handler, payload: { output: 'file', parse: false, uploads: '/a/b/c/d/not' } } });
        server.inject({ method: 'POST', url: '/file', payload: 'abcde' }, (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('sets parse mode when route method is * and request is POST', (done) => {

        const handler = function (request, reply) {

            return reply(request.payload.key);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: '*', path: '/any', handler: handler });

        server.inject({ url: '/any', method: 'POST', payload: { key: '09876' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('09876');
            done();
        });
    });

    it('returns an error on unsupported mime type', (done) => {

        const handler = function (request, reply) {

            return reply(request.payload.key);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler } });

        server.start((err) => {

            expect(err).to.not.exist();

            const options = {
                hostname: 'localhost',
                port: server.info.port,
                path: '/?x=4',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/unknown',
                    'Content-Length': '18'
                }
            };

            const req = Http.request(options, (res) => {

                expect(res.statusCode).to.equal(415);
                server.stop({ timeout: 1 }, done);
            });

            req.end('{ "key": "value" }');
        });
    });

    it('ignores unsupported mime type', (done) => {

        const handler = function (request, reply) {

            return reply(request.payload);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', config: { handler: handler, payload: { failAction: 'ignore' } } });

        server.inject({ method: 'POST', url: '/', payload: 'testing123', headers: { 'content-type': 'application/unknown' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.deep.equal(null);
            done();
        });
    });

    it('returns 200 on octet mime type', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/', handler: handler });

        server.inject({ method: 'POST', url: '/', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('returns 200 on text mime type', (done) => {

        const textHandler = function (request, reply) {

            return reply(request.payload + '+456');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/text', config: { handler: textHandler } });

        server.inject({ method: 'POST', url: '/text', payload: 'testing123', headers: { 'content-type': 'text/plain' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('testing123+456');
            done();
        });
    });

    it('returns 200 on override mime type', (done) => {

        const handler = function (request, reply) {

            return reply(request.payload.key);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/override', config: { handler: handler, payload: { override: 'application/json' } } });

        server.inject({ method: 'POST', url: '/override', payload: '{"key":"cool"}', headers: { 'content-type': 'text/plain' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('cool');
            done();
        });
    });

    it('returns 200 on text mime type when allowed', (done) => {

        const textHandler = function (request, reply) {

            return reply(request.payload + '+456');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/textOnly', config: { handler: textHandler, payload: { allow: 'text/plain' } } });

        server.inject({ method: 'POST', url: '/textOnly', payload: 'testing123', headers: { 'content-type': 'text/plain' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('testing123+456');
            done();
        });
    });

    it('returns 415 on non text mime type when disallowed', (done) => {

        const textHandler = function (request, reply) {

            return reply(request.payload + '+456');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/textOnly', config: { handler: textHandler, payload: { allow: 'text/plain' } } });

        server.inject({ method: 'POST', url: '/textOnly', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } }, (res) => {

            expect(res.statusCode).to.equal(415);
            done();
        });
    });

    it('returns 200 on text mime type when allowed (array)', (done) => {

        const textHandler = function (request, reply) {

            return reply(request.payload + '+456');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/textOnlyArray', config: { handler: textHandler, payload: { allow: ['text/plain'] } } });

        server.inject({ method: 'POST', url: '/textOnlyArray', payload: 'testing123', headers: { 'content-type': 'text/plain' } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('testing123+456');
            done();
        });
    });

    it('returns 415 on non text mime type when disallowed (array)', (done) => {

        const textHandler = function (request, reply) {

            return reply(request.payload + '+456');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/textOnlyArray', config: { handler: textHandler, payload: { allow: ['text/plain'] } } });

        server.inject({ method: 'POST', url: '/textOnlyArray', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } }, (res) => {

            expect(res.statusCode).to.equal(415);
            done();
        });
    });

    it('returns parsed multipart data', (done) => {

        const multipartPayload =
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

        const handler = function (request, reply) {

            const result = {};
            const keys = Object.keys(request.payload);
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                const value = request.payload[key];
                result[key] = value._readableState ? true : value;
            }

            return reply(result);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'POST', path: '/echo', config: { handler: handler } });

        server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } }, (res) => {

            expect(Object.keys(res.result).length).to.equal(3);
            expect(res.result.field1).to.exist();
            expect(res.result.field1.length).to.equal(2);
            expect(res.result.field1[1]).to.equal('Repeated name segment');
            expect(res.result.pics).to.exist();
            done();
        });
    });

    it('times out when client request taking too long', (done) => {

        const handler = function (request, reply) {

            return reply('fast');
        };

        const server = new Hapi.Server();
        server.connection({ routes: { payload: { timeout: 50 } } });
        server.route({ method: 'POST', path: '/fast', config: { handler: handler } });
        server.start((err) => {

            expect(err).to.not.exist();

            const timer = new Hoek.Bench();
            const options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/fast',
                method: 'POST'
            };

            const req = Http.request(options, (res) => {

                expect(res.statusCode).to.equal(408);
                expect(timer.elapsed()).to.be.at.least(45);
                server.stop({ timeout: 1 }, done);
            });

            req.on('error', Hoek.ignore);                    // Will error out, so don't allow error to escape test

            req.write('{}\n');
            setTimeout(() => {

                req.end();
            }, 100);
        });
    });

    it('times out when client request taking too long (route override)', (done) => {

        const handler = function (request, reply) {

            return reply('fast');
        };

        const server = new Hapi.Server();
        server.connection({ routes: { payload: { timeout: false } } });
        server.route({ method: 'POST', path: '/fast', config: { payload: { timeout: 50 }, handler: handler } });
        server.start((err) => {

            expect(err).to.not.exist();

            const timer = new Hoek.Bench();
            const options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/fast',
                method: 'POST'
            };

            const req = Http.request(options, (res) => {

                expect(res.statusCode).to.equal(408);
                expect(timer.elapsed()).to.be.at.least(45);
                server.stop({ timeout: 1 }, done);
            });

            req.on('error', Hoek.ignore);                    // Will error out, so don't allow error to escape test

            req.write('{}\n');
            setTimeout(() => {

                req.end();
            }, 100);
        });
    });

    it('returns payload when timeout is not triggered', (done) => {

        const handler = function (request, reply) {

            return reply('fast');
        };

        const server = new Hapi.Server();
        server.connection({ routes: { payload: { timeout: 50 } } });
        server.route({ method: 'POST', path: '/fast', config: { handler: handler } });
        server.start((err) => {

            expect(err).to.not.exist();

            const options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/fast',
                method: 'POST'
            };

            const req = Http.request(options, (res) => {

                expect(res.statusCode).to.equal(200);
                server.stop({ timeout: 1 }, done);
            });

            req.end();
        });
    });
});
