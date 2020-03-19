'use strict';

const Fs = require('fs');
const Http = require('http');
const Path = require('path');
const Zlib = require('zlib');

const Code = require('@hapi/code');
const Hapi = require('..');
const Hoek = require('@hapi/hoek');
const Lab = require('@hapi/lab');
const Wreck = require('@hapi/wreck');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Payload', () => {

    it('sets payload', async () => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const handler = (request) => {

            expect(request.payload).to.exist();
            expect(request.payload.z).to.equal('3');
            expect(request.mime).to.equal('application/json');
            return request.payload;
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler } });

        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.result).to.exist();
        expect(res.result.x).to.equal('1');
    });

    it('handles request socket error', async () => {

        let called = false;
        const handler = function () {

            called = true;
            return null;
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler } });

        const res = await server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { error: true, end: false } });
        expect(res.result).to.exist();
        expect(res.result.statusCode).to.equal(500);
        expect(called).to.be.false();
    });

    it('handles request socket close', async () => {

        const handler = function () {

            throw new Error('never called');
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler } });

        const responded = server.ext('onPostResponse');

        server.inject({ method: 'POST', url: '/', payload: 'test', simulate: { close: true, end: false } });
        const request = await responded;
        expect(request._isReplied).to.equal(true);
        expect(request.response.output.statusCode).to.equal(500);
    });

    it('handles aborted request', { retry: true }, async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => 'Success', payload: { parse: false } } });

        const log = server.events.once('log');

        await server.start();

        const options = {
            hostname: 'localhost',
            port: server.info.port,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Length': '10'
            }
        };

        const req = Http.request(options, (res) => { });
        req.on('error', Hoek.ignore);
        req.write('Hello\n');
        setTimeout(() => req.abort(), 50);

        const [event] = await log;
        expect(event.error.message).to.equal('Parse Error');
        await server.stop({ timeout: 10 });
    });

    it('errors when payload too big', async () => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { maxBytes: 10 } } });

        const res = await server.inject({ method: 'POST', url: '/', payload, headers: { 'content-length': payload.length } });
        expect(res.statusCode).to.equal(413);
        expect(res.result).to.exist();
        expect(res.result.message).to.equal('Payload content length greater than maximum allowed: 10');
    });

    it('errors when payload too big (implicit length)', async () => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { maxBytes: 10 } } });

        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.statusCode).to.equal(413);
        expect(res.result).to.exist();
        expect(res.result.message).to.equal('Payload content length greater than maximum allowed: 10');
    });

    it('errors when payload too big (file)', async () => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { output: 'file', maxBytes: 10 } } });

        const res = await server.inject({ method: 'POST', url: '/', payload, headers: { 'content-length': payload.length } });
        expect(res.statusCode).to.equal(413);
        expect(res.result).to.exist();
        expect(res.result.message).to.equal('Payload content length greater than maximum allowed: 10');
    });

    it('errors when payload too big (file implicit length)', async () => {

        const payload = '{"x":"1","y":"2","z":"3"}';

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { output: 'file', maxBytes: 10 } } });

        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.statusCode).to.equal(413);
        expect(res.result).to.exist();
        expect(res.result.message).to.equal('Payload content length greater than maximum allowed: 10');
    });

    it('errors when payload contains prototype poisoning', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', handler: (request) => request.payload.x });

        const payload = '{"x":"1","y":"2","z":"3","__proto__":{"x":"4"}}';
        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.statusCode).to.equal(400);
    });

    it('ignores when payload contains prototype poisoning', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            options: {
                payload: {
                    protoAction: 'ignore'
                },
                handler: (request) => request.payload.__proto__
            }
        });

        const payload = '{"x":"1","y":"2","z":"3","__proto__":{"x":"4"}}';
        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal({ x: '4' });
    });

    it('sanitizes when payload contains prototype poisoning', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            options: {
                payload: {
                    protoAction: 'remove'
                },
                handler: (request) => request.payload.__proto__
            }
        });

        const payload = '{"x":"1","y":"2","z":"3","__proto__":{"x":"4"}}';
        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal({});
    });

    it('returns 413 with response when payload is not consumed', async () => {

        const payload = Buffer.alloc(10 * 1024 * 1024).toString();

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { maxBytes: 1024 * 1024 } } });

        await server.start();

        const uri = 'http://localhost:' + server.info.port;
        const err = await expect(Wreck.post(uri, { payload })).to.reject();
        expect(err.data.res.statusCode).to.equal(413);
        expect(err.data.payload.toString()).to.equal('{"statusCode":413,"error":"Request Entity Too Large","message":"Payload content length greater than maximum allowed: 1048576"}');

        await server.stop();
    });

    it('handles expect 100-continue', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', handler: (request) => request.payload });

        await server.start();

        const uri = 'http://localhost:' + server.info.port;
        const { res, payload } = await Wreck.post(uri, { payload: { hello: true }, headers: { expect: '100-continue' } });
        expect(res.statusCode).to.equal(200);
        expect(payload.toString()).to.equal('{"hello":true}');

        await server.stop();
    });

    it('peeks at unparsed data', async () => {

        let data = null;
        const ext = (request, h) => {

            const chunks = [];
            request.events.on('peek', (chunk, encoding) => {

                chunks.push(chunk);
            });

            request.events.once('finish', () => {

                data = Buffer.concat(chunks);
            });

            return h.continue;
        };

        const server = Hapi.server();
        server.ext('onRequest', ext);
        server.route({ method: 'POST', path: '/', options: { handler: () => data, payload: { parse: false } } });

        const payload = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
        const res = await server.inject({ method: 'POST', url: '/', payload });
        expect(res.result).to.equal(payload);
    });

    it('peeks at unparsed data (finish only)', async () => {

        let peeked = false;
        const ext = (request, h) => {

            request.events.once('finish', () => {

                peeked = true;
            });

            return h.continue;
        };

        const server = Hapi.server();
        server.ext('onRequest', ext);
        server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { parse: false } } });

        const payload = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
        await server.inject({ method: 'POST', url: '/', payload });
        expect(peeked).to.be.true();
    });

    it('handles gzipped payload', async () => {

        const message = { 'msg': 'This message is going to be gzipped.' };
        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', handler: (request) => request.payload });

        const compressed = await new Promise((resolve) => Zlib.gzip(JSON.stringify(message), (ignore, result) => resolve(result)));

        const request = {
            method: 'POST',
            url: '/',
            headers: {
                'content-type': 'application/json',
                'content-encoding': 'gzip',
                'content-length': compressed.length
            },
            payload: compressed
        };

        const res = await server.inject(request);
        expect(res.result).to.exist();
        expect(res.result).to.equal(message);
    });

    it('handles deflated payload', async () => {

        const message = { 'msg': 'This message is going to be gzipped.' };
        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', handler: (request) => request.payload });

        const compressed = await new Promise((resolve) => Zlib.deflate(JSON.stringify(message), (ignore, result) => resolve(result)));

        const request = {
            method: 'POST',
            url: '/',
            headers: {
                'content-type': 'application/json',
                'content-encoding': 'deflate',
                'content-length': compressed.length
            },
            payload: compressed
        };

        const res = await server.inject(request);
        expect(res.result).to.exist();
        expect(res.result).to.equal(message);
    });

    it('handles custom compression', async () => {

        const message = { 'msg': 'This message is going to be gzipped.' };
        const server = Hapi.server({ routes: { payload: { compression: { test: { some: 'options' } } } } });

        const decoder = (options) => {

            expect(options).to.equal({ some: 'options' });
            return Zlib.createGunzip();
        };

        server.decoder('test', decoder);
        server.route({ method: 'POST', path: '/', handler: (request) => request.payload });

        const compressed = await new Promise((resolve) => Zlib.gzip(JSON.stringify(message), (ignore, result) => resolve(result)));

        const request = {
            method: 'POST',
            url: '/',
            headers: {
                'content-type': 'application/json',
                'content-encoding': 'test',
                'content-length': compressed.length
            },
            payload: compressed
        };

        const res = await server.inject(request);
        expect(res.result).to.exist();
        expect(res.result).to.equal(message);
    });

    it('saves a file after content decoding', async () => {

        const path = Path.join(__dirname, './file/image.jpg');
        const sourceContents = Fs.readFileSync(path);
        const stats = Fs.statSync(path);

        const handler = (request) => {

            const receivedContents = Fs.readFileSync(request.payload.path);
            Fs.unlinkSync(request.payload.path);
            expect(receivedContents).to.equal(sourceContents);
            return request.payload.bytes;
        };

        const compressed = await new Promise((resolve) => Zlib.gzip(sourceContents, (ignore, result) => resolve(result)));
        const server = Hapi.server();
        server.route({ method: 'POST', path: '/file', options: { handler, payload: { output: 'file' } } });
        const res = await server.inject({ method: 'POST', url: '/file', payload: compressed, headers: { 'content-encoding': 'gzip' } });
        expect(res.result).to.equal(stats.size);
    });

    it('errors saving a file without parse', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/file', options: { handler: Hoek.block, payload: { output: 'file', parse: false, uploads: '/a/b/c/d/not' } } });
        const res = await server.inject({ method: 'POST', url: '/file', payload: 'abcde' });
        expect(res.statusCode).to.equal(500);
    });

    it('sets parse mode when route method is * and request is POST', async () => {

        const server = Hapi.server();
        server.route({ method: '*', path: '/any', handler: (request) => request.payload.key });

        const res = await server.inject({ url: '/any', method: 'POST', payload: { key: '09876' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('09876');
    });

    it('returns an error on unsupported mime type', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', handler: (request) => request.payload.key });
        await server.start();

        const options = {
            headers: {
                'Content-Type': 'application/unknown',
                'Content-Length': '18'
            },
            payload: '{ "key": "value" }'
        };

        const err = await expect(Wreck.post(`http://localhost:${server.info.port}/?x=4`, options)).to.reject();
        expect(err.output.statusCode).to.equal(415);
        await server.stop({ timeout: 1 });
    });

    it('ignores unsupported mime type', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: (request) => request.payload, payload: { failAction: 'ignore' } } });

        const res = await server.inject({ method: 'POST', url: '/', payload: 'testing123', headers: { 'content-type': 'application/unknown' } });
        expect(res.statusCode).to.equal(204);
        expect(res.result).to.equal(null);
    });

    it('returns 200 on octet mime type', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', handler: () => 'ok' });

        const res = await server.inject({ method: 'POST', url: '/', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('ok');
    });

    it('returns 200 on text mime type', async () => {

        const handler = (request) => {

            return request.payload + '+456';
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/text', handler });

        const res = await server.inject({ method: 'POST', url: '/text', payload: 'testing123', headers: { 'content-type': 'text/plain' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('testing123+456');
    });

    it('returns 200 on override mime type', async () => {

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/override', options: { handler: (request) => request.payload.key, payload: { override: 'application/json' } } });

        const res = await server.inject({ method: 'POST', url: '/override', payload: '{"key":"cool"}', headers: { 'content-type': 'text/plain' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('cool');
    });

    it('returns 200 on text mime type when allowed', async () => {

        const handler = (request) => {

            return request.payload + '+456';
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/textOnly', options: { handler, payload: { allow: 'text/plain' } } });

        const res = await server.inject({ method: 'POST', url: '/textOnly', payload: 'testing123', headers: { 'content-type': 'text/plain' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('testing123+456');
    });

    it('returns 415 on non text mime type when disallowed', async () => {

        const handler = (request) => {

            return request.payload + '+456';
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/textOnly', options: { handler, payload: { allow: 'text/plain' } } });

        const res = await server.inject({ method: 'POST', url: '/textOnly', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } });
        expect(res.statusCode).to.equal(415);
    });

    it('returns 200 on text mime type when allowed (array)', async () => {

        const handler = (request) => {

            return request.payload + '+456';
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/textOnlyArray', options: { handler, payload: { allow: ['text/plain'] } } });

        const res = await server.inject({ method: 'POST', url: '/textOnlyArray', payload: 'testing123', headers: { 'content-type': 'text/plain' } });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('testing123+456');
    });

    it('returns 415 on non text mime type when disallowed (array)', async () => {

        const handler = (request) => {

            return request.payload + '+456';
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/textOnlyArray', options: { handler, payload: { allow: ['text/plain'] } } });

        const res = await server.inject({ method: 'POST', url: '/textOnlyArray', payload: 'testing123', headers: { 'content-type': 'application/octet-stream' } });
        expect(res.statusCode).to.equal(415);
    });

    it('returns parsed multipart data (route)', async () => {

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

        const handler = (request) => {

            const result = {};
            const keys = Object.keys(request.payload);
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                const value = request.payload[key];
                result[key] = value._readableState ? true : value;
            }

            return result;
        };

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/echo', handler, options: { payload: { multipart: true } } });

        const res = await server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } });
        expect(Object.keys(res.result).length).to.equal(3);
        expect(res.result.field1).to.exist();
        expect(res.result.field1.length).to.equal(2);
        expect(res.result.field1[1]).to.equal('Repeated name segment');
        expect(res.result.pics).to.exist();
    });

    it('returns parsed multipart data (server)', async () => {

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

        const handler = (request) => {

            const result = {};
            const keys = Object.keys(request.payload);
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                const value = request.payload[key];
                result[key] = value._readableState ? true : value;
            }

            return result;
        };

        const server = Hapi.server({ routes: { payload: { multipart: true } } });
        server.route({ method: 'POST', path: '/echo', handler });

        const res = await server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, headers: { 'content-type': 'multipart/form-data; boundary=AaB03x' } });
        expect(Object.keys(res.result).length).to.equal(3);
        expect(res.result.field1).to.exist();
        expect(res.result.field1.length).to.equal(2);
        expect(res.result.field1[1]).to.equal('Repeated name segment');
        expect(res.result.pics).to.exist();
    });

    it('signals connection close when payload is unconsumed', async () => {

        const payload = Buffer.alloc(1024);
        const server = Hapi.server();
        server.route({ method: 'POST', path: '/', options: { handler: () => 'ok', payload: { maxBytes: 1024, output: 'stream', parse: false } } });

        const res = await server.inject({ method: 'POST', url: '/', payload, headers: { 'content-type': 'application/octet-stream' } });
        expect(res.statusCode).to.equal(200);
        expect(res.headers).to.include({ connection: 'close' });
        expect(res.result).to.equal('ok');
    });

    it('times out when client request taking too long', async () => {

        const server = Hapi.server({ routes: { payload: { timeout: 50 } } });
        server.route({ method: 'POST', path: '/', handler: () => null });
        await server.start();

        const request = () => {

            const options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/',
                method: 'POST'
            };

            const req = Http.request(options);
            req.on('error', Hoek.ignore);
            req.write('{}\n');
            setTimeout(() => req.end(), 100);
            return new Promise((resolve) => req.once('response', resolve));
        };

        const timer = new Hoek.Bench();
        const res = await request();
        expect(res.statusCode).to.equal(408);
        expect(timer.elapsed()).to.be.at.least(50);

        await server.stop({ timeout: 1 });
    });

    it('times out when client request taking too long (route override)', async () => {

        const server = Hapi.server({ routes: { payload: { timeout: false } } });
        server.route({ method: 'POST', path: '/', options: { payload: { timeout: 50 }, handler: () => null } });
        await server.start();

        const request = () => {

            const options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/',
                method: 'POST'
            };

            const req = Http.request(options);
            req.on('error', Hoek.ignore);
            req.write('{}\n');
            setTimeout(() => req.end(), 100);
            return new Promise((resolve) => req.once('response', resolve));
        };

        const timer = new Hoek.Bench();
        const res = await request();
        expect(res.statusCode).to.equal(408);
        expect(timer.elapsed()).to.be.at.least(50);

        await server.stop({ timeout: 1 });
    });

    it('returns payload when timeout is not triggered', async () => {

        const server = Hapi.server({ routes: { payload: { timeout: 50 } } });
        server.route({ method: 'POST', path: '/', handler: () => 'fast' });
        await server.start();
        const { res } = await Wreck.post(`http://localhost:${server.info.port}/`);
        expect(res.statusCode).to.equal(200);
        await server.stop({ timeout: 1 });
    });

    it('errors if multipart payload exceeds byte limit', async () => {

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

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/echo', options: { handler: () => 'result', payload: { output: 'data', parse: true, maxBytes: 5, multipart: true } } });

        const res = await server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, simulate: { split: true }, headers: { 'content-length': null, 'content-type': 'multipart/form-data; boundary=AaB03x' } });
        expect(res.statusCode).to.equal(400);
        expect(res.payload.toString()).to.equal('{"statusCode":400,"error":"Bad Request","message":"Invalid multipart payload format"}');
    });

    it('errors if multipart disabled (default)', async () => {

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

        const server = Hapi.server();
        server.route({ method: 'POST', path: '/echo', options: { handler: () => 'result', payload: { output: 'data', parse: true, maxBytes: 5 } } });

        const res = await server.inject({ method: 'POST', url: '/echo', payload: multipartPayload, simulate: { split: true }, headers: { 'content-length': null, 'content-type': 'multipart/form-data; boundary=AaB03x' } });
        expect(res.statusCode).to.equal(415);
    });
});
