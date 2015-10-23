'use strict';

// Load modules

const Stream = require('stream');
const Bluebird = require('bluebird');
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


describe('Response', function () {

    it('returns a reply', function (done) {

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
        server.ext('onPostHandler', function (request, reply) {

            reply.state('test', '123');
            reply.unstate('empty');
            return reply.continue();
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.exist();
            expect(res.result).to.equal('text');
            expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
            expect(res.headers['content-type']).to.equal('text/plain; something=something, charset=ISO-8859-1');
            expect(res.headers['set-cookie']).to.deep.equal(['abc=123', 'sid=YWJjZGVmZzEyMzQ1Ng==', 'other=something; Secure', 'x=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'test=123', 'empty=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'always=present']);
            expect(res.headers.vary).to.equal('x-control');
            expect(res.headers.combo).to.equal('o-k');
            done();
        });
    });

    describe('_setSource()', function () {

        it('returns an empty string reply', function (done) {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('');
                }
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.headers['content-type']).to.not.exist();
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });

        it('returns a null reply', function (done) {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(null);
                }
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });

        it('returns an undefined reply', function (done) {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply();
                }
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });
    });

    describe('header()', function () {

        it('appends to set-cookie header', function (done) {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', 'A').header('set-cookie', 'B', { append: true });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.deep.equal(['A', 'B']);
                done();
            });
        });

        it('sets null header', function (done) {

            const handler = function (request, reply) {

                return reply('ok').header('set-cookie', null);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['set-cookie']).to.not.exist();
                done();
            });
        });

        it('throws error on non-ascii value', function (done) {

            var thrown = false;

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
            server.inject('/', function (res) {

                expect(thrown).to.equal(true);
                done();
            });
        });

        it('throws error on non-ascii value (header name)', function (done) {

            var thrown = false;

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
            server.inject('/', function (res) {

                expect(thrown).to.equal(true);
                done();
            });
        });

        it('throws error on non-ascii value (buffer)', function (done) {

            var thrown = false;

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
            server.inject('/', function (res) {

                expect(thrown).to.equal(true);
                done();
            });
        });
    });

    describe('created()', function () {

        it('returns a stream reply (created)', function (done) {

            const handler = function (request, reply) {

                return reply({ a: 1 }).created('/special');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({ method: 'POST', url: '/' }, function (res) {

                expect(res.result).to.deep.equal({ a: 1 });
                expect(res.statusCode).to.equal(201);
                expect(res.headers.location).to.equal('/special');
                expect(res.headers['cache-control']).to.equal('no-cache');
                done();
            });
        });

        it('returns error on created with GET', function (done) {

            const handler = function (request, reply) {

                return reply().created('/something');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('state()', function () {

        it('returns an error on bad cookie', function (done) {

            const handler = function (request, reply) {

                return reply('text').state(';sid', 'abcdefg123456');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.exist();
                expect(res.statusCode).to.equal(500);
                expect(res.result.message).to.equal('An internal server error occurred');
                expect(res.headers['set-cookie']).to.not.exist();
                done();
            });
        });
    });

    describe('unstate()', function () {

        it('allows options', function (done) {

            const handler = function (request, reply) {

                return reply().unstate('session', { path: '/unset', isSecure: true });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (unset) {

                expect(unset.statusCode).to.equal(200);
                expect(unset.headers['set-cookie']).to.deep.equal(['session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/unset']);
                done();
            });
        });
    });

    describe('vary()', function () {

        it('sets Vary header with single value', function (done) {

            const handler = function (request, reply) {

                return reply('ok').vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x');
                done();
            });
        });

        it('sets Vary header with multiple values', function (done) {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('y');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x,y');
                done();
            });
        });

        it('sets Vary header with *', function (done) {

            const handler = function (request, reply) {

                return reply('ok').vary('*');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('leaves Vary header with * on additional values', function (done) {

            const handler = function (request, reply) {

                return reply('ok').vary('*').vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('drops other Vary header values when set to *', function (done) {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('*');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('*');
                done();
            });
        });

        it('sets Vary header with multiple similar and identical values', function (done) {

            const handler = function (request, reply) {

                return reply('ok').vary('x').vary('xyz').vary('xy').vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('ok');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.vary).to.equal('x,xyz,xy');
                done();
            });
        });
    });

    describe('etag()', function () {

        it('sets etag', function (done) {

            const handler = function (request, reply) {

                return reply('ok').etag('abc');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.equal('"abc"');
                done();
            });
        });

        it('sets weak etag', function (done) {

            const handler = function (request, reply) {

                return reply('ok').etag('abc', { weak: true });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.equal('W/"abc"');
                done();
            });
        });

        it('ignores varyEtag when etag header is removed', function (done) {

            const handler = function (request, reply) {

                const response = reply('ok').etag('abc').vary('x');
                delete response.headers.etag;
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.not.exist();
                done();
            });
        });

        it('leaves etag header when varyEtag is false', function (done) {

            const handler = function (request, reply) {

                return reply('ok').etag('abc', { vary: false }).vary('x');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res1) {

                expect(res1.statusCode).to.equal(200);
                expect(res1.headers.etag).to.equal('"abc"');

                server.inject({ url: '/', headers: { 'if-none-match': '"abc-gzip"', 'accept-encoding': 'gzip' } }, function (res2) {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.headers.etag).to.equal('"abc"');
                    done();
                });
            });
        });

        it('applies varyEtag when returning 304 due to if-modified-since match', function (done) {

            const mdate = new Date().toUTCString();

            const handler = function (request, reply) {

                return reply('ok').etag('abc').header('last-modified', mdate);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject({ url: '/', headers: { 'if-modified-since': mdate, 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.statusCode).to.equal(304);
                expect(res.headers.etag).to.equal('"abc-gzip"');
                done();
            });
        });
    });

    describe('passThrough()', function () {

        it('passes stream headers and code through', function (done) {

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

            server.inject('/', function (res) {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(299);
                expect(res.headers.xcustom).to.equal('some value');
                done();
            });
        });

        it('excludes stream headers and code when passThrough is false', function (done) {

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

            server.inject('/', function (res) {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.xcustom).to.not.exist();
                done();
            });
        });

        it('ignores stream headers when empty', function (done) {

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

            server.inject('/', function (res) {

                expect(res.result).to.equal('x');
                expect(res.statusCode).to.equal(299);
                expect(res.headers.xcustom).to.not.exist();
                done();
            });
        });

        it('retains local headers with stream headers pass-through', function (done) {

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

            server.inject('/', function (res) {

                expect(res.result).to.equal('x');
                expect(res.headers.xcustom).to.equal('other value');
                expect(res.headers['set-cookie']).to.deep.equal(['a=1', 'b=2']);
                done();
            });
        });
    });

    describe('replacer()', function () {

        it('errors when called on wrong type', function (done) {

            const handler = function (request, reply) {

                return reply('x').replacer(['x']);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('spaces()', function () {

        it('errors when called on wrong type', function (done) {

            const handler = function (request, reply) {

                return reply('x').spaces(2);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('suffix()', function () {

        it('errors when called on wrong type', function (done) {

            const handler = function (request, reply) {

                return reply('x').suffix('x');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('type()', function () {

        it('returns a file in the response with the correct headers using custom mime type', function (done) {

            const server = new Hapi.Server();
            server.register(Inert, Hoek.ignore);
            server.connection({ routes: { files: { relativeTo: __dirname } } });
            const handler = function (request, reply) {

                return reply.file('../LICENSE').type('application/example');
            };

            server.route({ method: 'GET', path: '/file', handler: handler });

            server.inject('/file', function (res) {

                expect(res.headers['content-type']).to.equal('application/example');
                done();
            });
        });
    });

    describe('redirect()', function () {

        it('returns a redirection reply', function (done) {

            const handler = function (request, reply) {

                return reply('Please wait while we send your elsewhere').redirect('/example');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('http://example.org/', function (res) {

                expect(res.result).to.exist();
                expect(res.headers.location).to.equal('/example');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a redirection reply using verbose call', function (done) {

            const handler = function (request, reply) {

                return reply('We moved!').redirect().location('/examplex');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('We moved!');
                expect(res.headers.location).to.equal('/examplex');
                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 301 redirection reply', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').temporary().rewritable(false);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().rewritable(false);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 301 redirection reply (reveresed methods)', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable().permanent();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(301);
                done();
            });
        });

        it('returns a 302 redirection reply (reveresed methods)', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable().temporary();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });

        it('returns a 307 redirection reply (reveresed methods)', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).temporary();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(307);
                done();
            });
        });

        it('returns a 308 redirection reply (reveresed methods)', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').rewritable(false).permanent();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(308);
                done();
            });
        });

        it('returns a 302 redirection reply (flip flop)', function (done) {

            const handler = function (request, reply) {

                return reply().redirect('example').permanent().temporary();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(302);
                done();
            });
        });
    });

    describe('_prepare()', function () {

        it('handles promises that resolve', function (done) {

            const handler = function (request, reply) {

                return reply(Bluebird.resolve('promised response')).code(201);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('promised response');
                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('handles promises that resolve (object)', function (done) {

            const handler = function (request, reply) {

                return reply(Bluebird.resolve({ status: 'ok' })).code(201);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result.status).to.equal('ok');
                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('handles promises that resolve (response object)', function (done) {

            const handler = function (request, reply) {

                return reply(Bluebird.resolve(request.generateResponse({ status: 'ok' }).code(201)));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result.status).to.equal('ok');
                expect(res.statusCode).to.equal(201);
                done();
            });
        });

        it('handles promises that reject', function (done) {

            const handler = function (request, reply) {

                const promise = Bluebird.reject(Boom.forbidden('this is not allowed!'));
                promise.catch(Hoek.ignore);

                return reply(promise).code(299);            // Code ignored
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result.message).to.equal('this is not allowed!');
                expect(res.statusCode).to.equal(403);
                done();
            });
        });
    });

    describe('_marshal()', function () {

        it('emits request-error when view file for handler not found', function (done) {

            const server = new Hapi.Server({ debug: false });
            server.register(Vision, Hoek.ignore);
            server.connection();

            server.views({
                engines: { 'html': Handlebars },
                path: __dirname
            });

            server.once('request-error', function (request, err) {

                expect(err).to.exist();
                expect(err.message).to.contain('View file not found');
                done();
            });

            server.route({ method: 'GET', path: '/{param}', handler: { view: 'noview' } });

            server.inject('/hello', function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
                expect(res.result.message).to.equal('An internal server error occurred');
            });
        });
    });

    describe('_streamify()', function () {

        it('returns a formatted response', function (done) {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 });
            };

            const server = new Hapi.Server();
            server.connection({ routes: { json: { replacer: ['a'], space: 4, suffix: '\n' } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\n    \"a\": 1\n}\n');
                done();
            });
        });

        it('returns a response with options', function (done) {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 }).type('application/x-test').spaces(2).replacer(['a']).suffix('\n');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
                expect(res.headers['content-type']).to.equal('application/x-test');
                done();
            });
        });

        it('returns a response with options (different order)', function (done) {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 }).type('application/x-test').replacer(['a']).suffix('\n').spaces(2);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\n  \"a\": 1\n}\n');
                expect(res.headers['content-type']).to.equal('application/x-test');
                done();
            });
        });

        it('captures object which cannot be stringify', function (done) {

            const handler = function (request, reply) {

                const obj = {};
                obj.a = obj;
                return reply(obj);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('_tap()', function () {

        it('peeks into the response stream', function (done) {

            const server = new Hapi.Server();
            server.connection();

            var output = '';
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    const response = reply('1234567890');

                    response.on('peek', function (chunk) {

                        output += chunk.toString();
                    });

                    response.once('finish', function () {

                        output += '!';
                    });
                }
            });

            server.inject('/', function (res) {

                expect(output).to.equal('1234567890!');
                done();
            });
        });
    });

    describe('_close()', function () {

        it('calls custom close processor', function (done) {

            var closed = false;
            const close = function (response) {

                closed = true;
            };

            const handler = function (request, reply) {

                return reply(request.generateResponse(null, { close: close }));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(closed).to.be.true();
                done();
            });
        });
    });
});
