'use strict';

const Events = require('events');
const Http = require('http');
const Path = require('path');
const Stream = require('stream');

const Code = require('@hapi/code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('@hapi/hoek');
const Inert = require('@hapi/inert');
const Lab = require('@hapi/lab');
const Vision = require('@hapi/vision');

const Response = require('../lib/response');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Response', () => {

    it('returns a response', async () => {

        const handler = (request, h) => {

            return h.response('text')
                .type('text/plain')
                .charset('ISO-8859-1')
                .ttl(1000)
                .header('set-cookie', 'abc=123')
                .state('sid', 'abcdefg123456')
                .state('other', 'something', { isSecure: true })
                .unstate('x')
                .header('Content-Type', 'text/plain; something=something')
                .header('vary', 'x-control')
                .header('combo', 'o')
                .header('combo', 'k', { append: true, separator: '-' })
                .header('combo', 'bad', { override: false })
                .code(200)
                .message('Super');
        };

        const server = Hapi.server({ compression: { minBytes: 1 } });
        server.route({ method: 'GET', path: '/', options: { handler, cache: { expiresIn: 9999 } } });
        server.state('sid', { encoding: 'base64' });
        server.state('always', { autoValue: 'present' });

        const postHandler = (request, h) => {

            h.state('test', '123');
            h.unstate('empty', { path: '/path' });
            return h.continue;
        };

        server.ext('onPostHandler', postHandler);

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.exist();
        expect(res.result).to.equal('text');
        expect(res.statusMessage).to.equal('Super');
        expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
        expect(res.headers['content-type']).to.equal('text/plain; something=something; charset=ISO-8859-1');
        expect(res.headers['set-cookie']).to.equal(['abc=123', 'sid=YWJjZGVmZzEyMzQ1Ng==; Secure; HttpOnly; SameSite=Strict', 'other=something; Secure; HttpOnly; SameSite=Strict', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict', 'test=123; Secure; HttpOnly; SameSite=Strict', 'empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict; Path=/path', 'always=present; Secure; HttpOnly; SameSite=Strict']);
        expect(res.headers.vary).to.equal('x-control,accept-encoding');
        expect(res.headers.combo).to.equal('o-k');
    });

    it('sets content-type charset (trailing semi column)', async () => {

        const handler = (request, h) => {

            return h.response('text').header('Content-Type', 'text/plain; something=something;');
        };

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['content-type']).to.equal('text/plain; something=something; charset=utf-8');
    });

    describe('_setSource()', () => {

        it('returns an empty string response', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => ''
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.headers['content-length']).to.not.exist();
            expect(res.headers['content-type']).to.equal('text/html; charset=utf-8');
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('returns a null response', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.headers['content-length']).to.not.exist();
            expect(res.headers['content-type']).to.not.exist();
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('returns a stream', async () => {

            const handler = (request) => {

                const stream = new Stream.Readable({
                    read() {

                        this.push('x');
                        this.push(null);
                    }
                });

                return stream;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('application/octet-stream');
        });
    });

    describe('code()', () => {

        it('sets manual code regardless of emptyStatusCode override', async () => {

            const server = Hapi.server({ routes: { response: { emptyStatusCode: 200 } } });
            server.route({ method: 'GET', path: '/', handler: (request, h) => h.response().code(204) });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
        });
    });

    describe('header()', () => {

        it('appends to set-cookie header', async () => {

            const handler = (request, h) => {

                return h.response('ok').header('set-cookie', 'A').header('set-cookie', 'B', { append: true });
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.equal(['A', 'B']);
        });

        it('sets null header', async () => {

            const handler = (request, h) => {

                return h.response('ok').header('set-cookie', null);
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist();
        });

        it('throws error on non-ascii value', async () => {

            const handler = (request, h) => {

                return h.response('ok').header('set-cookie', decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar'));
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('throws error on non-ascii value (header name)', async () => {

            const handler = (request, h) => {

                const badName = decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar');
                return h.response('ok').header(badName, 'value');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('throws error on non-ascii value (buffer)', async () => {

            const handler = (request, h) => {

                return h.response('ok').header('set-cookie', Buffer.from(decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar')));
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('created()', () => {

        it('returns a response (created)', async () => {

            const handler = (request, h) => {

                return h.response({ a: 1 }).created('/special');
            };

            const server = Hapi.server();
            server.route({ method: 'POST', path: '/', handler });

            const res = await server.inject({ method: 'POST', url: '/' });
            expect(res.result).to.equal({ a: 1 });
            expect(res.statusCode).to.equal(201);
            expect(res.headers.location).to.equal('/special');
            expect(res.headers['cache-control']).to.equal('no-cache');
        });

        it('returns error on created with GET', async () => {

            const handler = (request, h) => {

                return h.response().created('/something');
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('does not return an error on created with PUT', async () => {

            const handler = (request, h) => {

                return h.response({ a: 1 }).created();
            };

            const server = Hapi.server();
            server.route({ method: 'PUT', path: '/', handler });

            const res = await server.inject({ method: 'PUT', url: '/' });
            expect(res.result).to.equal({ a: 1 });
            expect(res.statusCode).to.equal(201);
        });

        it('does not return an error on created with PATCH', async () => {

            const handler = (request, h) => {

                return h.response({ a: 1 }).created();
            };

            const server = Hapi.server();
            server.route({ method: 'PATCH', path: '/', handler });

            const res = await server.inject({ method: 'PATCH', url: '/' });
            expect(res.result).to.equal({ a: 1 });
            expect(res.statusCode).to.equal(201);
        });
    });

    describe('state()', () => {

        it('returns an error on bad cookie', async () => {

            const handler = (request, h) => {

                return h.response('text').state(';sid', 'abcdefg123456');
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.exist();
            expect(res.statusCode).to.equal(500);
            expect(res.result.message).to.equal('An internal server error occurred');
            expect(res.headers['set-cookie']).to.not.exist();
        });
    });

    describe('unstate()', () => {

        it('allows options', async () => {

            const handler = (request, h) => {

                return h.response().unstate('session', { path: '/unset', isSecure: true });
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(204);
            expect(res.headers['set-cookie']).to.equal(['session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict; Path=/unset']);
        });
    });

    describe('vary()', () => {

        it('sets Vary header with single value', async () => {

            const handler = (request, h) => {

                return h.response('ok').vary('x');
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('x,accept-encoding');
        });

        it('sets Vary header with multiple values', async () => {

            const handler = (request, h) => {

                return h.response('ok').vary('x').vary('y');
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('x,y,accept-encoding');
        });

        it('sets Vary header with *', async () => {

            const handler = (request, h) => {

                return h.response('ok').vary('*');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('*');
        });

        it('leaves Vary header with * on additional values', async () => {

            const handler = (request, h) => {

                return h.response('ok').vary('*').vary('x');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('*');
        });

        it('drops other Vary header values when set to *', async () => {

            const handler = (request, h) => {

                return h.response('ok').vary('x').vary('*');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('*');
        });

        it('sets Vary header with multiple similar and identical values', async () => {

            const handler = (request, h) => {

                return h.response('ok').vary('x').vary('xyz').vary('xy').vary('x');
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('x,xyz,xy,accept-encoding');
        });
    });

    describe('etag()', () => {

        it('sets etag', async () => {

            const handler = (request, h) => {

                return h.response('ok').etag('abc');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.equal('"abc"');
        });

        it('sets weak etag', async () => {

            const handler = (request, h) => {

                return h.response('ok').etag('abc', { weak: true });
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.equal('W/"abc"');
        });

        it('ignores varyEtag when etag header is removed', async () => {

            const handler = (request, h) => {

                const response = h.response('ok').etag('abc').vary('x');
                delete response.headers.etag;
                return response;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.not.exist();
        });

        it('leaves etag header when varyEtag is false', async () => {

            const handler = (request, h) => {

                return h.response('ok').etag('abc', { vary: false }).vary('x');
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });
            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.headers.etag).to.equal('"abc"');

            const res2 = await server.inject({ url: '/', headers: { 'if-none-match': '"abc-gzip"', 'accept-encoding': 'gzip' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers.etag).to.equal('"abc"');
        });

        it('applies varyEtag when returning 304 due to if-modified-since match', async () => {

            const mdate = new Date().toUTCString();

            const handler = (request, h) => {

                return h.response('ok').etag('abc').header('last-modified', mdate);
            };

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'if-modified-since': mdate, 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(304);
            expect(res.headers.etag).to.equal('"abc-gzip"');
        });
    });

    describe('passThrough()', () => {

        it('passes stream headers and code through', async () => {

            const TestStream = class extends Stream.Readable {

                constructor() {

                    super();
                    this.statusCode = 299;
                    this.headers = { xcustom: 'some value', 'content-type': 'something/special' };
                }

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('x');
                    this.push(null);
                }
            };

            const handler = (request) => {

                return new TestStream();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(299);
            expect(res.headers.xcustom).to.equal('some value');
            expect(res.headers['content-type']).to.equal('something/special');
        });

        it('excludes connection header and connection options', async () => {

            const upstreamConnectionHeader = 'x-test, x-test-also';

            const TestStream = class extends Stream.Readable {

                constructor() {

                    super();
                    this.statusCode = 200;
                    this.headers = {
                        connection: upstreamConnectionHeader,
                        'x-test': 'something',
                        'x-test-also': 'also'
                    };
                }

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('x');
                    this.push(null);
                }
            };

            const handler = (request) => {

                return new TestStream();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.connection).to.not.equal(upstreamConnectionHeader);
            expect(res.headers['x-test']).to.not.exist();
            expect(res.headers['x-test-also']).to.not.exist();
        });

        it('excludes stream headers and code when passThrough is false', async () => {

            const TestStream = class extends Stream.Readable {

                constructor() {

                    super();
                    this.statusCode = 299;
                    this.headers = { xcustom: 'some value' };
                }

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('x');
                    this.push(null);
                }
            };

            const handler = (request, h) => {

                return h.response(new TestStream()).passThrough(false);
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.xcustom).to.not.exist();
        });

        it('ignores stream headers when empty', async () => {

            const TestStream = class extends Stream.Readable {

                constructor() {

                    super();
                    this.statusCode = 299;
                    this.headers = {};
                }

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('x');
                    this.push(null);
                }
            };

            const handler = (request) => {

                return new TestStream();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(299);
            expect(res.headers.xcustom).to.not.exist();
        });

        it('retains local headers with stream headers pass-through', async () => {

            const TestStream = class extends Stream.Readable {

                constructor() {

                    super();
                    this.headers = { xcustom: 'some value', 'set-cookie': 'a=1' };
                }

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push('x');
                    this.push(null);
                }
            };

            const handler = (request, h) => {

                return h.response(new TestStream()).header('xcustom', 'other value').state('b', '2');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.headers.xcustom).to.equal('other value');
            expect(res.headers['set-cookie']).to.equal(['a=1', 'b=2; Secure; HttpOnly; SameSite=Strict']);
        });
    });

    describe('replacer()', () => {

        it('errors when called on wrong type', async () => {

            const handler = (request, h) => {

                return h.response('x').replacer(['x']);
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('compressed()', () => {

        it('errors on missing encoding', async () => {

            const handler = (request, h) => {

                return h.response('x').compressed();
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('errors on invalid encoding', async () => {

            const handler = (request, h) => {

                return h.response('x').compressed(123);
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('spaces()', () => {

        it('errors when called on wrong type', async () => {

            const handler = (request, h) => {

                return h.response('x').spaces(2);
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('suffix()', () => {

        it('errors when called on wrong type', async () => {

            const handler = (request, h) => {

                return h.response('x').suffix('x');
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('escape()', () => {

        it('returns 200 when called with true', async () => {

            const handler = (request, h) => {

                return h.response({ x: 'x' }).escape(true);
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('errors when called on wrong type', async () => {

            const handler = (request, h) => {

                return h.response('x').escape('x');
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('type()', () => {

        it('returns a file in the response with the correct headers using custom mime type', async () => {

            const server = Hapi.server({ routes: { files: { relativeTo: Path.join(__dirname, '../') } } });
            await server.register(Inert);
            const handler = (request, h) => {

                return h.file('./LICENSE.md').type('application/example');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject('/file');
            expect(res.headers['content-type']).to.equal('application/example');
        });
    });

    describe('charset()', () => {

        it('sets charset with default type', async () => {

            const handler = (request, h) => {

                return h.response('text').charset('abc');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html; charset=abc');
        });

        it('sets charset with default type in onPreResponse', async () => {

            const onPreResponse = (request, h) => {

                request.response.charset('abc');
                return h.continue;
            };

            const server = Hapi.server();
            server.ext('onPreResponse', onPreResponse);

            server.route({ method: 'GET', path: '/', handler: () => 'text' });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html; charset=abc');
        });

        it('sets type inside marshal', async () => {

            const handler = (request) => {

                const marshal = (response) => {

                    if (!response.headers['content-type']) {
                        response.type('text/html');
                    }

                    return response.source.value;
                };

                return request.generateResponse({ value: 'text' }, { variety: 'test', marshal });
            };

            const onPreResponse = (request, h) => {

                request.response.charset('abc');
                return h.continue;
            };

            const server = Hapi.server();
            server.ext('onPreResponse', onPreResponse);

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html; charset=abc');
        });
    });

    describe('redirect()', () => {

        it('returns a redirection response', async () => {

            const handler = (request, h) => {

                return h.response('Please wait while we send your elsewhere').redirect('/example');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('http://example.org/');
            expect(res.result).to.exist();
            expect(res.headers.location).to.equal('/example');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a redirection response using verbose call', async () => {

            const handler = (request, h) => {

                return h.response('We moved!').redirect().location('/examplex');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.exist();
            expect(res.result).to.equal('We moved!');
            expect(res.headers.location).to.equal('/examplex');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a 301 redirection response', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').permanent().rewritable();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(301);
        });

        it('returns a 302 redirection response', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').temporary().rewritable();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a 307 redirection response', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').temporary().rewritable(false);
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(307);
        });

        it('returns a 308 redirection response', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').permanent().rewritable(false);
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(308);
        });

        it('returns a 301 redirection response (reversed methods)', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').rewritable().permanent();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(301);
        });

        it('returns a 302 redirection response (reversed methods)', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').rewritable().temporary();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a 307 redirection response (reversed methods)', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').rewritable(false).temporary();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(307);
        });

        it('returns a 308 redirection response (reversed methods)', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').rewritable(false).permanent();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(308);
        });

        it('returns a 302 redirection response (flip flop)', async () => {

            const handler = (request, h) => {

                return h.response().redirect('example').permanent().temporary();
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });
    });

    describe('_marshal()', () => {

        it('emits request-error when view file for handler not found', async () => {

            const server = Hapi.server({ debug: false });
            await server.register(Vision);

            server.views({
                engines: { 'html': Handlebars },
                path: __dirname
            });

            const log = server.events.once({ name: 'request', channels: 'error' });

            server.route({ method: 'GET', path: '/{param}', handler: { view: 'templates/invalid' } });

            const res = await server.inject('/hello');
            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist();
            expect(res.result.message).to.equal('An internal server error occurred');

            const [, event] = await log;
            expect(event.error.message).to.contain('The partial x could not be found: The partial x could not be found');
        });

        it('returns a formatted response (spaces)', async () => {

            const handler = (request) => {

                return { a: 1, b: 2, '<': '&' };
            };

            const server = Hapi.server({ routes: { json: { space: 4, suffix: '\n', escape: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n    \"a\": 1,\n    \"b\": 2,\n    \"\\u003c\": \"\\u0026\"\n}\n');
        });

        it('returns a formatted response (replacer and spaces', async () => {

            const handler = (request) => {

                return { a: 1, b: 2, '<': '&' };
            };

            const server = Hapi.server({ routes: { json: { replacer: ['a', '<'], space: 4, suffix: '\n', escape: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n    \"a\": 1,\n    \"\\u003c\": \"\\u0026\"\n}\n');
        });

        it('returns a response with options', async () => {

            const handler = (request, h) => {

                return h.response({ a: 1, b: 2, '<': '&' }).type('application/x-test').spaces(2).replacer(['a']).suffix('\n').escape(false);
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
            expect(res.headers['content-type']).to.equal('application/x-test');
        });

        it('returns a response with options (different order)', async () => {

            const handler = (request, h) => {

                return h.response({ a: 1, b: 2, '<': '&' }).type('application/x-test').escape(false).replacer(['a']).suffix('\n').spaces(2);
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
            expect(res.headers['content-type']).to.equal('application/x-test');
        });

        it('captures object which cannot be stringify', async () => {

            const handler = (request) => {

                const obj = {};
                obj.a = obj;
                return obj;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('errors on non-readable stream response', async () => {

            const streamHandler = (request, h) => {

                const stream = new Stream();
                stream.writable = true;

                return h.response(stream);
            };

            const writableHandler = (request, h) => {

                const writable = new Stream.Writable();
                writable._write = function () { };

                return h.response(writable);
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });
            server.route({ method: 'GET', path: '/writable', handler: writableHandler });

            let updates = 0;
            server.events.on({ name: 'request', channels: 'error' }, (request, event) => {

                expect(event.error).to.be.an.error('Stream must have a readable interface');
                ++updates;
            });

            await server.initialize();

            const res1 = await server.inject('/stream');
            expect(res1.statusCode).to.equal(500);

            const res2 = await server.inject('/writable');
            expect(res2.statusCode).to.equal(500);

            await Hoek.wait(10);

            expect(updates).to.equal(2);
        });

        it('errors on an http client stream response', async () => {

            const handler = (request, h) => {

                return h.response('just a string');
            };

            const streamHandler = (request, h) => {

                return h.response(Http.get(request.server.info + '/'));
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            await server.initialize();
            const res = await server.inject('/stream');
            expect(res.statusCode).to.equal(500);
        });

        it('errors on objectMode stream response', async () => {

            const TestStream = class extends Stream.Readable {

                constructor() {

                    super({ objectMode: true });
                }

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;

                    this.push({ x: 1 });
                    this.push({ y: 1 });
                    this.push(null);
                }
            };

            const handler = (request, h) => {

                return h.response(new TestStream());
            };

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('_prepare()', () => {

        it('boomifies response prepare error', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => {

                    const prepare = () => {

                        throw new Error('boom');
                    };

                    return request.generateResponse('nothing', { variety: 'special', marshal: null, prepare, close: null });
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('_tap()', () => {

        it('peeks into the response stream', async () => {

            const server = Hapi.server();

            let output = '';
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    const response = h.response('1234567890');

                    response.events.on('peek', (chunk, encoding) => {

                        output += chunk.toString();
                    });

                    response.events.once('finish', () => {

                        output += '!';
                    });

                    return response;
                }
            });

            await server.inject('/');
            expect(output).to.equal('1234567890!');
        });

        it('peeks into the response stream (finish only)', async () => {

            const server = Hapi.server();

            let output = false;
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    const response = h.response('1234567890');

                    response.events.once('finish', () => {

                        output = true;
                    });

                    return response;
                }
            });

            await server.inject('/');
            expect(output).to.be.true();
        });

        it('peeks into the response stream (empty)', async () => {

            const server = Hapi.server();

            let output = '';
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    const response = h.response(null);

                    response.events.on('peek', (chunk, encoding) => { });

                    response.events.once('finish', () => {

                        output += '!';
                    });

                    return response;
                }
            });

            await server.inject('/');
            expect(output).to.equal('!');
        });

        it('peeks into the response stream (empty 304)', async () => {

            const server = Hapi.server();

            let output = '';
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    const response = h.response(null).code(304);

                    response.events.on('peek', (chunk, encoding) => { });

                    response.events.once('finish', () => {

                        output += '!';
                    });

                    return response;
                }
            });

            await server.inject('/');
            expect(output).to.equal('!');
        });
    });

    describe('_close()', () => {

        it('calls custom close processor', async () => {

            let closed = false;
            const close = function (response) {

                closed = true;
            };

            const handler = (request) => {

                return request.generateResponse(null, { close });
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            await server.inject('/');
            expect(closed).to.be.true();
        });

        it('logs custom close processor error', async () => {

            const close = function (response) {

                throw new Error('oops');
            };

            const handler = (request) => {

                return request.generateResponse(null, { close });
            };

            const server = Hapi.server();
            const log = server.events.once('request');
            server.route({ method: 'GET', path: '/', handler });

            await server.inject('/');
            const [, event] = await log;
            expect(event.tags).to.equal(['response', 'cleanup', 'error']);
            expect(event.error).to.be.an.error('oops');
        });
    });

    describe('Peek', () => {

        it('taps into pass-through stream', async () => {

            // Source

            const Source = class extends Stream.Readable {

                constructor(values) {

                    super();
                    this.data = values;
                    this.pos = 0;
                }

                _read(/* size */) {

                    if (this.pos === this.data.length) {
                        this.push(null);
                        return;
                    }

                    this.push(this.data[this.pos++]);
                }
            };

            // Target

            const Target = class extends Stream.Writable {

                constructor() {

                    super();
                    this.data = [];
                }

                _write(chunk, encoding, callback) {

                    this.data.push(chunk.toString());
                    return callback();
                }
            };

            // Peek

            const emitter = new Events.EventEmitter();
            const peek = new Response.Peek(emitter);

            const chunks = ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst', 'uvwx'];
            const source = new Source(chunks);
            const target = new Target();

            const seen = [];
            emitter.on('peek', (update) => {

                const chunk = update[0];
                seen.push(chunk.toString());
            });

            const finish = new Promise((resolve) => {

                emitter.once('finish', () => {

                    expect(seen).to.equal(chunks);
                    expect(target.data).to.equal(chunks);
                    resolve();
                });
            });

            source.pipe(peek).pipe(target);
            await finish;
        });
    });

    describe('Payload', () => {

        it('streams empty string', async () => {

            const server = Hapi.server({ compression: { minBytes: 1 } });
            server.route({ method: 'GET', path: '/', options: { jsonp: 'callback', handler: () => '' } });

            const res = await server.inject({ url: '/?callback=me', headers: { 'Accept-Encoding': 'gzip' } });
            expect(res.statusCode).to.equal(200);
        });
    });
});
