'use strict';

// Load modules

const Events = require('events');
const Path = require('path');
const Stream = require('stream');

const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Lab = require('lab');
const Vision = require('vision');

const Response = require('../lib/response');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Response', () => {

    it('returns a reply', async () => {

        const handler = function (request, reply) {

            return reply('text')
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

        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', config: { handler, cache: { expiresIn: 9999 } } });
        server.state('sid', { encoding: 'base64' });
        server.state('always', { autoValue: 'present' });

        const postHandler = function (request, reply) {

            reply.state('test', '123');
            reply.unstate('empty', { path: '/path' });
            return reply.continue;
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

        const handler = function (request, reply) {

            return reply('text').header('Content-Type', 'text/plain; something=something;');
        };

        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.headers['content-type']).to.equal('text/plain; something=something; charset=utf-8');
    });

    describe('_setSource()', () => {

        it('returns an empty string reply', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('');
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(0);
            expect(res.headers['content-type']).to.not.exist();
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('returns a null reply', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(null);
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(0);
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('returns an undefined reply', async () => {

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply();
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(0);
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });
    });

    describe('header()', () => {

        it('appends to set-cookie header', async () => {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', 'A').header('set-cookie', 'B', { append: true });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.equal(['A', 'B']);
        });

        it('sets null header', async () => {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', null);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist();
        });

        it('throws error on non-ascii value', async () => {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar'));
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('throws error on non-ascii value (header name)', async () => {

            const handler = function (request, reply) {

                const badName = decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar');
                return reply('ok').header(badName, 'value');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('throws error on non-ascii value (buffer)', async () => {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', new Buffer(decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar')));
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('created()', () => {

        it('returns a stream reply (created)', async () => {

            const handler = function (request, reply) {

                return reply({ a: 1 }).created('/special');
            };

            const server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', handler });

            const res = await server.inject({ method: 'POST', url: '/' });
            expect(res.result).to.equal({ a: 1 });
            expect(res.statusCode).to.equal(201);
            expect(res.headers.location).to.equal('/special');
            expect(res.headers['cache-control']).to.equal('no-cache');
        });

        it.skip('returns error on created with GET', async () => {

            const handler = function (request, reply) {

                return reply().created('/something');
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('state()', () => {

        it('returns an error on bad cookie', async () => {

            const handler = function (request, reply) {

                return reply('text').state(';sid', 'abcdefg123456');
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.result).to.exist();
            expect(res.statusCode).to.equal(500);
            expect(res.result.message).to.equal('An internal server error occurred');
            expect(res.headers['set-cookie']).to.not.exist();
        });
    });

    describe('unstate()', () => {

        it('allows options', async () => {

            const handler = function (request, reply) {

                return reply().unstate('session', { path: '/unset', isSecure: true });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.equal(['session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict; Path=/unset']);
        });
    });

    describe('vary()', () => {

        it('sets Vary header with single value', async () => {

            const handler = function (request, reply) {

                return reply('ok').vary('x');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('x,accept-encoding');
        });

        it('sets Vary header with multiple values', async () => {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('y');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('x,y,accept-encoding');
        });

        it('sets Vary header with *', async () => {

            const handler = function (request, reply) {

                return reply('ok').vary('*');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('*');
        });

        it('leaves Vary header with * on additional values', async () => {

            const handler = function (request, reply) {

                return reply('ok').vary('*').vary('x');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('*');
        });

        it('drops other Vary header values when set to *', async () => {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('*');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('*');
        });

        it('sets Vary header with multiple similar and identical values', async () => {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('xyz').vary('xy').vary('x');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('ok');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.vary).to.equal('x,xyz,xy,accept-encoding');
        });
    });

    describe('etag()', () => {

        it('sets etag', async () => {

            const handler = function (request, reply) {

                return reply('ok').etag('abc');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.equal('"abc"');
        });

        it('sets weak etag', async () => {

            const handler = function (request, reply) {

                return reply('ok').etag('abc', { weak: true });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.equal('W/"abc"');
        });

        it('ignores varyEtag when etag header is removed', async () => {

            const handler = function (request, reply) {

                const response = reply('ok').etag('abc').vary('x');
                delete response.headers.etag;
                return response;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.not.exist();
        });

        it('leaves etag header when varyEtag is false', async () => {

            const handler = function (request, reply) {

                return reply('ok').etag('abc', { vary: false }).vary('x');
            };

            const server = new Hapi.Server();
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

            const handler = function (request, reply) {

                return reply('ok').etag('abc').header('last-modified', mdate);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject({ url: '/', headers: { 'if-modified-since': mdate, 'accept-encoding': 'gzip' } });
            expect(res.statusCode).to.equal(304);
            expect(res.headers.etag).to.equal('"abc-gzip"');
        });
    });

    describe('passThrough()', () => {

        it('passes stream headers and code through', async () => {

            const TestStream = function () {

                Stream.Readable.call(this);
                this.statusCode = 299;
                this.headers = { xcustom: 'some value' };
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('x');
                this.push(null);
            };

            const handler = function (request, reply) {

                return reply(new TestStream());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(299);
            expect(res.headers.xcustom).to.equal('some value');
        });

        it('excludes stream headers and code when passThrough is false', async () => {

            const TestStream = function () {

                Stream.Readable.call(this);
                this.statusCode = 299;
                this.headers = { xcustom: 'some value' };
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('x');
                this.push(null);
            };

            const handler = function (request, reply) {

                return reply(new TestStream()).passThrough(false);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.xcustom).to.not.exist();
        });

        it('ignores stream headers when empty', async () => {

            const TestStream = function () {

                Stream.Readable.call(this);
                this.statusCode = 299;
                this.headers = {};
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('x');
                this.push(null);
            };

            const handler = function (request, reply) {

                return reply(new TestStream());
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.statusCode).to.equal(299);
            expect(res.headers.xcustom).to.not.exist();
        });

        it('retains local headers with stream headers pass-through', async () => {

            const TestStream = function () {

                Stream.Readable.call(this);
                this.headers = { xcustom: 'some value', 'set-cookie': 'a=1' };
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('x');
                this.push(null);
            };

            const handler = function (request, reply) {

                return reply(new TestStream()).header('xcustom', 'other value').state('b', '2');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.result).to.equal('x');
            expect(res.headers.xcustom).to.equal('other value');
            expect(res.headers['set-cookie']).to.equal(['a=1', 'b=2; Secure; HttpOnly; SameSite=Strict']);
        });
    });

    describe('replacer()', () => {

        it('errors when called on wrong type', async () => {

            const handler = function (request, reply) {

                return reply('x').replacer(['x']);
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('spaces()', () => {

        it('errors when called on wrong type', async () => {

            const handler = function (request, reply) {

                return reply('x').spaces(2);
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('suffix()', () => {

        it('errors when called on wrong type', async () => {

            const handler = function (request, reply) {

                return reply('x').suffix('x');
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('escape()', () => {

        it('returns 200 when called with true', async () => {

            const handler = function (request, reply) {

                return reply({ x: 'x' }).escape(true);
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('errors when called on wrong type', async () => {

            const handler = function (request, reply) {

                return reply('x').escape('x');
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('type()', () => {

        it('returns a file in the response with the correct headers using custom mime type', async () => {

            const server = new Hapi.Server({ routes: { files: { relativeTo: Path.join(__dirname, '../') } } });
            await server.register(Inert);
            const handler = function (request, reply) {

                return reply.file('./LICENSE').type('application/example');
            };

            server.route({ method: 'GET', path: '/file', handler });

            const res = await server.inject('/file');
            expect(res.headers['content-type']).to.equal('application/example');
        });
    });

    describe('charset()', () => {

        it('sets charset with default type', async () => {

            const handler = function (request, reply) {

                return reply('text').charset('abc');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html; charset=abc');
        });

        it('sets charset with default type in onPreResponse', async () => {

            const handler = function (request, reply) {

                return reply('text');
            };

            const onPreResponse = function (request, reply) {

                request.response.charset('abc');
                return reply.continue;
            };

            const server = new Hapi.Server();
            server.ext('onPreResponse', onPreResponse);

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html; charset=abc');
        });

        it('sets type inside marshal', async () => {

            const handler = function (request, reply) {

                const marshal = (response) => {

                    if (!response.headers['content-type']) {
                        response.type('text/html');
                    }

                    return response.source.value;
                };

                return reply(request.generateResponse({ value: 'text' }, { variety: 'test', marshal }));
            };

            const onPreResponse = function (request, reply) {

                request.response.charset('abc');
                return reply.continue;
            };

            const server = new Hapi.Server();
            server.ext('onPreResponse', onPreResponse);

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-type']).to.equal('text/html; charset=abc');
        });
    });

    describe('redirect()', () => {

        it('returns a redirection reply', async () => {

            const handler = function (request, reply) {

                return reply('Please wait while we send your elsewhere').redirect('/example');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('http://example.org/');
            expect(res.result).to.exist();
            expect(res.headers.location).to.equal('/example');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a redirection reply using verbose call', async () => {

            const handler = function (request, reply) {

                return reply('We moved!').redirect().location('/examplex');
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.result).to.exist();
            expect(res.result).to.equal('We moved!');
            expect(res.headers.location).to.equal('/examplex');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a 301 redirection reply', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(301);
        });

        it('returns a 302 redirection reply', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a 307 redirection reply', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable(false);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(307);
        });

        it('returns a 308 redirection reply', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable(false);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(308);
        });

        it('returns a 301 redirection reply (reveresed methods)', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable().permanent();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(301);
        });

        it('returns a 302 redirection reply (reveresed methods)', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable().temporary();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });

        it('returns a 307 redirection reply (reveresed methods)', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).temporary();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(307);
        });

        it('returns a 308 redirection reply (reveresed methods)', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).permanent();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(308);
        });

        it('returns a 302 redirection reply (flip flop)', async () => {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().temporary();
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
        });
    });

    describe('_marshal()', () => {

        it('emits request-error when view file for handler not found', async () => {

            const server = new Hapi.Server({ debug: false });
            await server.register(Vision);

            server.views({
                engines: { 'html': Handlebars },
                path: __dirname
            });

            const log = server.events.once('request-error');

            server.route({ method: 'GET', path: '/{param}', handler: { view: 'templates/invalid' } });

            const res = await server.inject('/hello');
            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist();
            expect(res.result.message).to.equal('An internal server error occurred');

            const [, err] = await log;
            expect(err.message).to.contain('The partial x could not be found: The partial x could not be found');
        });
    });

    describe('_streamify()', () => {

        it('returns a formatted response', async () => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2, '<': '&' });
            };

            const server = new Hapi.Server({ routes: { json: { replacer: ['a', '<'], space: 4, suffix: '\n', escape: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n    \"a\": 1,\n    \"\\u003c\": \"\\u0026\"\n}\n');
        });

        it('returns a response with options', async () => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2, '<': '&' }).type('application/x-test').spaces(2).replacer(['a']).suffix('\n').escape(false);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
            expect(res.headers['content-type']).to.equal('application/x-test');
        });

        it('returns a response with options (different order)', async () => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2, '<': '&' }).type('application/x-test').escape(false).replacer(['a']).suffix('\n').spaces(2);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
            expect(res.headers['content-type']).to.equal('application/x-test');
        });

        it('captures object which cannot be stringify', async () => {

            const handler = function (request, reply) {

                const obj = {};
                obj.a = obj;
                return reply(obj);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('_tap()', () => {

        it('peeks into the response stream', async () => {

            const server = new Hapi.Server();

            let output = '';
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    const response = reply('1234567890');

                    response.on('peek', (chunk, encoding) => {

                        output += chunk.toString();
                    });

                    response.once('finish', () => {

                        output += '!';
                    });

                    return response;
                }
            });

            await server.inject('/');
            expect(output).to.equal('1234567890!');
        });
    });

    describe('_close()', () => {

        it('calls custom close processor', async () => {

            let closed = false;
            const close = function (response) {

                closed = true;
            };

            const handler = function (request, reply) {

                return reply(request.generateResponse(null, { close }));
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler } });

            await server.inject('/');
            expect(closed).to.be.true();
        });
    });

    describe('Peek', () => {

        it('taps into pass-through stream', async () => {

            // Source

            const Source = function (values) {

                this.data = values;
                this.pos = 0;

                Stream.Readable.call(this);
            };

            Hoek.inherits(Source, Stream.Readable);

            Source.prototype._read = function (/* size */) {

                if (this.pos === this.data.length) {
                    this.push(null);
                    return;
                }

                this.push(this.data[this.pos++]);
            };

            // Target

            const Target = function () {

                this.data = [];

                Stream.Writable.call(this);
            };

            Hoek.inherits(Target, Stream.Writable);

            Target.prototype._write = function (chunk, encoding, callback) {

                this.data.push(chunk.toString());
                return callback();
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
});
