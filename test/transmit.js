'use strict';

const ChildProcess = require('child_process');
const Fs = require('fs');
const Http = require('http');
const Net = require('net');
const Path = require('path');
const Stream = require('stream');
const Zlib = require('zlib');
const Events = require('events');

const Boom = require('@hapi/boom');
const Code = require('@hapi/code');
const Hapi = require('..');
const Hoek = require('@hapi/hoek');
const Bounce = require('@hapi/bounce');
const Inert = require('@hapi/inert');
const Lab = require('@hapi/lab');
const Teamwork = require('@hapi/teamwork');
const Wreck = require('@hapi/wreck');

const Common = require('./common');

const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('transmission', () => {

    describe('send()', () => {

        it('handlers invalid headers in error', async () => {

            const server = Hapi.server();

            const handler = (request, h) => {

                const error = Boom.badRequest();
                error.output.headers.invalid = '\u1000';
                throw error;
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('handles invalid headers in redirect', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.redirect('/bad/path/\n') });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('marshal()', () => {

        it('returns valid http date responses in last-modified header', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res = await server.inject('/file');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['last-modified']).to.equal(Fs.statSync(__dirname + '/../package.json').mtime.toUTCString());
        });

        it('returns 200 if if-modified-since is invalid', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res = await server.inject({ url: '/file', headers: { 'if-modified-since': 'some crap' } });
            expect(res.statusCode).to.equal(200);
        });

        it('returns 200 if last-modified is invalid', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').header('last-modified', 'some crap') });

            const res = await server.inject({ url: '/', headers: { 'if-modified-since': 'Fri, 28 Mar 2014 22:52:39 GMT' } });
            expect(res.statusCode).to.equal(200);
        });

        it('closes file handlers when not reading file stream', { skip: !Common.hasLsof }, async () => {

            const server = Hapi.server();
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

        it('closes file handlers when not using a manually open file stream', { skip: !Common.hasLsof }, async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/file', handler: (request, h) => h.response(Fs.createReadStream(__dirname + '/../package.json')).header('etag', 'abc') });

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

            const server = Hapi.server();
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

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['content-length']).to.not.exist();
            expect(res2.headers.etag).to.exist();
            expect(res2.headers['last-modified']).to.exist();
        });

        it('returns a 200 when the request has if-modified-since and the response has been modified since (less)', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');
            const last = new Date(Date.parse(res1.headers['last-modified']) - 1000);
            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': last.toUTCString() } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers['content-length']).to.exist();
            expect(res2.headers.etag).to.exist();
            expect(res2.headers['last-modified']).to.exist();
        });

        it('matches etag with content-encoding', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/', handler: { file: __dirname + '/../package.json' } });

            // Request

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.headers.etag).to.exist();
            expect(res1.headers.etag).to.not.contain('-');

            const baseTag = res1.headers.etag.slice(0, -1);
            const gzipTag = baseTag + '-gzip"';

            // Conditional request

            const res2 = await server.inject({ url: '/', headers: { 'if-none-match': res1.headers.etag } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers.etag).to.equal(res1.headers.etag);

            // Conditional request with accept-encoding

            const res3 = await server.inject({ url: '/', headers: { 'if-none-match': res1.headers.etag, 'accept-encoding': 'gzip' } });
            expect(res3.statusCode).to.equal(304);
            expect(res3.headers.etag).to.equal(gzipTag);

            // Conditional request with vary etag

            const res4 = await server.inject({ url: '/', headers: { 'if-none-match': res3.headers.etag, 'accept-encoding': 'gzip' } });
            expect(res4.statusCode).to.equal(304);
            expect(res4.headers.etag).to.equal(gzipTag);

            // Request with accept-encoding (gzip)

            const res5 = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res5.statusCode).to.equal(200);
            expect(res5.headers.etag).to.equal(gzipTag);

            // Request with accept-encoding (deflate)

            const res6 = await server.inject({ url: '/', headers: { 'accept-encoding': 'deflate' } });
            expect(res6.statusCode).to.equal(200);
            expect(res6.headers.etag).to.equal(baseTag + '-deflate"');

            // Conditional request with accept-encoding (gzip)

            const res7 = await server.inject({ url: '/', headers: { 'if-none-match': res6.headers.etag, 'accept-encoding': 'gzip' } });
            expect(res7.statusCode).to.equal(304);
            expect(res7.headers.etag).to.equal(gzipTag);
        });

        it('matches etag with weak designator', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/', handler: { file: __dirname + '/../package.json' } });

            // Fetch etag

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.headers.etag).to.exist();
            expect(res1.headers.etag).to.not.contain('W/"');

            const weakEtag = `W/${res1.headers.etag}`;

            // Conditional request

            const res2 = await server.inject({ url: '/', headers: { 'if-none-match': weakEtag } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers.etag).to.equal(weakEtag);
        });

        it('returns 304 when manually set to 304', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response().code(304) });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(304);
        });

        it('returns a stream response with custom response headers', async () => {

            const handler = (request) => {

                const HeadersStream = class extends Stream.Readable {

                    constructor() {

                        super();
                        this.headers = { custom: 'header' };
                    }

                    _read(size) {

                        if (this.isDone) {
                            return;
                        }

                        this.isDone = true;

                        this.push('hello');
                        this.push(null);
                    }
                };

                return new HeadersStream();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/stream', handler });

            const res = await server.inject('/stream');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.custom).to.equal('header');
        });

        it('returns a stream response with custom response status code', async () => {

            const handler = (request) => {

                const HeadersStream = class extends Stream.Readable {

                    constructor() {

                        super();
                        this.statusCode = 201;
                    }

                    _read(size) {

                        if (this.isDone) {
                            return;
                        }

                        this.isDone = true;

                        this.push('hello');
                        this.push(null);
                    }
                };

                return new HeadersStream();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/stream', handler });

            const res = await server.inject('/stream');
            expect(res.statusCode).to.equal(201);
        });

        it('sets specific caching headers', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/public/{path*}', options: { cache: { privacy: 'public', expiresIn: 24 * 60 * 60 * 1000 } }, handler: { directory: { path: __dirname, listing: false, index: false } } });

            const res = await server.inject('/public/transmit.js');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('max-age=86400, must-revalidate, public');
        });

        it('sets caching headers', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/public/{path*}', handler: { directory: { path: __dirname, listing: false, index: false } } });

            const res = await server.inject('/public/transmit.js');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('no-cache');
        });

        it('does not set caching headers if disabled', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/public/{path*}', options: { cache: false }, handler: { directory: { path: __dirname, listing: false, index: false } } });

            const res = await server.inject('/public/transmit.js');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.be.undefined();
        });

        it('does not crash when request is aborted', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const team = new Teamwork.Team();
            const onRequest = (request, h) => {

                request.events.once('disconnect', () => team.attend());
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            // Use state autoValue function to intercept marshal stage

            server.state('always', {
                async autoValue(request) {

                    const close = new Teamwork.Team();
                    request.raw.res.once('close', () => close.attend());

                    // Will trigger abort then close. Prior to node v15.7.0 the res close came
                    // asynchronously after req abort, but since then it comes in the same tick.
                    client.destroy();
                    await close.work;

                    return team.work;               // Continue marshalling once the request has been aborted and response closed.
                }
            });

            await server.start();

            const log = server.events.once('response');
            const client = Net.connect(server.info.port, () => {

                client.write('GET / HTTP/1.1\r\naccept-encoding: gzip\r\n\r\n');
            });

            const [request] = await log;
            expect(request.response.isBoom).to.be.true();
            expect(request.response.output.statusCode).to.equal(499);
            expect(request.info.completed).to.be.above(0);
            expect(request.info.responded).to.equal(0);
        });
    });

    describe('transmit()', () => {

        it('sends empty payload on 204', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').code(204) });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.result).to.equal(null);
        });

        it('sends 204 on empty payload', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.result).to.equal(null);
        });

        it('overrides emptyStatusCode', async () => {

            const server = Hapi.server({ routes: { response: { emptyStatusCode: 200 } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(0);
            expect(res.headers['content-type']).to.not.exist();
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('does not send 204 for chunked transfer payloads', async () => {

            const server = Hapi.server();

            const handler = (request) => {

                const TestStream = class extends Stream.Readable {

                    _read() {

                        this.push('success');
                        this.push(null);
                    }
                };

                const stream = new TestStream();
                return stream;
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('success');
        });

        it('skips compression on empty', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response().type('text/html') });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(204);
            expect(res.result).to.equal(null);
            expect(res.headers['content-encoding']).to.not.exist();
        });

        it('skips compression on small payload', async () => {

            const server = Hapi.server({ compression: { minBytes: 10 } });
            server.route({ method: 'GET', path: '/', handler: (request, h) => 'hello' });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('hello');
            expect(res.headers['content-encoding']).to.not.exist();
        });

        it('skips compression for 206 responses', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('test').code(206) });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(206);
            expect(res.result).to.equal('test');
            expect(res.headers['content-length']).to.equal(4);
            expect(res.headers['content-encoding']).to.not.exist();
        });

        it('does not skip compression for chunked transfer payloads', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });

            const handler = (request, h) => {

                const TestStream = class extends Stream.Readable {

                    _read() {

                        this.push('success');
                        this.push(null);
                    }
                };

                const stream = new TestStream();
                return h.response(stream).type('text/html');
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.equal('gzip');
        });

        it('sets vary header when accept-encoding is present but does not match', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => 'abc' });
            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'example' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('accept-encoding');
        });

        it('handles stream errors on the response after the response has been piped (inject)', async () => {

            const handler = (request) => {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;
                    this.push('success');
                    setImmediate(() => this.emit('error', new Error('stream error')));
                };

                return stream;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const log = server.events.once('response');

            const err = await expect(server.inject('/')).to.reject(Boom.Boom);
            expect(err.output.statusCode).to.equal(499);
            expect(err.output.payload.error).to.equal('Unknown');
            expect(err.output.payload.message).to.equal('Response error');
            expect(err.data.request.response.message).to.equal('stream error');
            expect(err.data.request.raw.res.statusCode).to.equal(200);
            expect(err.data.request.raw.res.statusMessage).to.equal('OK');

            const [request] = await log;
            expect(request.response.message).to.equal('stream error');
            expect(request.response.output.statusCode).to.equal(500);
            expect(request.info.completed).to.be.above(0);
            expect(request.info.responded).to.equal(0);
        });

        it('handles stream errors on the response after the response has been piped (http)', async () => {

            const handler = (request) => {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('something');
                    setImmediate(() => this.emit('error', new Error('stream error')));
                };

                return stream;
            };

            const server = Hapi.server();
            const log = server.events.once('response');
            server.route({ method: 'GET', path: '/', handler });

            await server.start();
            const err = await expect(Wreck.get('http://localhost:' + server.info.port + '/')).to.reject();
            await server.stop();

            const [request] = await log;
            expect(err.data.res.statusCode).to.equal(200);
            expect(request.response.message).to.equal('stream error');
            expect(request.response.output.statusCode).to.equal(500);
            expect(request.info.completed).to.be.above(0);
            expect(request.info.responded).to.equal(0);
        });

        it('matches etag header list value', async () => {

            const server = Hapi.server();
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

            const server = Hapi.server({ compression: { minBytes: 1 } });
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

            const server = Hapi.server({ compression: { minBytes: 1 }, routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: (request, h) => h.file(__dirname + '/../package.json') });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-encoding']).to.equal('gzip');
            expect(res.headers['content-length']).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a plain file when not compressible', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 }, routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: (request, h) => h.file(__dirname + '/file/image.png') });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('image/png');
            expect(res.headers['content-encoding']).to.not.exist();
            expect(res.headers['content-length']).to.equal(42010);
            expect(res.headers.vary).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a plain file when compression disabled', async () => {

            const server = Hapi.server({ routes: { files: { relativeTo: __dirname } }, compression: false });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: (request, h) => h.file(__dirname + '/../package.json') });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } });
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-encoding']).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a deflated file in the response when the request accepts deflate', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 }, routes: { files: { relativeTo: __dirname } } });
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: (request, h) => h.file(__dirname + '/../package.json') });

            const res = await server.inject({ url: '/file', headers: { 'accept-encoding': 'deflate' } });
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-encoding']).to.equal('deflate');
            expect(res.headers['content-length']).to.not.exist();
            expect(res.payload).to.exist();
        });

        it('returns a gzipped stream response without a content-length header when accept-encoding is gzip', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/stream', handler: () => new internals.TimerStream() });

            const res = await server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.not.exist();
        });

        it('returns a deflated stream response without a content-length header when accept-encoding is deflate', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/stream', handler: () => new internals.TimerStream() });

            const res = await server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'deflate' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.not.exist();
        });

        it('returns a gzip response on a post request when accept-encoding: gzip is requested', async () => {

            const data = '{"test":"true"}';

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));

            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: gzip is requested', async () => {

            const data = '{"test":"true"}';

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => data });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a post request when accept-encoding: * is requested', async () => {

            const data = '{"test":"true"}';

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': '*' }, payload: data });
            expect(payload.toString()).to.equal(data);
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: * is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => data });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': '*' } });
            expect(payload.toString()).to.equal(data);
            await server.stop();
        });

        it('returns a deflate response on a post request when accept-encoding: deflate is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', Buffer.from(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'deflate' }, payload: data });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a deflate response on a get request when accept-encoding: deflate is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => data });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', Buffer.from(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'deflate' } });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a gzip response on a post request when accept-encoding: gzip;q=1, deflate;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'gzip;q=1, deflate;q=0.5' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: gzip;q=1, deflate;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => data });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'gzip;q=1, deflate;q=0.5' } });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a deflate response on a post request when accept-encoding: deflate;q=1, gzip;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', Buffer.from(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'deflate;q=1, gzip;q=0.5' }, payload: data });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a deflate response on a get request when accept-encoding: deflate;q=1, gzip;q=0.5 is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => data });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const deflated = await internals.compress('deflate', Buffer.from(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'deflate;q=1, gzip;q=0.5' } });
            expect(payload.toString()).to.equal(deflated.toString());
            await server.stop();
        });

        it('returns a gzip response on a post request when accept-encoding: deflate, gzip is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'deflate, gzip' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns a gzip response on a get request when accept-encoding: deflate, gzip is requested', async () => {

            const data = '{"test":"true"}';
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler: () => data });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const { payload } = await Wreck.get(uri, { headers: { 'accept-encoding': 'deflate, gzip' } });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('boom object reused does not affect encoding header.', async () => {

            const error = Boom.badRequest();
            const data = JSON.stringify(error.output.payload);
            const server = Hapi.server({ compression: { minBytes: 1 } });

            const handler = () => {

                throw error;
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
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
            const server = Hapi.server({ compression: { minBytes: 1 } });

            const handler = () => {

                throw error;
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const err1 = await expect(Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } })).to.reject();
            expect(err1.data.payload.toString()).to.equal(zipped.toString());

            const err2 = await expect(Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } })).to.reject();
            expect(err2.data.payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('returns an identity response on a post request when accept-encoding is missing', async () => {

            const data = '{"test":"true"}';

            const server = Hapi.server();
            server.route({ method: 'POST', path: '/', handler: (request) => request.payload });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.post(uri, { payload: data });
            expect(payload.toString()).to.equal(data);
            await server.stop();
        });

        it('returns an identity response on a get request when accept-encoding is missing', async () => {

            const data = '{"test":"true"}';

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => data
            });

            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.get(uri);
            expect(payload.toString().toString()).to.equal(data);
            await server.stop();
        });

        it('returns a gzip response when forced by the handler', async () => {

            const data = '{"test":"true"}';
            const zipped = await internals.compress('gzip', Buffer.from(data));
            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'POST', path: '/', handler: (request, h) => h.response(zipped).type('text/plain').header('content-encoding', 'gzip') });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { payload } = await Wreck.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data });
            expect(payload.toString()).to.equal(zipped.toString());
            await server.stop();
        });

        it('does not open file stream on 304', async () => {

            const server = Hapi.server();
            await server.register(Inert);
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            const res1 = await server.inject('/file');

            const preResponse = (request, h) => {

                request.response._marshal = function () {

                    throw new Error('not called');
                };

                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res2 = await server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } });
            expect(res2.statusCode).to.equal(304);
        });

        it('object listeners are maintained after transmission is complete', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            let response;
            let log;

            const preResponse = (request, h) => {

                response = request.response;
                response.events.registerEvent('special');
                log = response.events.once('special');
                return h.continue;
            };

            server.ext('onPreResponse', preResponse);
            await server.inject('/');
            response.events.emit('special');
            await log;
        });

        it('stops processing the stream when the connection closes', async () => {

            let stream;

            const ErrStream = class extends Stream.Readable {

                constructor(request) {

                    super();
                    this.request = request;
                    this.reads = 0;
                }

                _read(size) {

                    if (this.reads === 0) {
                        this.push('here is the response');
                        this.request.raw.res.destroy();
                    }
                    else {
                        // "Inifitely" push more content

                        process.nextTick(() => {

                            this.push('.');
                        });
                    }

                    ++this.reads;
                }
            };

            const server = Hapi.server();
            const log = server.events.once('response');
            server.route({ method: 'GET', path: '/stream', handler: (request, h) => {

                stream = new ErrStream(request);
                return h.response(stream).bytes(0);
            } });

            const err = await expect(server.inject({ url: '/stream', headers: { 'Accept-Encoding': 'gzip' } })).to.reject(Boom.Boom);
            expect(err.output.statusCode).to.equal(499);
            expect(err.output.payload.error).to.equal('Unknown');
            expect(err.output.payload.message).to.equal('Request close');
            expect(err.data.request.raw.res.statusCode).to.equal(204);
            expect(err.data.request.raw.res.statusMessage).to.equal('No Content');

            const [request] = await log;
            expect(request.response.output.statusCode).to.equal(499);
            expect(request.info.completed).to.be.above(0);
            expect(request.info.responded).to.equal(0);

            expect(stream.reads).to.equal(2);
        });

        it('does not truncate the response when stream finishes before response is done', async () => {

            const chunkTimes = 10;
            const filePath = __dirname + '/response.js';
            const block = Fs.readFileSync(filePath).toString();

            let expectedBody = '';
            for (let i = 0; i < chunkTimes; ++i) {
                expectedBody += block;
            }

            const handler = (request) => {

                const fileStream = new Stream.Readable();

                let readTimes = 0;
                fileStream._read = function (size) {

                    ++readTimes;
                    if (readTimes > chunkTimes) {
                        return this.push(null);
                    }

                    this.push(block);
                };

                return fileStream;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
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

            const handler = (request) => {

                const fileStream = new Stream.Readable();

                let readTimes = 0;
                fileStream._read = function (size) {

                    ++readTimes;
                    if (readTimes > chunkTimes) {
                        return this.push(null);
                    }

                    this.push(block);
                };

                return fileStream;
            };

            const config = {
                tls: {
                    key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                    cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
                }
            };

            const server = Hapi.server(config);
            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const { payload } = await Wreck.get('https://localhost:' + server.info.port, { rejectUnauthorized: false });
            expect(payload.toString()).to.equal(expectedBody);
            await server.stop();
        });

        it('destroy() stream when request aborts before stream drains', async () => {

            const server = Hapi.server();

            const team = new Teamwork.Team();
            const handler = (request) => {

                return new Stream.Readable({
                    read(size) {

                        const chunk = new Array(size).join('x');

                        setTimeout(() => {

                            this.push(chunk);
                        }, 10);
                    },
                    destroy() {

                        team.attend();
                    }
                });
            };

            server.route({ method: 'GET', path: '/', handler });

            await server.start();

            const res = await Wreck.request('GET', 'http://localhost:' + server.info.port);
            res.once('data', (chunk) => {

                res.destroy();
            });

            await team.work;
            await server.stop();

            expect(res.statusCode).to.equal(200);
        });

        it('destroy() stream when request timeouts before stream drains', async () => {

            const server = Hapi.server({ routes: { timeout: { server: 20, socket: 40 }, payload: { timeout: false } } });
            const team = new Teamwork.Team();

            const handler = (request) => {

                let count = 0;
                const stream = new Stream.Readable({
                    read(size) {

                        const timeout = 10 * count++;           // Must have back off here to hit the socket timeout

                        setTimeout(() => {

                            if (request._isFinalized) {
                                stream.push(null);
                                return;
                            }

                            stream.push(new Array(size).join('x'));

                        }, timeout);
                    },
                    destroy() {

                        team.attend();
                    }
                });

                return stream;
            };

            server.route({ method: 'GET', path: '/', handler });

            await server.start();

            const res = await Wreck.request('GET', 'http://localhost:' + server.info.port);
            res.on('data', (chunk) => { });

            await team.work;
            await server.stop();

            expect(res.statusCode).to.equal(200);
        });

        it('destroy() stream when request aborts before stream drains', async () => {

            const server = Hapi.server();

            const team = new Teamwork.Team();
            const handler = async (request) => {

                clientRequest.destroy();

                const stream = new Stream.Readable({
                    read(size) {

                        const chunk = new Array(size).join('x');

                        setTimeout(() => {

                            this.push(chunk);
                        }, 10);
                    },
                    destroy() {

                        team.attend();
                    }
                });

                await Hoek.wait(100);
                return stream;
            };

            server.route({ method: 'GET', path: '/', handler });

            await server.start();

            const clientRequest = Http.request({
                hostname: 'localhost',
                port: server.info.port,
                method: 'GET'
            });

            clientRequest.on('error', Hoek.ignore);
            clientRequest.end();

            await team.work;
            await server.stop();
        });

        it('changes etag when content-encoding set manually', async () => {

            const payload = new Array(1000).fill('x').join();
            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response(payload).header('content-encoding', 'gzip').etag('abc') });

            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.exist();
            expect(res.headers.etag).to.match(/-gzip"$/);
            expect(res.headers.vary).to.equal('accept-encoding');
        });

        it('changes etag without vary when content-encoding set via compressed', async () => {

            const payload = new Array(1000).fill('x').join();
            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response(payload).compressed('gzip').etag('abc') });

            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.exist();
            expect(res.headers.etag).to.equal('"abc-gzip"');
            expect(res.headers['content-encoding']).to.equal('gzip');
            expect(res.headers.vary).to.not.exist();
        });

        it('head request retains content-length header', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('x').bytes(1) });

            const res = await server.inject({ method: 'HEAD', url: '/' });
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(1);
        });

        it('does not set accept-encoding multiple times', async () => {

            const upstream = Hapi.server();
            upstream.route({ method: 'GET', path: '/headers', handler: (request, h) => h.response({ status: 'success' }).vary('X-Custom3') });
            await upstream.start();

            const proxyHandler = async (request, h) => {

                const options = {};
                options.headers = Hoek.clone(request.headers);
                delete options.headers.host;

                const res = await Wreck.request(request.method, 'http://localhost:' + upstream.info.port + '/headers', options);
                return h.response(res).code(res.statusCode);
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/headers', handler: proxyHandler });

            const res = await server.inject({ url: '/headers', headers: { 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('X-Custom3,accept-encoding');

            await upstream.stop();
        });

        it('ends response stream once', async () => {

            const server = Hapi.server();

            let count = 0;
            const onRequest = (request, h) => {

                const res = request.raw.res;
                const orig = res.end;

                res.end = function () {

                    ++count;
                    return orig.call(res);
                };

                return h.continue;
            };

            server.ext('onRequest', onRequest);
            await server.inject('/');
            expect(count).to.equal(1);
        });

        describe('response range', () => {

            const fileStreamHandler = (request, h) => {

                const filePath = Path.join(__dirname, 'file', 'image.png');
                return h.response(Fs.createReadStream(filePath)).bytes(Fs.statSync(filePath).size).etag('some-tag');
            };

            it('returns a subset of a fileStream (start)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=0-4' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 0-4/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('\x89PNG\r');
            });

            it('ignores range request when disabled', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler, options: { response: { ranges: false } } });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=0-4' } });
                expect(res.statusCode).to.equal(200);
            });

            it('returns a subset of a fileStream (middle)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=1-5' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 1-5/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.payload).to.equal('PNG\r\n');
            });

            it('returns a subset of a fileStream (-to)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=-5' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns a subset of a fileStream (from-)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns a subset of a fileStream (beyond end)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(5);
                expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
            });

            it('returns a subset of a fileStream (if-range)', async () => {

                const server = Hapi.server();
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

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': 'abc' } });
                expect(res.statusCode).to.equal(200);
            });

            it('returns 416 on invalid range (unit)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'horses=1-5' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 416 on invalid range (inversed)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=5-1' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 416 on invalid range (format)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes 1-5' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 416 on invalid range (empty range)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=-' } });
                expect(res.statusCode).to.equal(416);
                expect(res.headers['content-range']).to.equal('bytes */42010');
            });

            it('returns 200 on multiple ranges', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                const res = await server.inject({ url: '/file', headers: { 'range': 'bytes=1-5,7-10' } });
                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(42010);
            });

            it('returns a subset of a stream', async () => {

                const TestStream = class extends Stream.Readable {

                    constructor() {

                        super();
                        this._count = -1;
                    }

                    _read(size) {

                        this._count++;

                        if (this._count > 10) {
                            return;
                        }

                        if (this._count === 10) {
                            this.push(null);
                            return;
                        }

                        this.push(this._count.toString());
                    }

                    size() {

                        return 10;
                    }
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: () => new TestStream() });

                const res = await server.inject({ url: '/', headers: { 'range': 'bytes=2-4' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(3);
                expect(res.headers['content-range']).to.equal('bytes 2-4/10');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.payload).to.equal('234');
            });

            it('returns a consolidated range', async () => {

                const TestStream = class extends Stream.Readable {

                    constructor() {

                        super();
                        this._count = -1;
                    }

                    _read(size) {

                        this._count++;

                        if (this._count > 10) {
                            return;
                        }

                        if (this._count === 10) {
                            this.push(null);
                            return;
                        }

                        this.push(this._count.toString());
                    }

                    size() {

                        return 10;
                    }
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: () => new TestStream() });

                const res = await server.inject({ url: '/', headers: { 'range': 'bytes=0-1,1-2, 3-5' } });
                expect(res.statusCode).to.equal(206);
                expect(res.headers['content-length']).to.equal(6);
                expect(res.headers['content-range']).to.equal('bytes 0-5/10');
                expect(res.headers['accept-ranges']).to.equal('bytes');
                expect(res.payload).to.equal('012345');
            });
        });

        it('skips undefined header values', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').header('x', undefined) });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.x).to.not.exist();
        });

        it('does not add connection close header to normal requests', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.connection).to.not.equal('close');
        });

        it('returns 500 when node rejects a header', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response('ok').header('x', '1').header('', 'test') });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.headers.x).to.not.exist();
        });

        it('returns 500 for out of range status code', async () => {

            const server = Hapi.server();

            const handler = (request, h) => {

                // Patch writeHead to always fail on out of range headers

                const origWriteHead = request.raw.res.writeHead;
                request.raw.res.writeHead = function (statusCode, ...args) {

                    statusCode |= 0;
                    if (statusCode < 100 || statusCode > 999) {
                        throw new RangeError(`Invalid status code: ${statusCode}`);
                    }

                    return origWriteHead.call(this, statusCode, ...args);
                };

                return h.response('ok').code(1);
            };

            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('permits ending reading request stream while transmitting response.', async (flags) => {

            const server = Hapi.server();

            server.route({
                method: 'post',
                path: '/',
                options: {
                    payload: {
                        output: 'stream'
                    }
                },
                handler: (request, h) => {

                    const stream = new Stream.PassThrough();

                    // Start transmitting stream response...
                    stream.push('hello ');

                    Bounce.background(async () => {

                        await Events.once(request.raw.res, 'pipe');

                        // ...but also only read and end the request once the response is transmitting...
                        request.raw.req.on('data', Hoek.ignore);
                        await Events.once(request.raw.req, 'end');

                        // ...and finally end the intended response once the request stream has ended.
                        stream.end('world');
                    });

                    return h.response(stream);
                }
            });

            flags.onCleanup = () => server.stop();
            await server.start();

            const req = Http.request({
                hostname: 'localhost',
                port: server.info.port,
                method: 'post'
            });

            req.end('{}');

            const [res] = await Events.once(req, 'response');

            let result = '';
            for await (const chunk of res) {
                result += chunk.toString();
            }

            // If not permitted then result will be "hello " without "world"
            expect(result).to.equal('hello world');
        });
    });

    describe('length()', () => {

        it('ignores NaN content-length', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', options: { handler: (request, h) => h.response().header('Content-Length', 'x') } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.not.exist();
        });
    });

    describe('encoding()', () => {

        it('passes compressor to stream', async () => {

            const handler = (request, h) => {

                const TestStream = class extends Stream.Readable {

                    _read(size) {

                        if (this.isDone) {
                            return;
                        }

                        this.isDone = true;

                        this.push('some payload');
                        this._compressor.flush();

                        setTimeout(() => {

                            this.push(' and some other payload');
                            this.push(null);
                        }, 10);
                    }

                    setCompressor(compressor) {

                        this._compressor = compressor;
                    }
                };

                return h.response(new TestStream()).type('text/html');
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
            const uncompressed = await internals.uncompress('unzip', res.rawPayload);
            expect(uncompressed.toString()).to.equal('some payload and some other payload');
        });
    });

    describe('writeHead()', () => {

        it('set custom statusMessage', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response({}).message('Great') });
            await server.start();

            const uri = 'http://localhost:' + server.info.port;
            const { res } = await Wreck.get(uri);
            expect(res.statusMessage).to.equal('Great');
            await server.stop();
        });
    });

    describe('chain()', () => {

        it('handles stream errors on the response after the response has been piped', async () => {

            const handler = (request, h) => {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('something');
                    this.emit('error', new Error());
                };

                return h.response(stream).type('text/html');
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });

            const err = await expect(server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } })).to.reject(Boom.Boom);
            expect(err.output.statusCode).to.equal(499);
        });
    });
});


internals.TimerStream = class extends Stream.Readable {

    _read(size) {

        if (this.isDone) {
            return;
        }

        this.isDone = true;

        setTimeout(() => {

            this.push('hi');
            this.push(null);
        }, 5);
    }
};


internals.compress = function (encoder, value) {

    return new Promise((resolve) => Zlib[encoder](value, (ignoreErr, compressed) => resolve(compressed)));
};


internals.uncompress = function (decoder, value) {

    return new Promise((resolve) => Zlib[decoder](value, (ignoreErr, uncompressed) => resolve(uncompressed)));
};
