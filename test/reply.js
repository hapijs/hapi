'use strict';

const Http = require('http');
const Stream = require('stream');

const Boom = require('boom');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');


const internals = {};


const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Reply', () => {

    it('decorates reply with non function', (done) => {

        const server = new Hapi.Server();
        server.connection();

        server.decorate('reply', 'abc', 123);

        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply(reply.abc);
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(123);
            done();
        });
    });

    it('throws when reply called twice', (done) => {

        const handler = function (request, reply) {

            reply('ok'); return reply('not ok');
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({ method: 'GET', path: '/', handler });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('redirects from handler', (done) => {

        const handler = function (request, reply) {

            return reply.redirect('/elsewhere');
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', handler });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('/elsewhere');
            done();
        });
    });

    it('redirects from pre', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                pre: [
                    function (request, reply) {

                        return reply.redirect('/elsewhere').takeover();
                    }
                ],
                handler: function (request, reply) {

                    return reply('ok');
                }
            }
        });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('/elsewhere');
            done();
        });
    });

    describe('interface()', () => {

        it('uses reply(null, result) for result', (done) => {

            const handler = function (request, reply) {

                return reply(null, 'steve');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('steve');
                done();
            });
        });

        it('uses reply(null, err) for err', (done) => {

            const handler = function (request, reply) {

                return reply(null, Boom.badRequest());
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('ignores result when err provided in reply(err, result)', (done) => {

            const handler = function (request, reply) {

                return reply(Boom.badRequest(), 'steve');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('errors when reply() is called with a third argument', (done) => {

            const handler = function (request, reply) {

                return reply(null, 'ok', 'third');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('response()', () => {

        it('returns null', (done) => {

            const handler = function (request, reply) {

                return reply(null, null);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                expect(res.headers['content-type']).to.not.exist();
                done();
            });
        });

        it('returns a buffer reply', (done) => {

            const handler = function (request, reply) {

                return reply(Buffer.from('Tada1')).code(299);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('Tada1');
                expect(res.headers['content-type']).to.equal('application/octet-stream');
                done();
            });
        });

        it('returns an object response', (done) => {

            const handler = function (request, reply) {

                return reply({ a: 1, b: 2 });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
                expect(res.headers['content-length']).to.equal(13);
                done();
            });
        });

        it('returns false', (done) => {

            const handler = function (request, reply) {

                return reply(false);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('false');
                done();
            });
        });

        it('returns an error reply', (done) => {

            const handler = function (request, reply) {

                return reply(new Error('boom'));
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
                done();
            });
        });

        it('returns an empty reply', (done) => {

            const handler = function (request, reply) {

                return reply().code(299);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(299);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.result).to.equal(null);
                done();
            });
        });

        it('returns a stream reply', (done) => {

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

            const handler = function (request, reply) {

                return reply(new TestStream()).ttl(2000);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/stream', config: { handler, cache: { expiresIn: 9999 } } });

            server.inject('/stream', (res1) => {

                expect(res1.result).to.equal('xy');
                expect(res1.statusCode).to.equal(200);
                expect(res1.headers['cache-control']).to.equal('max-age=2, must-revalidate');

                server.inject({ method: 'HEAD', url: '/stream' }, (res2) => {

                    expect(res2.result).to.equal('');
                    expect(res2.statusCode).to.equal(200);
                    expect(res2.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                    done();
                });
            });
        });

        it('errors on non-readable stream reply', (done) => {

            const streamHandler = function (request, reply) {

                const stream = new Stream();
                stream.writable = true;

                reply(stream);
            };

            const writableHandler = function (request, reply) {

                const writable = new Stream.Writable();
                writable._write = function () { };

                reply(writable);
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });
            server.route({ method: 'GET', path: '/writable', handler: writableHandler });

            let updates = 0;
            server.on('request-error', (request, err) => {

                expect(err).to.be.an.error('Stream must have a streams2 readable interface');
                ++updates;
            });

            server.initialize((err) => {

                expect(err).to.not.exist();
                server.inject('/stream', (res1) => {

                    expect(res1.statusCode).to.equal(500);
                    server.inject('/writable', (res2) => {

                        expect(res2.statusCode).to.equal(500);
                        setTimeout(() => {

                            expect(updates).to.equal(2);
                            done();
                        }, 10);
                    });
                });
            });
        });

        it('errors on an http client stream reply', (done) => {

            const handler = function (request, reply) {

                reply('just a string');
            };

            const streamHandler = function (request, reply) {

                reply(Http.get(request.server.info + '/'));
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler });
            server.route({ method: 'GET', path: '/stream', handler: streamHandler });

            server.initialize((err) => {

                expect(err).to.not.exist();

                server.inject('/stream', (res) => {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });

        it('errors on objectMode stream reply', (done) => {

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

            const handler = function (request, reply) {

                return reply(new TestStream());
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        describe('promises', () => {

            it('returns a stream', (done) => {

                const TestStream = function () {

                    Stream.Readable.call(this);

                    this.statusCode = 200;
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

                const handler = function (request, reply) {

                    return reply(new Promise((resolve, reject) => {

                        return resolve(new TestStream());
                    })).ttl(2000).code(299);
                };


                const server = new Hapi.Server({ debug: false });
                server.connection();
                server.route({ method: 'GET', path: '/stream', config: { handler, cache: { expiresIn: 9999 } } });

                server.inject('/stream', (res) => {

                    expect(res.result).to.equal('xy');
                    expect(res.statusCode).to.equal(299);
                    done();
                });
            });

            it('returns a buffer', (done) => {

                const handler = function (request, reply) {

                    return reply(new Promise((resolve, reject) => {

                        return resolve(Buffer.from('buffer content'));
                    })).code(299).type('something/special');
                };

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/', handler });

                server.inject('/', (res) => {

                    expect(res.statusCode).to.equal(299);
                    expect(res.result.toString()).to.equal('buffer content');
                    expect(res.headers['content-type']).to.equal('something/special');
                    done();
                });
            });

            it('returns an error when rejecting with an error object', (done) => {

                const handler = function (request, reply) {

                    return reply(Promise.reject(new Error('rejected')));
                };

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/', handler });

                server.inject('/', (res) => {

                    expect(res.statusCode).to.equal(500);
                    expect(res.result).to.exist();
                    expect(res.result.message).to.equal('An internal server error occurred');
                    done();
                });
            });

            it('returns an error when resolving with an error object', (done) => {

                const handler = function (request, reply) {

                    return reply(Promise.resolve(new Error('rejected')));
                };

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/', handler });

                server.inject('/', (res) => {

                    expect(res.statusCode).to.equal(500);
                    expect(res.result).to.exist();
                    expect(res.result.message).to.equal('An internal server error occurred');
                    done();
                });
            });

            it('returns an error when rejecting with a non-error object', (done) => {

                const handler = function (request, reply) {

                    return reply(Promise.reject({ error: 'rejected' }));
                };

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/', handler });

                server.inject('/', (res) => {

                    expect(res.statusCode).to.equal(500);
                    expect(res.result).to.exist();
                    expect(res.result.message).to.equal('An internal server error occurred');
                    done();
                });
            });

            it('returns an error when throwing in a promise constructor', (done) => {

                const handler = function (request, reply) {

                    const p = new Promise(() => {

                        throw new Error('thrown');
                    });

                    return reply(p);
                };

                const server = new Hapi.Server();
                server.connection();
                server.route({ method: 'GET', path: '/', handler });

                server.inject('/', (res) => {

                    expect(res.statusCode).to.equal(500);
                    expect(res.result).to.exist();
                    expect(res.result.message).to.equal('An internal server error occurred');
                    done();
                });
            });
        });
    });

    describe('hold()', () => {

        it('undo scheduled next tick in reply interface', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply('123').hold().send();
            };

            server.route({ method: 'GET', path: '/domain', handler });

            server.inject('/domain', (res) => {

                expect(res.result).to.equal('123');
                done();
            });
        });

        it('sends reply after timed handler', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                const response = reply('123').hold();
                setTimeout(() => {

                    response.send();
                }, 10);
            };

            server.route({ method: 'GET', path: '/domain', handler });

            server.inject('/domain', (res) => {

                expect(res.result).to.equal('123');
                done();
            });
        });
    });

    describe('close()', () => {

        it('returns a reply with manual end', (done) => {

            const handler = function (request, reply) {

                request.raw.res.end();
                return reply.close({ end: false });
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler } });

            server.inject('/', (res) => {

                expect(res.result).to.equal('');
                done();
            });
        });

        it('returns a reply with auto end', (done) => {

            const handler = function (request, reply) {

                return reply.close();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler } });

            server.inject('/', (res) => {

                expect(res.result).to.equal('');
                done();
            });
        });
    });

    describe('continue()', () => {

        it('sets empty reply on continue in handler', (done) => {

            const handler = function (request, reply) {

                return reply.continue();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                done();
            });
        });

        it('sets empty reply on continue in prerequisite', (done) => {

            const pre1 = function (request, reply) {

                return reply.continue();
            };

            const pre2 = function (request, reply) {

                return reply.continue();
            };

            const pre3 = function (request, reply) {

                return reply({
                    m1: request.pre.m1,
                    m2: request.pre.m2
                });
            };

            const handler = function (request, reply) {

                return reply(request.pre.m3);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    pre: [
                        { method: pre1, assign: 'm1' },
                        { method: pre2, assign: 'm2' },
                        { method: pre3, assign: 'm3' }
                    ],
                    handler
                }
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal({
                    m1: null,
                    m2: null
                });
                expect(res.payload).to.equal('{"m1":null,"m2":null}');
                done();
            });
        });

        it('overrides response in post handler extension', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.ext('onPreResponse', (request, reply) => {

                if (request.response.isBoom) {
                    return reply.continue('2');
                }

                return reply.continue();
            });

            server.ext('onPreResponse', (request, reply) => {

                request.response.source += 'x';
                return reply.continue();
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.query.x ? new Error() : '1');
                }
            });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result).to.equal('1x');

                server.inject('/?x=1', (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.result).to.equal('2x');
                    done();
                });
            });
        });

        it('errors on non auth argument', (done) => {

            const handler = function (request, reply) {

                return reply.continue('ok');
            };

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('entity()', () => {

        it('returns a 304 when the request has if-modified-since', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let count = 0;
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    if (reply.entity({ modified: 1200 })) {
                        return;
                    }

                    ++count;
                    return reply('ok');
                }
            });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result).to.equal('ok');
                expect(res1.headers['last-modified']).to.equal(1200);

                server.inject({ url: '/', headers: { 'if-modified-since': '1200' } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers['last-modified']).to.equal(1200);
                    expect(count).to.equal(1);
                    done();
                });
            });
        });

        it('returns a 304 when the request has if-none-match', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let count = 0;
            server.route({
                method: 'GET',
                path: '/',
                config: {
                    cache: { expiresIn: 5000 },
                    handler: function (request, reply) {

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

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.result).to.equal('ok');
                expect(res1.headers.etag).to.equal('"abc"');
                expect(res1.headers['cache-control']).to.equal('max-age=5, must-revalidate');

                server.inject({ url: '/', headers: { 'if-none-match': '"abc"' } }, (res2) => {

                    expect(res2.statusCode).to.equal(304);
                    expect(res2.headers.etag).to.equal('"abc"');
                    expect(res2.headers['cache-control']).to.equal('max-age=5, must-revalidate');
                    expect(count).to.equal(1);
                    done();
                });
            });
        });

        it('leaves etag header when vary is false', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    if (!reply.entity({ etag: 'abc', vary: false })) {
                        return reply('ok');
                    }
                }
            });

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

        it('uses last etag set', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    if (!reply.entity({ etag: 'abc' })) {
                        return reply('ok').etag('def');
                    }
                }
            });

            server.inject('/', (res1) => {

                expect(res1.statusCode).to.equal(200);
                expect(res1.headers.etag).to.equal('"def"');
                done();
            });
        });
    });
});
