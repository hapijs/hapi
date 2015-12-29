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

        it('returns valid http date responses in last-modified header', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['last-modified']).to.equal(Fs.statSync(__dirname + '/../package.json').mtime.toUTCString());
                done();
            });
        });

        it('returns 200 if if-modified-since is invalid', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject({ url: '/file', headers: { 'if-modified-since': 'some crap' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('returns 200 if last-modified is invalid', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const handler = function (request, reply) {

                return reply('ok').header('last-modified', 'some crap');
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { 'if-modified-since': 'Fri, 28 Mar 2014 22:52:39 GMT' } }, (res2) => {

                expect(res2.statusCode).to.equal(200);
                done();
            });
        });

        it('closes file handlers when not reading file stream', { skip: process.platform === 'win32' }, (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res1) => {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
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
                        done();
                    });

                    cmd.stdin.end();
                });
            });
        });

        it('closes file handlers when not using a manually open file stream', { skip: process.platform === 'win32' }, (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(Fs.createReadStream(__dirname + '/../package.json')).header('etag', 'abc');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', (res1) => {

                server.inject({ url: '/file', headers: { 'if-none-match': res1.headers.etag } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
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
                        done();
                    });

                    cmd.stdin.end();
                });
            });
        });

        it('returns a 304 when the request has if-modified-since and the response has not been modified since (larger)', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res1) => {

                const last = new Date(Date.parse(res1.headers['last-modified']) + 1000);
                server.inject({ url: '/file', headers: { 'if-modified-since': last.toUTCString() } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers['content-length']).to.not.exist();
                    expect(res2.headers.etag).to.exist();
                    expect(res2.headers['last-modified']).to.exist();
                    done();
                });
            });
        });

        it('returns a 304 when the request has if-modified-since and the response has not been modified since (equal)', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res1) => {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers['content-length']).to.not.exist();
                    expect(res2.headers.etag).to.exist();
                    expect(res2.headers['last-modified']).to.exist();
                    done();
                });
            });
        });

        it('matches etag with content-encoding', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/', handler: { file: __dirname + '/../package.json' } });

            // Initial request - no etag

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);

                // Second request - etag

                server.inject('/', (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.headers.etag).to.exist();
                    expect(res2.headers.etag).to.not.contain('-');

                    const baseTag = res2.headers.etag.slice(0, -1);
                    const gzipTag = baseTag + '-gzip"';

                    // Conditional request

                    server.inject({ url: '/', headers: { 'if-none-match': res2.headers.etag } }, (res3) => {

                        expect(res3.statusCode).to.equal(304);
                        expect(res3.headers.etag).to.equal(res2.headers.etag);

                        // Conditional request with accept-encoding

                        server.inject({ url: '/', headers: { 'if-none-match': res2.headers.etag, 'accept-encoding': 'gzip' } }, (res4) => {

                            expect(res4.statusCode).to.equal(304);
                            expect(res4.headers.etag).to.equal(gzipTag);

                            // Conditional request with vary etag

                            server.inject({ url: '/', headers: { 'if-none-match': res4.headers.etag, 'accept-encoding': 'gzip' } }, (res5) => {

                                expect(res5.statusCode).to.equal(304);
                                expect(res5.headers.etag).to.equal(gzipTag);

                                // Request with accept-encoding (gzip)

                                server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } }, (res6) => {

                                    expect(res6.statusCode).to.equal(200);
                                    expect(res6.headers.etag).to.equal(gzipTag);

                                    // Request with accept-encoding (deflate)

                                    server.inject({ url: '/', headers: { 'accept-encoding': 'deflate' } }, (res7) => {

                                        expect(res7.statusCode).to.equal(200);
                                        expect(res7.headers.etag).to.equal(baseTag + '-deflate"');

                                        // Conditional request with accept-encoding (gzip)

                                        server.inject({ url: '/', headers: { 'if-none-match': res7.headers.etag, 'accept-encoding': 'gzip' } }, (res8) => {

                                            expect(res8.statusCode).to.equal(304);
                                            expect(res8.headers.etag).to.equal(gzipTag);
                                            done();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        it('returns 304 when manually set to 304', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply().code(304);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(304);
                done();
            });
        });

        it('returns a stream reply with custom response headers', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject('/stream', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.custom).to.equal('header');
                done();
            });
        });

        it('returns a stream reply with custom response status code', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject('/stream', (res) => {

                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('returns an JSONP response', (done) => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', (res) => {

                expect(res.payload).to.equal('/**/me({"some":"value"});');
                expect(res.headers['content-length']).to.equal(25);
                expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
                done();
            });
        });

        it('returns an JSONP response (no charset)', (done) => {

            const handler = function (request, reply) {

                return reply({ some: 'value' }).charset('');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', (res) => {

                expect(res.payload).to.equal('/**/me({"some":"value"});');
                expect(res.headers['content-length']).to.equal(25);
                expect(res.headers['content-type']).to.equal('text/javascript');
                done();
            });
        });

        it('returns a X-Content-Type-Options: nosniff header on JSONP responses', (done) => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', (res) => {

                expect(res.payload).to.equal('/**/me({"some":"value"});');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });
        });

        it('returns a normal response when JSONP enabled but not requested', (done) => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('{"some":"value"}');
                done();
            });
        });

        it('returns an JSONP response with compression', (done) => {

            const handler = function (request, reply) {

                const parts = request.params.name.split('/');
                return reply({ first: parts[0], last: parts[1] });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/user/{name*2}',
                config: {
                    handler: handler,
                    jsonp: 'callback'
                }
            });

            server.inject({ url: '/user/1/2?callback=docall', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers.vary).to.equal('accept-encoding');
                Zlib.unzip(res.rawPayload, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result.toString()).to.equal('/**/docall({"first":"1","last":"2"});');
                    done();
                });
            });
        });

        it('returns an JSONP response when response is a buffer', (done) => {

            const handler = function (request, reply) {

                return reply(new Buffer('value'));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', (res) => {

                expect(res.payload).to.equal('/**/me(value);');
                expect(res.headers['content-length']).to.equal(14);
                done();
            });
        });

        it('returns response on bad JSONP parameter', (done) => {

            const handler = function (request, reply) {

                return reply({ some: 'value' });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me*', (res) => {

                expect(res.result).to.exist();
                expect(res.result.message).to.equal('Invalid JSONP parameter value');
                done();
            });
        });

        it('returns an JSONP handler error', (done) => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest('wrong'));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            server.inject('/?callback=me', (res) => {

                expect(res.payload).to.equal('/**/me({"statusCode":400,"error":"Bad Request","message":"wrong"});');
                expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
                done();
            });
        });

        it('returns an JSONP state error', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { jsonp: 'callback', handler: handler } });

            let validState = false;
            const preResponse = function (request, reply) {

                validState = request.state && typeof request.state === 'object';
                reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.inject({ method: 'GET', url: '/?callback=me', headers: { cookie: '+' } }, (res) => {

                expect(res.payload).to.equal('/**/me({"statusCode":400,"error":"Bad Request","message":"Invalid cookie header"});');
                expect(res.headers['content-type']).to.equal('text/javascript; charset=utf-8');
                expect(validState).to.equal(true);
                done();
            });
        });

        it('sets caching headers', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/public/{path*}', config: { cache: { privacy: 'public', expiresIn: 24 * 60 * 60 * 1000 } }, handler: { directory: { path: __dirname, listing: false, index: false } } });

            server.inject('/public/transmit.js', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=86400, must-revalidate, public');
                done();
            });
        });
    });

    describe('transmit()', () => {

        it('sends empty payload on 204', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply('ok').code(204);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(204);
                expect(res.result).to.equal(null);
                done();
            });
        });

        it('sends 204 on empty payload', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { response: { emptyStatusCode: 204 } } });

            const handler = function (request, reply) {

                return reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(204);
                expect(res.result).to.equal(null);
                done();
            });
        });

        it('does not send 204 for chunked transfer payloads', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { response: { emptyStatusCode: 204 } } });

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

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('success');
                done();
            });
        });

        it('skips compression on empty', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply().type('text/html');
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(null);
                expect(res.headers['content-encoding']).to.not.exist();
                done();
            });
        });

        it('does not skip compression for chunked transfer payloads', (done) => {

            const server = new Hapi.Server();
            server.connection();

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

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-encoding']).to.equal('gzip');
                done();
            });
        });

        it('sets vary header when accept-encoding is present but does not match', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply('abc');
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject({ url: '/', headers: { 'accept-encoding': 'example' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('accept-encoding');
                done();
            });
        });

        it('handles stream errors on the response after the response has been piped', (done) => {

            const handler = function (request, reply) {

                const TestStream = function () {

                    Stream.Readable.call(this);
                };

                Hoek.inherits(TestStream, Stream.Readable);

                TestStream.prototype._read = function (size) {

                    if (this.isDone) {
                        return;
                    }
                    this.isDone = true;

                    this.push('success');

                    setImmediate(() => {

                        this.emit('error', new Error());
                    });
                };

                const stream = new TestStream();
                return reply(stream);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('success');
                done();
            });
        });

        it('matches etag header list value', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res1) => {

                server.inject('/file', (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.headers.etag).to.exist();

                    server.inject({ url: '/file', headers: { 'if-none-match': 'x, ' + res2.headers.etag } }, (res3) => {

                        expect(res3.statusCode).to.equal(304);
                        done();
                    });
                });
            });
        });

        it('changes etag when content encoding is used', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res1) => {

                server.inject('/file', (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.headers.etag).to.exist();
                    expect(res2.headers['last-modified']).to.exist();

                    server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, (res3) => {

                        expect(res3.statusCode).to.equal(200);
                        expect(res3.headers.vary).to.equal('accept-encoding');
                        expect(res3.headers.etag).to.not.equal(res2.headers.etag);
                        expect(res3.headers.etag).to.equal(res2.headers.etag.slice(0, -1) + '-gzip"');
                        expect(res3.headers['last-modified']).to.equal(res2.headers['last-modified']);
                        done();
                    });
                });
            });
        });

        it('returns a gzipped file in the response when the request accepts gzip', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } } });
            const handler = function (request, reply) {

                return reply.file(__dirname + '/../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-encoding']).to.equal('gzip');
                expect(res.headers['content-length']).to.not.exist();
                expect(res.payload).to.exist();
                done();
            });
        });

        it('returns a plain file when not compressible', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } } });
            const handler = function (request, reply) {

                return reply.file(__dirname + '/file/image.png');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.headers['content-type']).to.equal('image/png');
                expect(res.headers['content-encoding']).to.not.exist();
                expect(res.headers['content-length']).to.equal(42010);
                expect(res.payload).to.exist();
                done();
            });
        });

        it('returns a plain file when compression disabled', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } }, compression: false });
            const handler = function (request, reply) {

                return reply.file(__dirname + '/../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-encoding']).to.not.exist();
                expect(res.payload).to.exist();
                done();
            });
        });

        it('returns a deflated file in the response when the request accepts deflate', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } } });
            const handler = function (request, reply) {

                return reply.file(__dirname + '/../package.json');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject({ url: '/file', headers: { 'accept-encoding': 'deflate' } }, (res) => {

                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-encoding']).to.equal('deflate');
                expect(res.headers['content-length']).to.not.exist();
                expect(res.payload).to.exist();
                done();
            });
        });

        it('returns a gzipped stream reply without a content-length header when accept-encoding is gzip', (done) => {

            const streamHandler = function (request, reply) {

                return reply(new internals.TimerStream());
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.not.exist();
                done();
            });
        });

        it('returns a deflated stream reply without a content-length header when accept-encoding is deflate', (done) => {

            const streamHandler = function (request, reply) {

                return reply(new internals.TimerStream());
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server.inject({ url: '/stream', headers: { 'Content-Type': 'application/json', 'accept-encoding': 'deflate' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.not.exist();
                done();
            });
        });

        it('returns a gzip response on a post request when accept-encoding: gzip is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.gzip(new Buffer(data), (err, zipped) => {

                    expect(err).to.not.exist();

                    Wreck.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a gzip response on a get request when accept-encoding: gzip is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.gzip(new Buffer(data), (err, zipped) => {

                    expect(err).to.not.exist();

                    Wreck.get(uri, { headers: { 'accept-encoding': 'gzip' } }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a gzip response on a post request when accept-encoding: * is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Wreck.post(uri, { headers: { 'accept-encoding': '*' }, payload: data }, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(data);
                    server.stop(done);
                });
            });
        });

        it('returns a gzip response on a get request when accept-encoding: * is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Wreck.get(uri, { headers: { 'accept-encoding': '*' } }, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(data);
                    server.stop(done);
                });
            });
        });

        it('returns a deflate response on a post request when accept-encoding: deflate is requested', (done) => {

            const data = '{"test":"true"}';
            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.deflate(new Buffer(data), (err, deflated) => {

                    expect(err).to.not.exist();

                    Wreck.post(uri, { headers: { 'accept-encoding': 'deflate' }, payload: data }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(deflated.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a deflate response on a get request when accept-encoding: deflate is requested', (done) => {

            const data = '{"test":"true"}';
            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.deflate(new Buffer(data), (err, deflated) => {

                    expect(err).to.not.exist();

                    Wreck.get(uri, { headers: { 'accept-encoding': 'deflate' } }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(deflated.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a gzip response on a post request when accept-encoding: gzip;q=1, deflate;q=0.5 is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.gzip(new Buffer(data), (err, zipped) => {

                    expect(err).to.not.exist();

                    Wreck.post(uri, { headers: { 'accept-encoding': 'gzip;q=1, deflate;q=0.5' }, payload: data }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a gzip response on a get request when accept-encoding: gzip;q=1, deflate;q=0.5 is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.gzip(new Buffer(data), (err, zipped) => {

                    expect(err).to.not.exist();

                    Wreck.get(uri, { headers: { 'accept-encoding': 'gzip;q=1, deflate;q=0.5' } }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a deflate response on a post request when accept-encoding: deflate;q=1, gzip;q=0.5 is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.deflate(new Buffer(data), (err, deflated) => {

                    expect(err).to.not.exist();

                    Wreck.post(uri, { headers: { 'accept-encoding': 'deflate;q=1, gzip;q=0.5' }, payload: data }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(deflated.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a deflate response on a get request when accept-encoding: deflate;q=1, gzip;q=0.5 is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.deflate(new Buffer(data), (err, deflated) => {

                    expect(err).to.not.exist();

                    Wreck.get(uri, { headers: { 'accept-encoding': 'deflate;q=1, gzip;q=0.5' } }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(deflated.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a gzip response on a post request when accept-encoding: deflate, gzip is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.gzip(new Buffer(data), (err, zipped) => {

                    expect(err).to.not.exist();

                    Wreck.post(uri, { headers: { 'accept-encoding': 'deflate, gzip' }, payload: data }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns a gzip response on a get request when accept-encoding: deflate, gzip is requested', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(data);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Zlib.gzip(new Buffer(data), (err, zipped) => {

                    expect(err).to.not.exist();

                    Wreck.get(uri, { headers: { 'accept-encoding': 'deflate, gzip' } }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });
            });
        });

        it('returns an identity response on a post request when accept-encoding is missing', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Wreck.post(uri, { payload: data }, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(data);
                    server.stop(done);
                });
            });
        });

        it('returns an identity response on a get request when accept-encoding is missing', (done) => {

            const data = '{"test":"true"}';

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(data);
                }
            });

            server.start((err) => {

                expect(err).to.not.exist();

                const uri = 'http://localhost:' + server.info.port;

                Wreck.get(uri, {}, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString().toString()).to.equal(data);
                    server.stop(done);
                });
            });
        });

        it('returns a gzip response when forced by the handler', (done) => {

            const data = '{"test":"true"}';

            Zlib.gzip(new Buffer(data), (err, zipped) => {

                expect(err).to.not.exist();

                const server = new Hapi.Server();
                server.connection();

                const handler = function (request, reply) {

                    return reply(zipped).type('text/plain').header('content-encoding', 'gzip');
                };

                server.route({ method: 'POST', path: '/', handler: handler });
                server.start((err) => {

                    expect(err).to.not.exist();

                    const uri = 'http://localhost:' + server.info.port;

                    Wreck.post(uri, { headers: { 'accept-encoding': 'gzip' }, payload: data }, (err, res, body) => {

                        expect(err).to.not.exist();
                        expect(body.toString()).to.equal(zipped.toString());
                        server.stop(done);
                    });
                });

            });
        });

        it('does not open file stream on 304', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' } });

            server.inject('/file', (res1) => {

                const preResponse = function (request, reply) {

                    request.response._marshal = function () {

                        throw new Error('not called');
                    };

                    return reply.continue();
                };

                server.ext('onPreResponse', preResponse);

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers.date } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    done();
                });
            });
        });

        it('object listeners are maintained after transmission is complete', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            let response;
            const preResponse = function (request, reply) {

                response = request.response;
                response.once('special', () => {

                    done();
                });

                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.inject('/', (res) => {

                response.emit('special');
            });
        });

        it('stops processing the stream when the request closes', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/stream', handler: handler });

            server.inject({ url: '/stream', headers: { 'Accept-Encoding': 'gzip' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('does not truncate the response when stream finishes before response is done', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/', handler: fileHandler });
            server.start((err) => {

                expect(err).to.not.exist();

                Wreck.get('http://localhost:' + server.info.port, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(expectedBody);
                    server.stop(done);
                });
            });
        });

        it('does not truncate the response when stream finishes before response is done using https', (done) => {

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

            const server = new Hapi.Server();
            server.connection(config);
            server.route({ method: 'GET', path: '/', handler: fileHandler });
            server.start((err) => {

                expect(err).to.not.exist();

                Wreck.get('https://localhost:' + server.info.port, { rejectUnauthorized: false }, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal(expectedBody);
                    server.stop(done);
                });
            });
        });

        it('does not leak stream data when request aborts before stream drains', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let destroyed = false;
            const handler = function (request, reply) {

                const stream = new Stream.Readable();

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

                    server.stop(done);
                });

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.start((err) => {

                expect(err).to.not.exist();

                Wreck.request('GET', 'http://localhost:' + server.info.port, {}, (err, res) => {

                    expect(err).to.not.exist();

                    res.on('data', (chunk) => {

                        if (!destroyed) {
                            destroyed = true;
                            res.destroy();
                        }
                    });
                });
            });
        });

        it('does not leak classic stream data when passed to request and aborted', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

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

                stream.once('end', () => {

                    server.stop(done);
                });

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.start((err) => {

                expect(err).to.not.exist();

                Wreck.request('GET', 'http://localhost:' + server.info.port, {}, (err, res) => {

                    expect(err).to.not.exist();

                    res.on('data', (chunk) => {

                        if (!destroyed) {
                            destroyed = true;
                            res.destroy();
                        }
                    });
                });
            });
        });

        it('does not leak stream data when request timeouts before stream drains', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 20, socket: 40 }, payload: { timeout: false } } });

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

                    server.stop(done);
                });

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.start((err) => {

                expect(err).to.not.exist();

                Wreck.request('GET', 'http://localhost:' + server.info.port, {}, (err, res) => {

                    expect(err).to.not.exist();
                    res.on('data', (chunk) => { });
                });
            });
        });

        it('does not leak stream data when request aborts before stream is returned', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let clientRequest;
            const handler = function (request, reply) {

                clientRequest.abort();

                const stream = new Stream.Readable();
                let responded = false;

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

                    server.stop(done);
                });

                setTimeout(() => {

                    return reply(stream);
                }, 100);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.start((err) => {

                expect(err).to.not.exist();

                clientRequest = Http.request({
                    hostname: 'localhost',
                    port: server.info.port,
                    method: 'GET'
                });
                clientRequest.on('error', () => { /* NOP */ });
                clientRequest.end();
            });
        });

        it('changes etag when content-encoding set manually', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const handler = function (request, reply) {

                return reply('x').header('content-encoding', 'gzip').etag('abc');
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.exist();
                expect(res.headers.etag).to.match(/-gzip"$/);
                done();
            });
        });

        it('head request retains content-length header', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const handler = function (request, reply) {

                return reply('x').bytes(1);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'HEAD', url: '/' }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(1);
                done();
            });
        });

        it('does not set accept-encoding multiple times', (done) => {

            const headersHandler = function (request, reply) {

                reply({ status: 'success' })
                    .vary('X-Custom3');
            };

            const upstream = new Hapi.Server();
            upstream.connection();
            upstream.route({ method: 'GET', path: '/headers', handler: headersHandler });
            upstream.start(() => {

                const proxyHandler = function (request, reply) {

                    const options = {};
                    options.headers = Hoek.clone(request.headers);
                    delete options.headers.host;

                    Wreck.request(request.method, 'http://localhost:' + upstream.info.port + '/headers', options, (err, res) => {

                        expect(err).to.not.exist();
                        reply(res).code(res.statusCode);
                    });
                };

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/headers', handler: proxyHandler });

                server.inject({ url: '/headers', headers: { 'accept-encoding': 'gzip' } }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers.vary).to.equal('X-Custom3,accept-encoding');

                    upstream.stop(done);
                });
            });
        });

        it('ends response stream once', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let count = 0;
            const onRequest = function (request, reply) {

                const res = request.raw.res;
                const orig = res.end;

                res.end = function () {

                    ++count;
                    return orig.call(res);
                };

                reply.continue();
            };

            server.ext('onRequest', onRequest);
            server.inject('/', (res) => {

                expect(count).to.equal(1);
                done();
            });
        });

        describe('response range', () => {

            const fileStreamHandler = function (request, reply) {

                const filePath = Path.join(__dirname, 'file', 'image.png');
                return reply(Fs.createReadStream(filePath)).bytes(Fs.statSync(filePath).size);
            };

            it('returns a subset of a fileStream (start)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=0-4' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(5);
                    expect(res.headers['content-range']).to.equal('bytes 0-4/42010');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.rawPayload.toString('binary')).to.equal('\x89PNG\r');
                    done();
                });
            });

            it('returns a subset of a fileStream (middle)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=1-5' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(5);
                    expect(res.headers['content-range']).to.equal('bytes 1-5/42010');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.payload).to.equal('PNG\r\n');
                    done();
                });
            });

            it('returns a subset of a fileStream (-to)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=-5' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(5);
                    expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
                    done();
                });
            });

            it('returns a subset of a fileStream (from-)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=42005-' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(5);
                    expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
                    done();
                });
            });

            it('returns a subset of a fileStream (beyond end)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(5);
                    expect(res.headers['content-range']).to.equal('bytes 42005-42009/42010');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
                    done();
                });
            });

            it('returns a subset of a fileStream (if-range)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject('/file', (res) => {

                    server.inject('/file', (res1) => {

                        server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': res1.headers.etag } }, (res2) => {

                            expect(res2.statusCode).to.equal(206);
                            expect(res2.headers['content-length']).to.equal(5);
                            expect(res2.headers['content-range']).to.equal('bytes 42005-42009/42010');
                            expect(res2.headers['accept-ranges']).to.equal('bytes');
                            expect(res2.rawPayload.toString('binary')).to.equal('D\xAEB\x60\x82');
                            done();
                        });
                    });
                });
            });

            it('returns 200 on incorrect if-range', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=42005-42011', 'if-range': 'abc' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    done();
                });
            });

            it('returns 416 on invalid range (unit)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'horses=1-5' } }, (res) => {

                    expect(res.statusCode).to.equal(416);
                    expect(res.headers['content-range']).to.equal('bytes */42010');
                    done();
                });
            });

            it('returns 416 on invalid range (inversed)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=5-1' } }, (res) => {

                    expect(res.statusCode).to.equal(416);
                    expect(res.headers['content-range']).to.equal('bytes */42010');
                    done();
                });
            });

            it('returns 416 on invalid range (format)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes 1-5' } }, (res) => {

                    expect(res.statusCode).to.equal(416);
                    expect(res.headers['content-range']).to.equal('bytes */42010');
                    done();
                });
            });

            it('returns 416 on invalid range (empty range)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=-' } }, (res) => {

                    expect(res.statusCode).to.equal(416);
                    expect(res.headers['content-range']).to.equal('bytes */42010');
                    done();
                });
            });

            it('returns 200 on multiple ranges', (done) => {

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/file', handler: fileStreamHandler });

                server.inject({ url: '/file', headers: { 'range': 'bytes=1-5,7-10' } }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['content-length']).to.equal(42010);
                    done();
                });
            });

            it('returns a subset of a stream', (done) => {

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
                server.connection();
                const handler = function (request, reply) {

                    return reply(new TestStream());
                };

                server.route({ method: 'GET', path: '/', handler: handler });

                server.inject({ url: '/', headers: { 'range': 'bytes=2-4' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(3);
                    expect(res.headers['content-range']).to.equal('bytes 2-4/10');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.payload).to.equal('234');
                    done();
                });
            });

            it('returns a consolidated range', (done) => {

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
                server.connection();
                const handler = function (request, reply) {

                    return reply(new TestStream());
                };

                server.route({ method: 'GET', path: '/', handler: handler });

                server.inject({ url: '/', headers: { 'range': 'bytes=0-1,1-2, 3-5' } }, (res) => {

                    expect(res.statusCode).to.equal(206);
                    expect(res.headers['content-length']).to.equal(6);
                    expect(res.headers['content-range']).to.equal('bytes 0-5/10');
                    expect(res.headers['accept-ranges']).to.equal('bytes');
                    expect(res.payload).to.equal('012345');
                    done();
                });
            });
        });

        it('skips undefined header values', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply('ok').header('x', undefined);
            };

            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.x).to.not.exist();
                done();
            });
        });
    });

    describe('cache()', () => {

        it('sets max-age value (method and route)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const method = function (id, next) {

                return next(null, {
                    'id': 'fa0dbda9b1b',
                    'name': 'John Doe'
                });
            };

            server.method('profile', method, { cache: { expiresIn: 120000, generateTimeout: 10 } });

            const profileHandler = function (request, reply) {

                server.methods.profile(0, reply);
            };

            server.route({ method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { expiresIn: 120000, privacy: 'private' } } });
            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/profile', (res) => {

                    expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate, private');
                    server.stop(done);
                });
            });
        });

        it('sets max-age value (expiresAt)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply();
            };

            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { expiresAt: '10:00' } } });
            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res) => {

                    expect(res.headers['cache-control']).to.match(/^max-age=\d+, must-revalidate$/);
                    server.stop(done);
                });
            });
        });

        it('returns no-cache on error', (done) => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest());
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { expiresIn: 120000 } } });
            server.inject('/', (res) => {

                expect(res.headers['cache-control']).to.equal('no-cache');
                done();
            });
        });

        it('sets cache-control on error with status override', (done) => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest());
            };

            const server = new Hapi.Server();
            server.connection({ routes: { cache: { statuses: [200, 400] } } });
            server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { expiresIn: 120000 } } });
            server.inject('/', (res) => {

                expect(res.headers['cache-control']).to.equal('max-age=120, must-revalidate');
                done();
            });
        });

        it('does not return max-age value when route is not cached', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const activeItemHandler = function (request, reply) {

                return reply({
                    'id': '55cf687663',
                    'name': 'Active Items'
                });
            };

            server.route({ method: 'GET', path: '/item2', config: { handler: activeItemHandler } });
            server.inject('/item2', (res) => {

                expect(res.headers['cache-control']).to.not.equal('max-age=120, must-revalidate');
                server.stop(done);
            });
        });

        it('caches using non default cache', (done) => {

            const server = new Hapi.Server({ cache: { name: 'primary', engine: CatboxMemory } });
            server.connection();
            const defaults = server.cache({ segment: 'a', expiresIn: 2000 });
            const primary = server.cache({ segment: 'a', expiresIn: 2000, cache: 'primary' });

            server.start((err) => {

                expect(err).to.not.exist();

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
                                server.stop(done);
                            });
                        });
                    });
                });
            });
        });

        it('leaves existing cache-control header', (done) => {

            const handler = function (request, reply) {

                return reply('text').code(400)
                    .header('cache-control', 'some value');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(400);
                expect(res.headers['cache-control']).to.equal('some value');
                done();
            });
        });

        it('sets cache-control header from ttl without policy', (done) => {

            const handler = function (request, reply) {

                return reply('text').ttl(10000);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.headers['cache-control']).to.equal('max-age=10, must-revalidate');
                done();
            });
        });

        it('leaves existing cache-control header (ttl)', (done) => {

            const handler = function (request, reply) {

                return reply('text').ttl(1000).header('cache-control', 'none');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('none');
                done();
            });
        });

        it('includes caching header with 304', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection();
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' }, config: { cache: { expiresIn: 60000 } } });

            server.inject('/file', (res1) => {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers['cache-control']).to.equal('max-age=60, must-revalidate');
                    done();
                });
            });
        });

        it('forbids caching on 304 if 200 is not included', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { cache: { statuses: [400] } } });
            server.route({ method: 'GET', path: '/file', handler: { file: __dirname + '/../package.json' }, config: { cache: { expiresIn: 60000 } } });

            server.inject('/file', (res1) => {

                server.inject({ url: '/file', headers: { 'if-modified-since': res1.headers['last-modified'] } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers['cache-control']).to.equal('no-cache');
                    done();
                });
            });
        });
    });

    describe('security()', () => {

        it('does not set security headers by default', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.not.exist();
                expect(res.headers['x-frame-options']).to.not.exist();
                expect(res.headers['x-xss-protection']).to.not.exist();
                expect(res.headers['x-download-options']).to.not.exist();
                expect(res.headers['x-content-type-options']).to.not.exist();
                done();
            });
        });

        it('returns default security headers when security is true', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });
        });

        it('does not set default security headers when the route sets security false', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const config = {
                security: false
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: true } });
            server.route({ method: 'GET', path: '/', handler: handler, config: config });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.not.exist();
                expect(res.headers['x-frame-options']).to.not.exist();
                expect(res.headers['x-xss-protection']).to.not.exist();
                expect(res.headers['x-download-options']).to.not.exist();
                expect(res.headers['x-content-type-options']).to.not.exist();
                done();
            });

        });

        it('does not return hsts header when secuirty.hsts is false', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: false } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.not.exist();
                expect(res.headers['x-frame-options']).to.equal('DENY');
                expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });

        });

        it('returns only default hsts header when security.hsts is true', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: true } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is a number', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: 123456789 } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is an object', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: { maxAge: 123456789, includeSubDomains: true } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=123456789; includeSubDomains');
                done();
            });
        });

        it('returns the correct hsts header when security.hsts is an object only sepcifying maxAge', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: { maxAge: 123456789 } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=123456789');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubdomains', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: { includeSubdomains: true } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubDomains', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: { includeSubDomains: true } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains');
                done();
            });
        });

        it('returns correct hsts header when security.hsts is an object only specifying includeSubDomains and preload', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { hsts: { includeSubDomains: true, preload: true } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000; includeSubDomains; preload');
                done();
            });
        });

        it('does not return the xframe header whe security.xframe is false', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xframe: false } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.not.exist();
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                expect(res.headers['x-xss-protection']).to.equal('1; mode=block');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });
        });

        it('returns only default xframe header when security.xframe is true', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xframe: true } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                done();
            });
        });

        it('returns correct xframe header when security.xframe is a string', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xframe: 'sameorigin' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
                done();
            });
        });

        it('returns correct xframe header when security.xframe is an object', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xframe: { rule: 'allow-from', source: 'http://example.com' } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('ALLOW-FROM http://example.com');
                done();
            });
        });

        it('returns correct xframe header when security.xframe is an object', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xframe: { rule: 'deny' } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                done();
            });
        });

        it('returns sameorigin xframe header when rule is allow-from but source is unspecified', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xframe: { rule: 'allow-from' } } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
                done();
            });
        });

        it('does not set x-download-options if noOpen is false', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { noOpen: false } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-download-options']).to.not.exist();
                done();
            });
        });

        it('does not set x-content-type-options if noSniff is false', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { noSniff: false } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-content-type-options']).to.not.exist();
                done();
            });
        });

        it('does not set the x-xss-protection header when security.xss is false', (done) => {

            const handler = function (request, reply) {

                return reply('Test');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { security: { xss: false } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/' }, (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Test');
                expect(res.headers['x-xss-protection']).to.not.exist();
                expect(res.headers['strict-transport-security']).to.equal('max-age=15768000');
                expect(res.headers['x-frame-options']).to.equal('DENY');
                expect(res.headers['x-download-options']).to.equal('noopen');
                expect(res.headers['x-content-type-options']).to.equal('nosniff');
                done();
            });
        });
    });

    describe('content()', () => {

        it('does not modify content-type header when charset manually set', (done) => {

            const handler = function (request, reply) {

                return reply('text').type('text/plain; charset=ISO-8859-1');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/plain; charset=ISO-8859-1');
                done();
            });
        });

        it('does not modify content-type header when charset is unset', (done) => {

            const handler = function (request, reply) {

                return reply('text').type('text/plain').charset();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/plain');
                done();
            });
        });

        it('does not modify content-type header when charset is unset (default type)', (done) => {

            const handler = function (request, reply) {

                return reply('text').charset();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/html');
                done();
            });
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
