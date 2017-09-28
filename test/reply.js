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

    it('decorates reply with non function', async () => {

        const server = new Hapi.Server();

        server.decorate('reply', 'abc', 123);

        server.route({
            method: 'GET',
            path: '/',
            handler: (request, reply) => reply(reply.abc)
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(123);
    });

    it('redirects from handler', async () => {

        const handler = (request, reply) => {

            return reply.redirect('/elsewhere');
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
                    (request, reply) => {

                        return reply.redirect('/elsewhere').takeover();
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
            server.route({ method: 'GET', path: '/', handler: (request, reply) => reply() });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
            expect(res.headers['content-type']).to.not.exist();
        });

        it('returns a buffer reply', async () => {

            const handler = (request, reply) => {

                return reply(new Buffer('Tada1')).code(299);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(299);
            expect(res.result).to.equal('Tada1');
            expect(res.headers['content-type']).to.equal('application/octet-stream');
        });

        it('returns an object response', async () => {

            const handler = (request, reply) => {

                return reply({ a: 1, b: 2 });
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
            expect(res.headers['content-length']).to.equal(13);
        });

        it('returns false', async () => {

            const handler = (request, reply) => {

                return reply(false);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('false');
        });

        it('returns an error reply', async () => {

            const handler = (request, reply) => {

                return reply(new Error('boom'));
            };

            const server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist();
        });

        it('returns an empty reply', async () => {

            const handler = (request, reply) => {

                return reply().code(299);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(299);
            expect(res.headers['content-length']).to.equal(0);
            expect(res.result).to.equal(null);
        });

        it('returns a stream reply', async () => {

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

            const handler = (request, reply) => {

                return reply(new TestStream()).ttl(2000);
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

    it('errors on non-readable stream reply', async () => {

        const streamHandler = (request, reply) => {

            const stream = new Stream();
            stream.writable = true;

            return reply(stream);
        };

        const writableHandler = (request, reply) => {

            const writable = new Stream.Writable();
            writable._write = function () { };

            return reply(writable);
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

    it('errors on an http client stream reply', async () => {

        const handler = (request, reply) => {

            return reply('just a string');
        };

        const streamHandler = (request, reply) => {

            return reply(Http.get(request.server.info + '/'));
        };

        const server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', handler });
        server.route({ method: 'GET', path: '/stream', handler: streamHandler });

        await server.initialize();
        const res = await server.inject('/stream');
        expect(res.statusCode).to.equal(500);
    });

    it('errors on objectMode stream reply', async () => {

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

        const handler = (request, reply) => {

            return reply(new TestStream());
        };

        const server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(500);
    });

    describe('close()', () => {

        it('returns a reply with manual end', async () => {

            const handler = (request, reply) => {

                request.raw.res.end();
                return reply.abandon;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('');
        });

        it('returns a reply with auto end', async () => {

            const handler = (request, reply) => {

                return reply.close;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('');
        });
    });

    describe('continue()', () => {

        it('sets empty reply on continue in handler', async () => {

            const handler = (request, reply) => {

                return reply.continue;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(null);
            expect(res.payload).to.equal('');
        });

        it('ignores continue in prerequisite', async () => {

            const pre1 = (request, reply) => {

                return reply.continue;
            };

            const pre2 = (request, reply) => {

                return reply.continue;
            };

            const pre3 = (request, reply) => {

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

            server.ext('onPreResponse', (request, reply) => {

                if (request.response.isBoom) {
                    return reply('2');
                }

                return reply.continue;
            });

            server.ext('onPreResponse', (request, reply) => {

                request.response.source += 'x';
                return reply.continue;
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    return reply(request.query.x ? new Error() : '1');
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

            const handler = (request, reply) => {

                return reply.continue('ok');
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
                handler: (request, reply) => {

                    if (reply.entity({ modified: 1200 })) {
                        return;
                    }

                    ++count;
                    return reply('ok');
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
                    handler: (request, reply) => {

                        const response = reply.entity({ etag: 'abc' });
                        if (response) {
                            response.header('X', 'y');
                            return;
                        }

                        ++count;
                        return reply('ok');
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

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    if (!reply.entity({ etag: 'abc', vary: false })) {
                        return reply('ok');
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
                handler: (request, reply) => {

                    if (!reply.entity({ etag: 'abc' })) {
                        return reply('ok').etag('def');
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.headers.etag).to.equal('"def"');
        });
    });
});
