'use strict';

// Load modules

const Http = require('http');
const Stream = require('stream');

const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Reply', () => {

    it('decorates responder with non function', async () => {

        const server = new Hapi.Server();

        server.decorate('responder', 'abc', 123);

        server.route({
            method: 'GET',
            path: '/',
            handler: (request, responder) => responder.wrap(responder.abc)
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(123);
    });

    it('redirects from handler', async () => {

        const handler = (request, responder) => {

            return responder.redirect('/elsewhere');
        };

        const server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler });
        const res = await server.inject('/');
        expect(res.statusCode).to.equal(302);
        expect(res.headers.location).to.equal('/elsewhere');
    });

    it('redirects from pre', async () => {

        const server = new Hapi.Server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [
                    (request, responder) => {

                        return responder.redirect('/elsewhere').takeover();
                    }
                ],
                handler: () => 'ok'
            }
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(302);
        expect(res.headers.location).to.equal('/elsewhere');
    });

    describe('response()', () => {

        it('returns null', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, responder) => responder.wrap() });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
            expect(res.headers['content-type']).to.not.exist();
        });

        it('returns a buffer responder', async () => {

            const handler = (request, responder) => {

                return responder.wrap(new Buffer('Tada1')).code(299);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(299);
            expect(res.result).to.equal('Tada1');
            expect(res.headers['content-type']).to.equal('application/octet-stream');
        });

        it('returns an object response', async () => {

            const handler = (request, responder) => {

                return responder.wrap({ a: 1, b: 2 });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
            expect(res.headers['content-length']).to.equal(13);
        });

        it('returns false', async () => {

            const handler = (request, responder) => {

                return responder.wrap(false);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('false');
        });

        it('returns an error responder', async () => {

            const handler = (request, responder) => {

                return responder.wrap(new Error('boom'));
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist();
        });

        it('returns an empty responder', async () => {

            const handler = (request, responder) => {

                return responder.wrap().code(299);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(299);
            expect(res.headers['content-length']).to.equal(0);
            expect(res.result).to.equal(null);
        });

        it('returns a stream responder', async () => {

            const TestStream = function () {

                Stream.Readable.call(this);
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                this.push('x');
                this.push('y');
                this.push(null);
            };

            const handler = (request, responder) => {

                return responder.wrap(new TestStream()).ttl(2000);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/stream', config: { handler, cache: { expiresIn: 9999 } } });

            const res1 = await server.inject('/stream');
            expect(res1.result).to.equal('xy');
            expect(res1.statusCode).to.equal(200);
            expect(res1.headers['cache-control']).to.equal('max-age=2, must-revalidate');

            const res2 = await server.inject({ method: 'HEAD', url: '/stream' });
            expect(res2.result).to.equal('');
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers['cache-control']).to.equal('max-age=2, must-revalidate');
        });
    });

    it('errors on non-readable stream responder', async () => {

        const streamHandler = (request, responder) => {

            const stream = new Stream();
            stream.writable = true;

            return responder.wrap(stream);
        };

        const writableHandler = (request, responder) => {

            const writable = new Stream.Writable();
            writable._write = function () { };

            return responder.wrap(writable);
        };

        const server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/stream', handler: streamHandler });
        server.route({ method: 'GET', path: '/writable', handler: writableHandler });

        let updates = 0;
        server.events.on('request-error', (request, err) => {

            expect(err).to.be.an.error('Stream must have a streams2 readable interface');
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

    it('errors on an http client stream responder', async () => {

        const handler = (request, responder) => {

            return responder.wrap('just a string');
        };

        const streamHandler = (request, responder) => {

            return responder.wrap(Http.get(request.server.info + '/'));
        };

        const server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', handler });
        server.route({ method: 'GET', path: '/stream', handler: streamHandler });

        await server.initialize();
        const res = await server.inject('/stream');
        expect(res.statusCode).to.equal(500);
    });

    it('errors on objectMode stream responder', async () => {

        const TestStream = function () {

            Stream.Readable.call(this, { objectMode: true });
        };

        Hoek.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            if (this.isDone) {
                return;
            }
            this.isDone = true;

            this.push({ x: 1 });
            this.push({ y: 1 });
            this.push(null);
        };

        const handler = (request, responder) => {

            return responder.wrap(new TestStream());
        };

        const server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(500);
    });

    describe('close()', () => {

        it('returns a responder with manual end', async () => {

            const handler = (request, responder) => {

                request.raw.res.end();
                return responder.abandon;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('');
        });

        it('returns a responder with auto end', async () => {

            const handler = (request, responder) => {

                return responder.close;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('');
        });
    });

    describe('continue()', () => {

        it('sets empty responder on continue in handler', async () => {

            const handler = (request, responder) => {

                return responder.continue;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('ignores continue in prerequisite', async () => {

            const pre1 = (request, responder) => {

                return responder.continue;
            };

            const pre2 = (request, responder) => {

                return responder.continue;
            };

            const pre3 = (request, responder) => {

                return {
                    m1: request.pre.m1,
                    m2: request.pre.m2
                };
            };

            const server = new Hapi.Server();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        { method: pre1, assign: 'm1' },
                        { method: pre2, assign: 'm2' },
                        { method: pre3, assign: 'm3' }
                    ],
                    handler: (request) => request.pre.m3
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({
                m1: null,
                m2: null
            });
            expect(res.payload).to.equal('{"m1":null,"m2":null}');
        });

        it('overrides response in post handler extension', async () => {

            const server = new Hapi.Server();

            server.ext('onPreResponse', (request, responder) => {

                if (request.response.isBoom) {
                    return responder.wrap('2');
                }

                return responder.continue;
            });

            server.ext('onPreResponse', (request, responder) => {

                request.response.source += 'x';
                return responder.continue;
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, responder) => {

                    return responder.wrap(request.query.x ? new Error() : '1');
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.equal('1x');

            const res2 = await server.inject('/?x=1');
            expect(res2.statusCode).to.equal(200);
            expect(res2.result).to.equal('2x');
        });

        it('errors on non auth argument', async () => {

            const handler = (request, responder) => {

                return responder.continue('ok');
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('entity()', () => {

        it('returns a 304 when the request has if-modified-since', async () => {

            const server = new Hapi.Server();

            let count = 0;
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, responder) => {

                    if (responder.entity({ modified: 1200 })) {
                        return;
                    }

                    ++count;
                    return responder.wrap('ok');
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.equal('ok');
            expect(res1.headers['last-modified']).to.equal(1200);

            const res2 = await server.inject({ url: '/', headers: { 'if-modified-since': '1200' } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers['last-modified']).to.equal(1200);
            expect(count).to.equal(1);
        });

        it('returns a 304 when the request has if-none-match', async () => {

            const server = new Hapi.Server();

            let count = 0;
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    cache: { expiresIn: 5000 },
                    handler: (request, responder) => {

                        const response = responder.entity({ etag: 'abc' });
                        if (response) {
                            response.header('X', 'y');
                            return;
                        }

                        ++count;
                        return responder.wrap('ok');
                    }
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.equal('ok');
            expect(res1.headers.etag).to.equal('"abc"');
            expect(res1.headers['cache-control']).to.equal('max-age=5, must-revalidate');

            const res2 = await server.inject({ url: '/', headers: { 'if-none-match': '"abc"' } });
            expect(res2.statusCode).to.equal(304);
            expect(res2.headers.etag).to.equal('"abc"');
            expect(res2.headers['cache-control']).to.equal('max-age=5, must-revalidate');
            expect(count).to.equal(1);
        });

        it('leaves etag header when vary is false', async () => {

            const server = new Hapi.Server({ compression: { minBytes: 1 } });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, responder) => {

                    if (!responder.entity({ etag: 'abc', vary: false })) {
                        return 'ok';
                    }
                }
            });

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);
            expect(res1.headers.etag).to.equal('"abc"');

            const res2 = await server.inject({ url: '/', headers: { 'if-none-match': '"abc-gzip"', 'accept-encoding': 'gzip' } });
            expect(res2.statusCode).to.equal(200);
            expect(res2.headers.etag).to.equal('"abc"');
        });

        it('uses last etag set', async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, responder) => {

                    if (!responder.entity({ etag: 'abc' })) {
                        return responder.wrap('ok').etag('def');
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.equal('"def"');
        });
    });
});
