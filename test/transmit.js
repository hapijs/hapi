'use strict';

// Load modules

const ChildProcess = require('child_process');
const Fs = require('fs');
const Http = require('http');
const Path = require('path');
const Stream = require('stream');
const Zlib = require('zlib');
const Boom = require('boom');
const CatboxMemory = require('catbox-memory');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Lab = require('lab');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('transmission', () => {

    describe('marshal()', () => {

        it('returns valid http date responses in last-modified header', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res = await server.inject('/file');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['last-modified']).to.equal(Fs.statSync(__dirname + '/../package.json').mtime.toUTCString());
        });

        it('returns 200 if if-modified-since is invalid', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res = await server.inject({ url: '/file', headers: { 'if-modified-since': 'some crap' } });
            expect(res.statusCode).to.equal(200);
        });

        it('returns 200 if last-modified is invalid', async () => {

            const server = new Hapi.Server();
            const handler = function (request, reply) {

                return reply('ok').header('last-modified', 'some crap');
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { 'if-modified-since': 'Fri, 28 Mar 2014 22:52:39 GMT' } });
            expect(res.statusCode).to.equal(200);
        });

        it('closes file handlers when not reading file stream', { skip: process.platform === 'win32' }, async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } });
            expect(res2.statusCode).to.equal(304);

            await new Promise((resolve) => {

                const cmd = ChildProcess.spawn('lsof', ['-p', process.pid]);
                let lsof = '';
                cmd.stdout.on('data', (buffer) => {

                    lsof += buffer.toString();
                });

                cmd.stdout.on('end', () => {

                    let count = 0;
                    const lines = lsof.split('\n');
                    for (let i = 0; i < lines.length; ++i) {
                        count += (lines[i].match(/package.json/) === null ? 0 : 1);
                    }

                    expect(count).to.equal(0);
                    resolve();
                });

                cmd.stdin.end();
            });
        });

        it('closes file handlers when not using a manually open file stream', { skip: process.platform === 'win32' }, async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(Fs.createReadStream(__dirname + '/../package.json')).header('etag', 'abc');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-none-match': res1.headers.etag } });
            expect(res2.statusCode).to.equal(304);

            await new Promise((resolve) => {

                const cmd = ChildProcess.spawn('lsof', ['-p', process.pid]);
                let lsof = '';
                cmd.stdout.on('data', (buffer) => {

                    lsof += buffer.toString();
                });

                cmd.stdout.on('end', () => {

                    let count = 0;
                    const lines = lsof.split('\n');
                    for (let i = 0; i < lines.length; ++i) {
                        count += (lines[i].match(/package.json/) === null ? 0 : 1);
                    }

                    expect(count).to.equal(0);
                    resolve();
                });

                cmd.stdin.end();
            });
        });

        it('returns a 304 when the request has if-modified-since and the response has not been modified since (larger)', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');
            const last = new Date(Date.parse(res1.headers['last-modified']) + 1000);
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': last.toUTCString() } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['content-length']).to.not.exist();
            expect(res2.headers.etag).to.exist();
            expect(res2.headers['last-modified']).to.exist();
        });

        it('returns a 304 when the request has if-modified-since and the response has not been modified since (equal)', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['content-length']).to.not.exist();
            expect(res2.headers.etag).to.exist();
            expect(res2.headers['last-modified']).to.exist();
        });

        it('matches etag with content-encoding', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/', handler: { file: __dirname + '/../package.json' } });

            // Initial request - no etag

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);

            // Second request - etag

            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers.etag).to.exist();
            expect(res2.headers.etag).to.not.contain('-');

            const baseTag = res2.headers.etag.slice(0, -1);
            const gzipTag = baseTag + '-gzip"';

            // Conditional request

            const res3 = await server.inject({ url: '/', headers: { 'if-none-match': res2.headers.etag } });
            expect(res3.statusCode).to.equal(304);
            expect(res3.headers.etag).to.equal(res2.headers.etag);

            // Conditional request with accept-encoding

            const res4 = await server.inject({ url: '/', headers: { 'if-none-match': res2.headers.etag, 'accept-encoding': 'gzip' } });
            expect(res4.statusCode).to.equal(304);
            expect(res4.headers.etag).to.equal(gzipTag);

            // Conditional request with vary etag

            const res5 = await server.inject({ url: '/', headers: { 'if-none-match': res4.headers.etag, 'accept-encoding': 'gzip' } });
            expect(res5.statusCode).to.equal(304);
            expect(res5.headers.etag).to.equal(gzipTag);

            // Request with accept-encoding (gzip)

            const res6 = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res6.statusCode).to.equal(200);
            expect(res6.headers.etag).to.equal(gzipTag);

            // Request with accept-encoding (deflate)

            const res7 = await server.inject({ url: '/', headers: { 'accept-encoding': 'deflate' } });
            expect(res7.statusCode).to.equal(200);
            expect(res7.headers.etag).to.equal(baseTag + '-deflate"');

            // Conditional request with accept-encoding (gzip)

            const res8 = await server.inject({ url: '/', headers: { 'if-none-match': res7.headers.etag, 'accept-encoding': 'gzip' } });
            expect(res8.statusCode).to.equal(304);
            expect(res8.headers.etag).to.equal(gzipTag);
        });

        it('returns 304 when manually set to 304', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply().code(304);
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(304);
        });

        it('returns a stream reply with custom response headers', async () => {

            const handler = function (request, reply) {

                const HeadersStream = function () {

                    Stream.Readable.call(this);
                    this.headers = { custom: 'header' };
                };

                Hoek.inherits(HeadersStream, Stream.Readable);

                HeadersStream.prototype._read = function (size) {

                    if (this.isDone) {
                        return;
                    }
                    this.isDone = true;

                    this.push('hello');
                    this.push(null);
                };

                return reply(new HeadersStream());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler });

            const res = await server.inject('/stream');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.custom).to.equal('header');
        });

        it('returns a stream reply with custom response status code', async () => {

            const handler = function (request, reply) {

                const HeadersStream = function () {

                    Stream.Readable.call(this);
                    this.statusCode = 201;
                };

                Hoek.inherits(HeadersStream, Stream.Readable);

                HeadersStream.prototype._read = function (size) {

                    if (this.isDone) {
                        return;
                    }
                    this.isDone = true;

                    this.push('hello');
                    this.push(null);
                };

                return reply(new HeadersStream());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler });

            const res = await server.inject('/stream');
            expect(res.statusCode).to.equal(201);
        });

        it('returns an JSONP response', async () => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me');
            expect(res.payload).to.equal('/**/me({"some":"value"});');
            expect(res.headers['content-length']).to.equal(25);
            expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
        });

        it('returns an JSONP response with no payload', async () => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me');
            expect(res.payload).to.equal('/**/me();');
            expect(res.headers['content-length']).to.equal(9);
            expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
        });

        it('returns an JSONP response (no charset)', async () => {

            const handler = function (request, reply) {

                return reply({ some: 'value' }).charset('');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me');
            expect(res.payload).to.equal('/**/me({"some":"value"});');
            expect(res.headers['content-length']).to.equal(25);
            expect(res.headers['content-type']).to.equal('text/javascript');
        });

        it('returns a X-Content-Type-Options: nosniff header on JSONP responses', async () => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me');
            expect(res.payload).to.equal('/**/me({"some":"value"});');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('returns a normal response when JSONP enabled but not requested', async () => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{"some":"value"}');
        });

        it('returns an JSONP response with compression', async () => {

            const handler = function (request, reply) {

                const parts = request.params.name.split('/');
                return reply({ first: parts[0], last: parts[1] });
            };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/user/{name*2}',
                config: {
                    handler,
                    jsonp: 'callback'
                }
            });

            const res = await server.inject({ url: '/user/1/2?callback=docall', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
            expect(res.headers['content-encoding']).to.equal('gzip');
            expect(res.headers.vary).to.equal('accept-encoding');

            await new Promise((resolve) => {

                Zlib.unzip(res.rawPayload, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result.toString()).to.equal('/**/docall({"first":"1","last":"2"});');
                    resolve();
                });
            });
        });

        it('returns an JSONP response when response is a buffer', async () => {

            const handler = function (request, reply) {

                return reply(new Buffer('value'));
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me');
            expect(res.payload).to.equal('/**/me(value);');
            expect(res.headers['content-length']).to.equal(14);
        });

        it('returns response on bad JSONP parameter', async () => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me*');
            expect(res.result).to.exist();
            expect(res.result.message).to.equal('Invalid JSONP parameter value');
        });

        it('returns an JSONP handler error', async () => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest('wrong'));
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            const res = await server.inject('/?callback=me');
            expect(res.payload).to.equal('/**/me({"statusCode":400,"error":"Bad Request","message":"wrong"});');
            expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
        });

        it('returns an JSONP state error', async () => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler } });

            let validState = false;
            const preResponse = function (request, reply) {

                validState = request.state && typeof request.state === 'object';
                return reply.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res = await server.inject({ method: 'GET', url: '/?callback=me', headers: { cookie: '+' } });
            expect(res.payload).to.equal('/**/me({"statusCode":400,"error":"Bad Request","message":"Invalid cookie header"});');
            expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
            expect(validState).to.equal(true);
        });

        it('sets specific caching headers', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/public/{path*}', config: { cache: { privacy: 'public', expiresIn: 24 * 60 * 60 * 1000 } }, handler: { directory: { path: __dirname, listing: false, index: false } } });

            const res = await server.inject('/public/transmit.js');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('max-age=86400, must-revalidate, public');
        });

        it('sets caching headers', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/public/{path*}', handler: { directory: { path: __dirname, listing: false, index: false } } });

            const res = await server.inject('/public/transmit.js');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('no-cache');
        });

        it('does not set caching headers if disabled', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/public/{path*}', config: { cache: false }, handler: { directory: { path: __dirname, listing: false, index: false } } });

            const res = await server.inject('/public/transmit.js');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.be.undefined();
        });
    });

    describe('transmit()', () => {

        it('sends empty payload on 204', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply('ok').code(204);
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.result).to.equal(null);
        });

        it('sends 204 on empty payload', async () => {

            const server = new Hapi.Server({ routes: { response: { emptyStatusCode: 204 } } });

            const handler = function (request, reply) {

                return reply();
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.result).to.equal(null);
        });

        it('does not send 204 for chunked transfer payloads', async () => {

            const server = new Hapi.Server({ routes: { response: { emptyStatusCode: 204 } } });

            const handler = function (request, reply) {

                const TestStream = function () {

                    Stream.Readable.call(this);
                };

                Hoek.inherits(TestStream, Stream.Readable);

                TestStream.prototype._read = function () {

                    this.push('success');
                    this.push(null);
                };

                const stream = new TestStream();
                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('success');
        });

        it('skips compression on empty', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply().type('text/html');
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            expect(res.headers['content-encoding']).to.not.exist();
        });

        it('skips compression for 206 responses', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply('test').code(206);
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(206);
            expect(res.result).to.equal('test');
            expect(res.headers['content-length']).to.equal(4);
            expect(res.headers['content-encoding']).to.not.exist();
        });

        it('does not skip compression for chunked transfer payloads', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                const TestStream = function () {

                    Stream.Readable.call(this);
                };

                Hoek.inherits(TestStream, Stream.Readable);

                TestStream.prototype._read = function () {

                    this.push('success');
                    this.push(null);
                };

                const stream = new TestStream();
                return reply(stream).type('text/html');
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.equal('gzip');
        });

        it('sets vary header when accept-encoding is present but does not match', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply('abc');
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'example' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('accept-encoding');
        });

        it('handles stream errors on the response after the response has been piped (inject)', async () => {

            const handler = function (request, reply) {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('success');

                    setImmediate(() => {

                        this.emit('error', new Error());
                    });
                };

                return reply(stream);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result.message).to.equal('An internal server error occurred');
        });

        it('handles stream errors on the response after the response has been piped (http)', async () => {

            const handler = function (request, reply) {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('something');
                    this.emit('error', new Error());
                };

                return reply(stream);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            await server.start();
            await expect(Wreck.request('GET', 'http://localhost:' + server.info.port + '/')).to.reject();
            await server.stop();
        });

        it('matches etag header list value', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            await server.inject('/file');

            const res2 = await server.inject('/file');
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers.etag).to.exist();

            const res3 = await server.inject({ url: '/file', headers: { 'if-none-match': 'x, ' + res2.headers.etag } });
            expect(res3.statusCode).to.equal(304);
        });

        it('changes etag when content encoding is used', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            await server.inject('/file');

            const res2 = await server.inject('/file');
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers.etag).to.exist();
            expect(res2.headers['last-modified']).to.exist();

            const res3 = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res3.statusCode).to.equal(200);
            expect(res3.headers.vary).to.equal('accept-encoding');
            expect(res3.headers.etag).to.not.equal(res2.headers.etag);
            expect(res3.headers.etag).to.equal(res2.headers.etag.slice(0, -1) + '-gzip"');
            expect(res3.headers['last-modified']).to.equal(res2.headers['last-modified']);
        });

        it('returns a gzipped file in the response when the request accepts gzip', async () => {

            const server = new Hapi.Server({ routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            const handler = function (request, reply) {

                return reply.file(__dirname + '/../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-encoding']).to.equal('gzip');
            expect(res.headers['content-length']).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a plain file when not compressible', async () => {

            const server = new Hapi.Server({ routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            const handler = function (request, reply) {

                return reply.file(__dirname + '/file/image.png');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('image/png');
            expect(res.headers['content-encoding']).to.not.exist();
            expect(res.headers['content-length']).to.equal(42010);
            expect(res.headers.vary).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a plain file when compression disabled', async () => {

            const server = new Hapi.Server({ routes: { files: { relativeTo: __dirname } }, compression: false });
            await server.register(Inert);
            const handler = function (request, reply) {

                return reply.file(__dirname + '/../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-encoding']).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a deflated file in the response when the request accepts deflate', async () => {

            const server = new Hapi.Server({ routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            const handler = function (request, reply) {

                return reply.file(__dirname + '/../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'deflate' } });
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-encoding']).to.equal('deflate');
            expect(res.headers['content-length']).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a gzipped stream reply without a content-length header when accept-encoding is gzip', async () => {

            const streamHandler = function (request, reply) {

                return reply(new internals.TimerStream());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            const res = await server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.not.exist();
        });

        it('returns a deflated stream reply without a content-length header when accept-encoding is deflate', async () => {

            const streamHandler = function (request, reply) {

                return reply(new internals.TimerStream());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            const res = await server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'deflate' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.not.exist();
        });

        it('returns a gzip response on a post request when accept-encoding: gzip is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));

            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: gzip is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a post request when accept-encoding: * is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': '*' }, payload: data });
            expect(payload.toString()).to.equal(data);
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: * is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': '*' } });
            expect(payload.toString()).to.equal(data);
            await server.stop();
        });

        it('returns a deflate response on a post request when accept-encoding: deflate is requested', async () => {

            const data = '{"test":"true"}';
            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', new Buffer(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'deflate' }, payload: data });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a deflate response on a get request when accept-encoding: deflate is requested', async () => {

            const data = '{"test":"true"}';
            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', new Buffer(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'deflate' } });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a gzip response on a post request when accept-encoding: gzip;q=1, deflate;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'gzip;q=1, deflate;q=0.5' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: gzip;q=1, deflate;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'gzip;q=1, deflate;q=0.5' } });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a deflate response on a post request when accept-encoding: deflate;q=1, gzip;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', new Buffer(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'deflate;q=1, gzip;q=0.5' }, payload: data });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a deflate response on a get request when accept-encoding: deflate;q=1, gzip;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', new Buffer(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'deflate;q=1, gzip;q=0.5' } });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a gzip response on a post request when accept-encoding: deflate, gzip is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'deflate, gzip' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: deflate, gzip is requested', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'deflate, gzip' } });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('boom object reused does not affect encoding header.', async () => {

            const error = Boom.badRequest();
            const data = JSON.stringify(error.output.payload);

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(error);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const err1 = await expect(Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } })).to.reject();
            expect(err1.data.payload.toString()).to.equal(zipped.toString());

            const err2 = await expect(Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } })).to.reject();
            expect(err2.data.payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('Error reused does not affect encoding header.', async () => {

            const error = new Error('something went wrong');
            const wrappedError = Boom.boomify(error);
            const data = JSON.stringify(wrappedError.output.payload);

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(error);
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', new Buffer(data));
            const err1 = await expect(Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } })).to.reject();
            expect(err1.data.payload.toString()).to.equal(zipped.toString());

            const err2 = await expect(Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } })).to.reject();
            expect(err2.data.payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns an identity response on a post request when accept-encoding is missing', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.post(uri, { payload: data });
            expect(payload.toString()).to.equal(data);
            await server.stop();
        });

        it('returns an identity response on a get request when accept-encoding is missing', async () => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(data);
                }
            });

            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.get(uri);
            expect(payload.toString().toString()).to.equal(data);
            await server.stop();
        });

        it('returns a gzip response when forced by the handler', async () => {

            const data = '{"test":"true"}';

            const zipped = await internals.compress('gzip', new Buffer(data));

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply(zipped).type('text/plain').header('content-encoding', 'gzip');
            };

            server.route({ method: 'POST', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('does not open file stream on 304', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');

            const preResponse = function (request, reply) {

                request.response._marshal = function () {

                    throw new Error('not called');
                };

                return reply.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } });
            expect(res2.statusCode).to.equal(304);
        });

        it('object listeners are maintained after transmission is complete', async () => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            let response;
            let log;

            const preResponse = function (request, reply) {

                response = request.response;
                response.registerEvent('special');
                log = response.once('special');
                return reply.continue;
            };

            server.ext('onPreResponse', preResponse);
            await server.inject('/');
            response.emit('special');
            await log;
        });

        it('stops processing the stream when the request closes', async () => {

            const ErrStream = function (request) {

                Stream.Readable.call(this);

                this.request = request;
            };

            Hoek.inherits(ErrStream, Stream.Readable);

            ErrStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;
                this.push('here is the response');
                process.nextTick(() => {

                    this.request.raw.req.emit('close');
                    process.nextTick(() => {

                        this.push(null);
                    });
                });
            };

            const handler = function (request, reply) {

                return reply(new ErrStream(request)).bytes(0);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', handler });

            const res = await server.inject({ url: '/stream', headers: { 'Accept-Encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
        });

        it('does not truncate the response when stream finishes before response is done', async () => {

            const chunkTimes = 10;
            const filePath = __dirname + '/response.js';
            const block = Fs.readFileSync(filePath).toString();

            let expectedBody = '';
            for (let i = 0; i < chunkTimes; ++i) {
                expectedBody += block;
            }

            const fileHandler = function (request, reply) {

                const fileStream = new Stream.Readable();

                let readTimes = 0;
                fileStream._read = function (size) {

                    ++readTimes;
                    if (readTimes > chunkTimes) {
                        return this.push(null);
                    }

                    this.push(block);
                };

                return reply(fileStream);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: fileHandler });
            await server.start();

            const { payload } = await Wreck.get('http://localhost:' + server.info.port);
            expect(payload.toString()).to.equal(expectedBody);
            await server.stop();
        });

        it('does not truncate the response when stream finishes before response is done using https', async () => {

            const chunkTimes = 10;
            const filePath = __dirname + '/response.js';
            const block = Fs.readFileSync(filePath).toString();

            let expectedBody = '';
            for (let i = 0; i < chunkTimes; ++i) {
                expectedBody += block;
            }

            const fileHandler = function (request, reply) {

                const fileStream = new Stream.Readable();

                let readTimes = 0;
                fileStream._read = function (size) {

                    ++readTimes;
                    if (readTimes > chunkTimes) {
                        return this.push(null);
                    }

                    this.push(block);
                };

                return reply(fileStream);
            };

            const config = {
                tls: {
                    key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                    cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
                }
            };

            const server = new Hapi.Server(config);
            server.route({ method: 'GET', path: '/', handler: fileHandler });
            await server.start();

            const { payload } = await Wreck.get('https://localhost:' + server.info.port, { rejectUnauthorized: false });
            expect(payload.toString()).to.equal(expectedBody);
            await server.stop();
        });

        it('does not leak stream data when request aborts before stream drains', (done) => {

            const server = new Hapi.Server();

            let destroyed = false;
            const handler = function (request, reply) {

                const stream = new Stream.Readable();

                stream.destroy = undefined;    // Node 8 streams comes with a destroy method – disable for this test

                stream._read = function (size) {

                    const chunk = new Array(size).join('x');

                    if (destroyed) {
                        this.push(chunk);
                        this.push(null);
                    }
                    else {

                        setTimeout(() => {

                            this.push(chunk);
                        }, 10);
                    }
                };

                stream.once('end', () => {

                    server.stop().then(done);
                });

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler });

            server.start().then(() => {

                Wreck.request('GET', 'http://localhost:' + server.info.port).then((res) => {

                    res.on('data', (chunk) => {

                        if (!destroyed) {
                            destroyed = true;
                            res.destroy();
                        }
                    });
                });
            });
        });

        it('does not leak classic stream data when passed to request and aborted', async () => {

            const server = new Hapi.Server({ debug: false });

            await new Promise((resolve) => {

                let destroyed = false;
                const handler = function (request, reply) {

                    const stream = new Stream();
                    stream.readable = true;

                    let paused = true;
                    const _read = function () {

                        setImmediate(() => {

                            if (paused) {
                                return;
                            }

                            const chunk = new Array(1024).join('x');

                            if (destroyed) {
                                stream.emit('data', chunk);
                                stream.readable = false;
                                stream.emit('end');
                            }
                            else {
                                stream.emit('data', chunk);
                                _read();
                            }
                        });
                    };

                    stream.resume = function () {

                        if (paused) {
                            paused = false;
                            _read();
                        }
                    };
                    stream.pause = function () {

                        paused = true;
                    };

                    stream.resume();
                    stream.once('end', resolve);
                    return stream;
                };

                server.route({ method: 'GET', path: '/', handler });

                server.start().then(() => {

                    Wreck.request('GET', 'http://localhost:' + server.info.port).then((res) => {

                        res.on('data', (chunk) => {

                            if (!destroyed) {
                                destroyed = true;
                                res.destroy();
                            }
                        });
                    });
                });
            });

            await server.stop();
        });

        it('does not leak stream data when request timeouts before stream drains', (done) => {

            const server = new Hapi.Server({ routes: { timeout: { server: 20, socket: 40 }, payload: { timeout: false } } });

            const handler = function (request, reply) {

                const stream = new Stream.Readable();
                let count = 0;
                stream._read = function (size) {

                    setTimeout(() => {

                        if (request._isFinalized) {
                            stream.push(null);
                        }
                        else {
                            stream.push(new Array(size).join('x'));
                        }
                    }, 10 * (count++));       // Must have back off here to hit the socket timeout
                };

                stream.once('end', () => {

                    server.stop().then(done);
                });

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler });

            server.start().then(() => {

                Wreck.request('GET', 'http://localhost:' + server.info.port).then((res) => {

                    res.on('data', (chunk) => { });
                });
            });
        });

        it('does not leak stream data when request aborts before stream is returned', (done) => {

            const server = new Hapi.Server();

            let clientRequest;
            const handler = async function (request, reply) {

                clientRequest.abort();

                const stream = new Stream.Readable();
                let responded = false;

                stream.destroy = undefined;    // Node 8 streams comes with a destroy method – disable for this test

                stream._read = function (size) {

                    const chunk = new Array(size).join('x');

                    if (responded) {
                        this.push(chunk);
                        this.push(null);
                    }
                    else {
                        setTimeout(() => {

                            responded = true;
                            this.push(chunk);
                        }, 10);
                    }
                };

                stream.once('end', () => {

                    expect(responded).to.be.true();
                    server.stop().then(done);
                });

                await internals.wait(100);
                return stream;
            };

            server.route({ method: 'GET', path: '/', handler });

            server.start().then(() => {

                clientRequest = Http.request({
                    hostname: 'localhost',
                    port: server.info.port,
                    method: 'GET'
                });
                clientRequest.on('error', () => { /* NOP */ });
                clientRequest.end();
            });
        });

        it('changes etag when content-encoding set manually', async () => {

            const server = new Hapi.Server();
            const handler = function (request, reply) {

                return reply('x').header('content-encoding', 'gzip').etag('abc');
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.exist();
            expect(res.headers.etag).to.match(/-gzip"$/);
        });

        it('head request retains content-length header', async () => {

            const server = new Hapi.Server();
            const handler = function (request, reply) {

                return reply('x').bytes(1);
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ method: 'HEAD', url: '/' });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(1);
        });

        it('does not set accept-encoding multiple times', async () => {

            const headersHandler = function (request, reply) {

                return reply({ status: 'success' })
                    .vary('X-Custom3');
            };

            const upstream = new Hapi.Server();
            upstream.route({ method: 'GET', path: '/headers', handler: headersHandler });
            await upstream.start();

            const proxyHandler = async function (request, reply) {

                const options = {};
                options.headers = Hoek.clone(request.headers);
                delete options.headers.host;

                const res = await Wreck.request(request.method, 'http://localhost:' + upstream.info.port + '/headers', options);
                return reply(res).code(res.statusCode);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/headers', handler: proxyHandler });

            const res = await server.inject({ url: '/headers', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('X-Custom3,accept-encoding');

            await upstream.stop();
        });

        it('ends response stream once', async () => {

            const server = new Hapi.Server();

            let count = 0;
            const onRequest = function (request, reply) {

                const res = request.raw.res;
                const orig = res.end;

                res.end = function () {

                    ++count;
                    return orig.call(res);
                };

                return reply.continue;
            };

            server.ext('onRequest', onRequest);
            await server.inject('/');
            expect(count).to.equal(1);
        });

        describe('response range', () => {

            const fileStreamHandler = function (request, reply) {

                const filePath = Path.join(__dirname, 'file', 'image.png');
                return reply(Fs.createReadStream(filePath)).bytes(Fs.statSync(filePath).size);
            };

            it('returns a subset of a fileStream (start)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=0-4' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 0-4/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('\x89PNG\r');
            });

            it('ignores range request when disabled', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler, config: { response: { ranges: false } } });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=0-4' } });
                expect(res.statusCode).to.equal(200);
            });

            it('returns a subset of a fileStream (middle)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=1-5' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 1-5/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.payload).to.equal('PNG\r\n');
            });

            it('returns a subset of a fileStream (-to)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=-5' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns a subset of a fileStream (from-)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns a subset of a fileStream (beyond end)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns a subset of a fileStream (if-range)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                await server.inject('/file');
                const res1 = await server.inject('/file');
                const res2 = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': res1.headers.etag } });
                expect(res2.statusCode).to.equal(206);
                expect(res2.headers['content-length']).to.equal(5);
                expect(res2.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res2.headers['accept-ranges']).to.equal('bytes');
                expect(res2.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns 200 on incorrect if-range', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': 'abc' } });
                expect(res.statusCode).to.equal(200);
            });

            it('returns 416 on invalid range (unit)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'horses=1-5' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 416 on invalid range (inversed)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=5-1' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 416 on invalid range (format)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes 1-5' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 416 on invalid range (empty range)', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=-' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 200 on multiple ranges', async () => {

                const server = new Hapi.Server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=1-5,7-10' } });
                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(42010);
            });

            it('returns a subset of a stream', async () => {

                const TestStream = function () {

                    Stream.Readable.call(this);
                    this._count = -1;
                };

                Hoek.inherits(TestStream, Stream.Readable);

                TestStream.prototype._read = function (size) {

                    this._count++;

                    if (this._count > 10) {
                        return;
                    }

                    if (this._count === 10) {
                        this.push(null);
                        return;
                    }

                    this.push(this._count.toString());
                };

                TestStream.prototype.size = function () {

                    return 10;
                };

                const server = new Hapi.Server();
                const handler = function (request, reply) {

                    return reply(new TestStream());
                };

                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject({ url: '/', headers: { 'range': 'bytes=2-4' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(3);
                expect(res.headers['content-range']).to.equal('bytes 2-4/10');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.payload).to.equal('234');
            });

            it('returns a consolidated range', async () => {

                const TestStream = function () {

                    Stream.Readable.call(this);
                    this._count = -1;
                };

                Hoek.inherits(TestStream, Stream.Readable);

                TestStream.prototype._read = function (size) {

                    this._count++;

                    if (this._count > 10) {
                        return;
                    }

                    if (this._count === 10) {
                        this.push(null);
                        return;
                    }

                    this.push(this._count.toString());
                };

                TestStream.prototype.size = function () {

                    return 10;
                };

                const server = new Hapi.Server();
                const handler = function (request, reply) {

                    return reply(new TestStream());
                };

                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject({ url: '/', headers: { 'range': 'bytes=0-1,1-2, 3-5' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(6);
                expect(res.headers['content-range']).to.equal('bytes 0-5/10');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.payload).to.equal('012345');
            });
        });

        it('skips undefined header values', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply('ok').header('x', undefined);
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.x).to.not.exist();
        });

        it('does not add connection close header to normal requests', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.connection).to.not.equal('close');
        });

        it('returns 500 when node rejects a header', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply('ok').header('x', '1').header('', 'test');
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.headers.x).to.not.exist();
        });

        it('returns 500 for out of range status code', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                // Patch writeHead to always fail on out of range headers

                const origWriteHead = request.raw.res.writeHead;
                request.raw.res.writeHead = function (statusCode) {

                    statusCode |= 0;
                    if (statusCode < 100 || statusCode > 999) {
                        throw new RangeError(`Invalid status code: ${statusCode}`);
                    }

                    return origWriteHead.apply(this, arguments);
                };

                return reply('ok').code(1);
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('writeHead()', () => {

        it('set custom statusMessage', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply({}).message('Great');
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { res } = await Wreck.get(uri);
            expect(res.statusMessage).to.equal('Great');
            await server.stop();
        });
    });

    describe('cache()', () => {

        it('sets max-age value (method and route)', async () => {

            const server = new Hapi.Server();

            const method = function (id, next) {

                return next(null, {
                    'id': 'fa0dbda9b1b',
                    'name': 'John Doe'
                });
            };

            server.method('profile', method, { cache: { expiresIn: 120000, generateTimeout: 10 } });

            const profileHandler = function (request, reply) {

                return new Promise((resolve) => server.methods.profile(0, (ignoreErr, data, ttl) => resolve(data)));
            };

            server.route({ method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } });
            await server.start();

            const res = await server.inject('/profile');
            expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
            await server.stop();
        });

        it('sets max-age value (expiresAt)', async () => {

            const server = new Hapi.Server();

            const handler = function (request, reply) {

                return reply();
            };

            server.route({ method: 'GET', path: '/', config: { handler, cache: { expiresAt: '10:00' } } });
            await server.start();

            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.match(/^max-age=\d+, must-revalidate$/);
            await server.stop();
        });

        it('returns no-cache on error', async () => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler, cache: { expiresIn: 120000 } } });
            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('no-cache');
        });

        it('returns custom value on error', async () => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler, cache: { otherwise: 'no-store' } } });
            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('no-store');
        });

        it('sets cache-control on error with status override', async () => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest());
            };

            const server = new Hapi.Server({ routes: { cache: { statuses: [200, 400] } } });
            server.route({ method: 'GET', path: '/', config: { handler, cache: { expiresIn: 120000 } } });
            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate');
        });

        it('does not return max-age value when route is not cached', async () => {

            const server = new Hapi.Server();
            const activeItemHandler = function (request, reply) {

                return reply({
                    'id': '55cf687663',
                    'name': 'Active Items'
                });
            };

            server.route({ method: 'GET', path: '/item2', config: { handler: activeItemHandler } });
            const res = await server.inject('/item2');
            expect(res.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
        });

        it('caches using non default cache', async () => {

            const server = new Hapi.Server({ cache: { name: 'primary', engine: CatboxMemory } });
            const defaults = server.cache({ segment: 'a', expiresIn: 2000 });
            const primary = server.cache({ segment: 'a', expiresIn: 2000, cache: 'primary' });

            await server.start();

            await new Promise((resolve) => {

                defaults.set('b', 1, null, (err) => {

                    expect(err).to.not.exist();

                    primary.set('b', 2, null, (err) => {

                        expect(err).to.not.exist();

                        defaults.get('b', (err, value1, cached1, report1) => {

                            expect(err).to.not.exist();
                            expect(value1).to.equal(1);

                            primary.get('b', (err, value2, cached2, report2) => {

                                expect(err).to.not.exist();
                                expect(cached2.item).to.equal(2);
                                resolve();
                            });
                        });
                    });
                });
            });

            await server.stop();
        });

        it('leaves existing cache-control header', async () => {

            const handler = function (request, reply) {

                return reply('text').code(400)
                    .header('cache-control', 'some value');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(400);
            expect(res.headers['cache-control']).to.equal('some value');
        });

        it('sets cache-control header from ttl without policy', async () => {

            const handler = function (request, reply) {

                return reply('text').ttl(10000);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('max-age=10, must-revalidate');
        });

        it('sets cache-control header from ttl with disabled policy', async () => {

            const handler = function (request, reply) {

                return reply('text').ttl(10000);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { cache: false, handler } });

            const res = await server.inject('/');
            expect(res.headers['cache-control']).to.equal('max-age=10, must-revalidate');
        });

        it('leaves existing cache-control header (ttl)', async () => {

            const handler = function (request, reply) {

                return reply('text').ttl(1000).header('cache-control', 'none');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('none');
        });

        it('includes caching header with 304', async () => {

            const server = new Hapi.Server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' }, config: { cache: { expiresIn: 60000 } } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['cache-control']).to.equal('max-age=60, must-revalidate');
        });

        it('forbids caching on 304 if 200 is not included', async () => {

            const server = new Hapi.Server({ routes: { cache: { statuses: [400] } } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' }, config: { cache: { expiresIn: 60000 } } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['cache-control']).to.equal('no-cache');
        });
    });

    describe('security()', () => {

        it('does not set security headers by default', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.not.exist();
            expect(res.headers['x-frame-options']).to.not.exist();
            expect(res.headers['x-xss-protection']).to.not.exist();
            expect(res.headers['x-download-options']).to.not.exist();
            expect(res.headers['x-content-type-options']).to.not.exist();
        });

        it('returns default security headers when security is true', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: true } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
            expect(res.headers['x-frame-options']).to.equal('DENY');
            expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('does not set default security headers when the route sets security false', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const config = {
                security: false
            };

            const server = new Hapi.Server({ routes: { security: true } });
            server.route({ method: 'GET', path: '/', handler, config });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.not.exist();
            expect(res.headers['x-frame-options']).to.not.exist();
            expect(res.headers['x-xss-protection']).to.not.exist();
            expect(res.headers['x-download-options']).to.not.exist();
            expect(res.headers['x-content-type-options']).to.not.exist();
        });

        it('does not return hsts header when secuirty.hsts is false', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: false } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.not.exist();
            expect(res.headers['x-frame-options']).to.equal('DENY');
            expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('returns only default hsts header when security.hsts is true', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
        });

        it('returns correct hsts header when security.hsts is a number', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: 123456789 } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
        });

        it('returns correct hsts header when security.hsts is an object', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: { maxAge: 123456789, includeSubDomains: true } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=123456789; includeSubDomains');
        });

        it('returns the correct hsts header when security.hsts is an object only sepcifying maxAge', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: { maxAge: 123456789 } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubdomains', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: { includeSubdomains: true } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains');
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubDomains', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: { includeSubDomains: true } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains');
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubDomains and preload', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { hsts: { includeSubDomains: true, preload: true } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains; preload');
        });

        it('does not return the xframe header whe security.xframe is false', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xframe: false } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.not.exist();
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
            expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });

        it('returns only default xframe header when security.xframe is true', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xframe: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('DENY');
        });

        it('returns correct xframe header when security.xframe is a string', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xframe: 'sameorigin' } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
        });

        it('returns correct xframe header when security.xframe is an object', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xframe: { rule: 'allow-from', source: 'http://example.com' } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('ALLOW-FROM http://example.com');
        });

        it('returns correct xframe header when security.xframe is an object', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xframe: { rule: 'deny' } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('DENY');
        });

        it('returns sameorigin xframe header when rule is allow-from but source is unspecified', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xframe: { rule: 'allow-from' } } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });

            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
        });

        it('does not set x-download-options if noOpen is false', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { noOpen: false } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-download-options']).to.not.exist();
        });

        it('does not set x-content-type-options if noSniff is false', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { noSniff: false } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-content-type-options']).to.not.exist();
        });

        it('does not set the x-xss-protection header when security.xss is false', async () => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server({ routes: { security: { xss: false } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/' });
            expect(res.result).to.exist();
            expect(res.result).to.equal('Test');
            expect(res.headers['x-xss-protection']).to.not.exist();
            expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
            expect(res.headers['x-frame-options']).to.equal('DENY');
            expect(res.headers['x-download-options']).to.equal('noopen');
            expect(res.headers['x-content-type-options']).to.equal('nosniff');
        });
    });

    describe('content()', () => {

        it('does not modify content-type header when charset manually set', async () => {

            const handler = function (request, reply) {

                return reply('text').type('text/plain; charset=ISO-8859-1');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/plain; charset=ISO-8859-1');
        });

        it('does not modify content-type header when charset is unset', async () => {

            const handler = function (request, reply) {

                return reply('text').type('text/plain').charset();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/plain');
        });

        it('does not modify content-type header when charset is unset (default type)', async () => {

            const handler = function (request, reply) {

                return reply('text').charset();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html');
        });
    });
});


internals.TimerStream = function () {

    Stream.Readable.call(this);
};

Hoek.inherits(internals.TimerStream, Stream.Readable);

internals.TimerStream.prototype._read = function (size) {

    if (this.isDone) {
        return;
    }
    this.isDone = true;

    setTimeout(() => {

        this.push('hi');
        this.push(null);
    }, 5);
};


internals.compress = function (encoder, value) {

    return new Promise((resolve) => Zlib[encoder](value, (ignoreErr, compressed) => resolve(compressed)));
};


internals.wait = function (timeout) {

    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
};
