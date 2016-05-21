'use strict';

// Load modules

const Path = require('path');
const Stream = require('stream');
const Boom = require('boom');
const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Lab = require('lab');
const Vision = require('vision');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Response', () => {

    it('returns a reply', (done) => {

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
                .code(200);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', config: { handler: handler, cache: { expiresIn: 9999 } } });
        server.state('sid', { encoding: 'base64' });
        server.state('always', { autoValue: 'present' });

        const postHandler = function (request, reply) {

            reply.state('test', '123');
            reply.unstate('empty', { path: '/path' });
            return reply.continue();
        };

        server.ext('onPostHandler', postHandler);

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('text');
            expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
            expect(res.headers['content-type']).to.equal('text/plain; something=something, charset=ISO-8859-1');
            expect(res.headers['set-cookie']).to.equal(['abc=123', 'sid=YWJjZGVmZzEyMzQ1Ng==', 'other=something; Secure', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'test=123', 'empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/path', 'always=present']);
            expect(res.headers.vary).to.equal('x-control');
            expect(res.headers.combo).to.equal('o-k');
            done();
        });
    });

    describe('_setSource()', () => {

        it('returns an empty string reply', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('');
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.headers['content-type']).to.not.exist();
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });

        it('returns a null reply', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(null);
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });

        it('returns an undefined reply', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply();
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });
    });

    describe('header()', () => {

        it('appends to set-cookie header', (done) => {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', 'A').header('set-cookie', 'B', { append: true });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.equal(['A', 'B']);
                done();
            });
        });

        it('sets null header', (done) => {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', null);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.not.exist();
                done();
            });
        });

        it('throws error on non-ascii value', (done) => {

            let thrown = false;

            const handler = function (request, reply) {

                try {
                    return reply('ok').header('set-cookie', decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar'));
                }
                catch (err) {
                    expect(err.message).to.equal('Header value cannot contain or convert into non-ascii characters: set-cookie');
                    thrown = true;
                }
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(thrown).to.equal(true);
                done();
            });
        });

        it('throws error on non-ascii value (header name)', (done) => {

            let thrown = false;

            const handler = function (request, reply) {

                const badName = decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar');
                try {
                    return reply('ok').header(badName, 'value');
                }
                catch (err) {
                    expect(err.message).to.equal('Header value cannot contain or convert into non-ascii characters: ' + badName);
                    thrown = true;
                }
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(thrown).to.equal(true);
                done();
            });
        });

        it('throws error on non-ascii value (buffer)', (done) => {

            let thrown = false;

            const handler = function (request, reply) {

                try {
                    return reply('ok').header('set-cookie', new Buffer(decodeURIComponent('%E0%B4%8Aset-cookie:%20foo=bar')));
                }
                catch (err) {
                    expect(err.message).to.equal('Header value cannot contain or convert into non-ascii characters: set-cookie');
                    thrown = true;
                }
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(thrown).to.equal(true);
                done();
            });
        });
    });

    describe('created()', () => {

        it('returns a stream reply (created)', (done) => {

            const handler = function (request, reply) {

                return reply({ a: 1 }).created('/special');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({ method: 'POST', url: '/' }, (res) => {

                expect(res.result).to.equal({ a: 1 });
                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal('/special');
                expect(res.headers['cache-control']).to.equal('no-cache');
                done();
            });
        });

        it('returns error on created with GET', (done) => {

            const handler = function (request, reply) {

                return reply().created('/something');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('state()', () => {

        it('returns an error on bad cookie', (done) => {

            const handler = function (request, reply) {

                return reply('text').state(';sid', 'abcdefg123456');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.result).to.exist();
                expect(res.statusCode).to.equal(500);
                expect(res.result.message).to.equal('An internal server error occurred');
                expect(res.headers['set-cookie']).to.not.exist();
                done();
            });
        });
    });

    describe('unstate()', () => {

        it('allows options', (done) => {

            const handler = function (request, reply) {

                return reply().unstate('session', { path: '/unset', isSecure: true });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.equal(['session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/unset']);
                done();
            });
        });
    });

    describe('vary()', () => {

        it('sets Vary header with single value', (done) => {

            const handler = function (request, reply) {

                return reply('ok').vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x');
                done();
            });
        });

        it('sets Vary header with multiple values', (done) => {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('y');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x,y');
                done();
            });
        });

        it('sets Vary header with *', (done) => {

            const handler = function (request, reply) {

                return reply('ok').vary('*');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('leaves Vary header with * on additional values', (done) => {

            const handler = function (request, reply) {

                return reply('ok').vary('*').vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('drops other Vary header values when set to *', (done) => {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('*');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('sets Vary header with multiple similar and identical values', (done) => {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('xyz').vary('xy').vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x,xyz,xy');
                done();
            });
        });
    });

    describe('etag()', () => {

        it('sets etag', (done) => {

            const handler = function (request, reply) {

                return reply('ok').etag('abc');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.equal('"abc"');
                done();
            });
        });

        it('sets weak etag', (done) => {

            const handler = function (request, reply) {

                return reply('ok').etag('abc', { weak: true });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.equal('W/"abc"');
                done();
            });
        });

        it('ignores varyEtag when etag header is removed', (done) => {

            const handler = function (request, reply) {

                const response = reply('ok').etag('abc').vary('x');
                delete response.headers.etag;
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.not.exist();
                done();
            });
        });

        it('leaves etag header when varyEtag is false', (done) => {

            const handler = function (request, reply) {

                return reply('ok').etag('abc', { vary: false }).vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.headers.etag).to.equal('"abc"');

                server.inject({ url: '/', headers: { 'if-none-match': '"abc-gzip"', 'accept-encoding': 'gzip' } }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.headers.etag).to.equal('"abc"');
                    done();
                });
            });
        });

        it('applies varyEtag when returning 304 due to if-modified-since match', (done) => {

            const mdate = new Date().toUTCString();

            const handler = function (request, reply) {

                return reply('ok').etag('abc').header('last-modified', mdate);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject({ url: '/', headers: { 'if-modified-since': mdate, 'accept-encoding': 'gzip' } }, (res) => {

                expect(res.statusCode).to.equal(304);
                expect(res.headers.etag).to.equal('"abc-gzip"');
                done();
            });
        });
    });

    describe('passThrough()', () => {

        it('passes stream headers and code through', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(299);
                expect(res.headers.xcustom).to.equal('some value');
                done();
            });
        });

        it('excludes stream headers and code when passThrough is false', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.xcustom).to.not.exist();
                done();
            });
        });

        it('ignores stream headers when empty', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(299);
                expect(res.headers.xcustom).to.not.exist();
                done();
            });
        });

        it('retains local headers with stream headers pass-through', (done) => {

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
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.result).to.equal('x');
                expect(res.headers.xcustom).to.equal('other value');
                expect(res.headers['set-cookie']).to.equal(['a=1', 'b=2']);
                done();
            });
        });
    });

    describe('replacer()', () => {

        it('errors when called on wrong type', (done) => {

            const handler = function (request, reply) {

                return reply('x').replacer(['x']);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('spaces()', () => {

        it('errors when called on wrong type', (done) => {

            const handler = function (request, reply) {

                return reply('x').spaces(2);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('suffix()', () => {

        it('errors when called on wrong type', (done) => {

            const handler = function (request, reply) {

                return reply('x').suffix('x');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('type()', () => {

        it('returns a file in the response with the correct headers using custom mime type', (done) => {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: Path.join(__dirname, '../') } } });
            const handler = function (request, reply) {

                return reply.file('./LICENSE').type('application/example');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', (res) => {

                expect(res.headers['content-type']).to.equal('application/example');
                done();
            });
        });
    });

    describe('charset()', () => {

        it('sets charset with default type', (done) => {

            const handler = function (request, reply) {

                return reply('text').charset('abc');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/html; charset=abc');
                done();
            });
        });

        it('sets charset with default type in onPreResponse', (done) => {

            const handler = function (request, reply) {

                return reply('text');
            };

            const onPreResponse = function (request, reply) {

                request.response.charset('abc');
                return reply.continue();
            };

            const server = new Hapi.Server();
            server.connection();
            server.ext('onPreResponse', onPreResponse);

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/html; charset=abc');
                done();
            });
        });

        it('sets type inside marshal', (done) => {

            const handler = function (request, reply) {

                const marshal = (response, callback) => {

                    if (!response.headers['content-type']) {
                        response.type('text/html');
                    }

                    return callback(null, response.source.value);
                };

                return reply(request.generateResponse({ value: 'text' }, { variety: 'test', marshal }));
            };

            const onPreResponse = function (request, reply) {

                request.response.charset('abc');
                return reply.continue();
            };

            const server = new Hapi.Server();
            server.connection();
            server.ext('onPreResponse', onPreResponse);

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-type']).to.equal('text/html; charset=abc');
                done();
            });
        });
    });

    describe('redirect()', () => {

        it('returns a redirection reply', (done) => {

            const handler = function (request, reply) {

                return reply('Please wait while we send your elsewhere').redirect('/example');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('http://example.org/', (res) => {

                expect(res.result).to.exist();
                expect(res.headers.location).to.equal('/example');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a redirection reply using verbose call', (done) => {

            const handler = function (request, reply) {

                return reply('We moved!').redirect().location('/examplex');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.result).to.exist();
                expect(res.result).to.equal('We moved!');
                expect(res.headers.location).to.equal('/examplex');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 301 redirection reply', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable(false);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable(false);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 301 redirection reply (reveresed methods)', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable().permanent();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply (reveresed methods)', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable().temporary();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply (reveresed methods)', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).temporary();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply (reveresed methods)', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).permanent();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 302 redirection reply (flip flop)', (done) => {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().temporary();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });
    });

    describe('_prepare()', () => {

        it('handles promises that resolve', (done) => {

            const handler = function (request, reply) {

                return reply(new Promise((resolve, reject) => {

                    return resolve('promised response');
                })).code(201);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('promised response');
                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('handles promises that resolve (object)', (done) => {

            const handler = function (request, reply) {

                return reply(new Promise((resolve, reject) => {

                    return resolve({ status: 'ok' });
                })).code(201);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result.status).to.equal('ok');
                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('handles promises that resolve (response object)', (done) => {

            const handler = function (request, reply) {

                return reply(new Promise((resolve, reject) => {

                    return resolve(request.generateResponse({ status: 'ok' }).code(201));
                }));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result.status).to.equal('ok');
                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('handles promises that reject', (done) => {

            const handler = function (request, reply) {

                const promise = new Promise((resolve, reject) => {

                    return reject(Boom.forbidden('this is not allowed!'));
                });

                promise.catch(Hoek.ignore);

                return reply(promise).code(299);            // Code ignored
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result.message).to.equal('this is not allowed!');
                expect(res.statusCode).to.equal(403);
                done();
            });
        });
    });

    describe('_marshal()', () => {

        it('emits request-error when view file for handler not found', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.register(Vision, Hoek.ignore);
            server.connection();

            server.views({
                engines: { 'html': Handlebars },
                path: __dirname
            });

            server.once('request-error', (request, err) => {

                expect(err).to.exist();
                expect(err.message).to.contain('The partial x could not be found: The partial x could not be found');
                done();
            });

            server.route({ method: 'GET', path: '/{param}', handler: { view: 'templates/invalid' } });

            server.inject('/hello', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
                expect(res.result.message).to.equal('An internal server error occurred');
            });
        });
    });

    describe('_streamify()', () => {

        it('returns a formatted response', (done) => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 });
            };

            const server = new Hapi.Server();
            server.connection({ routes: { json: { replacer: ['a'], space: 4, suffix: '\n' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('{\n    \"a\": 1\n}\n');
                done();
            });
        });

        it('returns a response with options', (done) => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 }).type('application/x-test').spaces(2).replacer(['a']).suffix('\n');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
                expect(res.headers['content-type']).to.equal('application/x-test');
                done();
            });
        });

        it('returns a response with options (different order)', (done) => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 }).type('application/x-test').replacer(['a']).suffix('\n').spaces(2);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
                expect(res.headers['content-type']).to.equal('application/x-test');
                done();
            });
        });

        it('captures object which cannot be stringify', (done) => {

            const handler = function (request, reply) {

                const obj = {};
                obj.a = obj;
                return reply(obj);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('_tap()', () => {

        it('peeks into the response stream', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let output = '';
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    const response = reply('1234567890');

                    response.on('peek', (chunk) => {

                        output += chunk.toString();
                    });

                    response.once('finish', () => {

                        output += '!';
                    });
                }
            });

            server.inject('/', (res) => {

                expect(output).to.equal('1234567890!');
                done();
            });
        });
    });

    describe('_close()', () => {

        it('calls custom close processor', (done) => {

            let closed = false;
            const close = function (response) {

                closed = true;
            };

            const handler = function (request, reply) {

                return reply(request.generateResponse(null, { close: close }));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(closed).to.be.true();
                done();
            });
        });
    });
});
