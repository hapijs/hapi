'use strict';

const Path = require('path');
const Stream = require('stream');

const Code = require('@hapi/code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Inert = require('@hapi/inert');
const Lab = require('@hapi/lab');
const Teamwork = require('@hapi/teamwork');
const Vision = require('@hapi/vision');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Toolkit', () => {

    describe('Manager', () => {

        describe('decorate()', () => {

            it('decorates toolkit with non function', async () => {

                const server = Hapi.server();

                server.decorate('toolkit', 'abc', 123);

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: (request, h) => h.response(h.abc)
                });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(123);
            });

            it('returns a file', async () => {

                const server = Hapi.server({ routes: { files: { relativeTo: Path.join(__dirname, '../') } } });
                await server.register(Inert);
                const handler = (request, h) => {

                    return h.file('./package.json').code(999);
                };

                server.route({ method: 'GET', path: '/file', handler });

                const res = await server.inject('/file');
                expect(res.statusCode).to.equal(999);
                expect(res.payload).to.contain('hapi');
                expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                expect(res.headers['content-length']).to.exist();
                expect(res.headers['content-disposition']).to.not.exist();
            });

            it('returns a view', async () => {

                const server = Hapi.server();
                await server.register(Vision);

                server.views({
                    engines: { 'html': Handlebars },
                    relativeTo: Path.join(__dirname, '/templates/plugin')
                });

                const handler = (request, h) => {

                    return h.view('test', { message: 'steve' });
                };

                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.result).to.equal('<h1>steve</h1>');
            });
        });

        describe('execute()', () => {

            it('replaces non-error throws with error', async () => {

                const handler = () => {

                    throw 'this is not an error';
                };

                const server = Hapi.server({ debug: false });
                server.route({ method: 'GET', path: '/', handler });
                const res = await server.inject('/');
                expect(res.statusCode).to.equal(500);
            });

            it('includes method name when method missing return', async () => {

                const team = new Teamwork.Team();
                const myErrorHandler = () => {};

                const server = Hapi.server({ debug: false });
                server.route({ method: 'GET', path: '/', handler: myErrorHandler });

                server.events.on({ name: 'request', channels: 'error' }, (request, err) => {

                    team.attend(err);
                });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(500);
                const err = await team.work;
                expect(err.error.message).to.contain('myErrorHandler');
            });
        });
    });

    describe('Toolkit', () => {

        describe('redirect()', () => {

            it('redirects from handler', async () => {

                const handler = (request, h) => {

                    return h.redirect('/elsewhere');
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });
                const res = await server.inject('/');
                expect(res.statusCode).to.equal(302);
                expect(res.headers.location).to.equal('/elsewhere');
            });

            it('redirects from pre', async () => {

                const server = Hapi.server();
                server.route({
                    method: 'GET',
                    path: '/',
                    options: {
                        pre: [
                            (request, h) => {

                                return h.redirect('/elsewhere').takeover();
                            }
                        ],
                        handler: () => 'ok'
                    }
                });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(302);
                expect(res.headers.location).to.equal('/elsewhere');
            });
        });

        describe('response()', () => {

            it('returns null', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: (request, h) => h.response() });
                const res = await server.inject('/');
                expect(res.statusCode).to.equal(204);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
                expect(res.headers['content-type']).to.not.exist();
            });

            it('returns a buffer response', async () => {

                const handler = (request, h) => {

                    return h.response(Buffer.from('Tada1')).code(299);
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('Tada1');
                expect(res.headers['content-type']).to.equal('application/octet-stream');
            });

            it('returns an object response', async () => {

                const handler = (request, h) => {

                    return h.response({ a: 1, b: 2 });
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
                expect(res.headers['content-length']).to.equal(13);
            });

            it('returns false', async () => {

                const handler = (request, h) => {

                    return h.response(false);
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.payload).to.equal('false');
            });

            it('returns an error response', async () => {

                const handler = (request, h) => {

                    return h.response(new Error('boom'));
                };

                const server = Hapi.server({ debug: false });
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
            });

            it('returns an empty response', async () => {

                const handler = (request, h) => {

                    return h.response().code(299);
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(299);
                expect(res.headers['content-length']).to.equal(0);
                expect(res.result).to.equal(null);
            });

            it('returns a stream response', async () => {

                const TestStream = class extends Stream.Readable {

                    _read(size) {

                        if (this.isDone) {
                            return;
                        }

                        this.isDone = true;

                        this.push('x');
                        this.push('y');
                        this.push(null);
                    }
                };

                const handler = (request, h) => {

                    return h.response(new TestStream()).ttl(2000);
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/stream', options: { handler, cache: { expiresIn: 9999 } } });

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

        describe('abandon', () => {

            it('abandon request with manual response (handler)', async () => {

                const handler = (request, h) => {

                    request.raw.res.setHeader('content-type', 'text/plain');
                    request.raw.res.end('manual');
                    return h.abandon;
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.result).to.equal('manual');
            });

            it('abandon request with manual response (onRequest)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: () => null });

                server.ext('onRequest', (request, h) => {

                    request.raw.res.setHeader('content-type', 'text/plain');
                    request.raw.res.end('manual');
                    return h.abandon;
                });

                const res = await server.inject('/');
                expect(res.result).to.equal('manual');
            });

            it('abandon request with manual response (lifecycle)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: () => null });

                server.ext('onPreHandler', (request, h) => {

                    request.raw.res.setHeader('content-type', 'text/plain');
                    request.raw.res.end('manual');
                    return h.abandon;
                });

                const res = await server.inject('/');
                expect(res.result).to.equal('manual');
            });

            it('abandon request with manual response (post cycle)', async () => {

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: () => null });

                server.ext('onPreResponse', (request, h) => {

                    request.raw.res.setHeader('content-type', 'text/plain');
                    request.raw.res.end('manual');
                    return h.abandon;
                });

                const res = await server.inject('/');
                expect(res.result).to.equal('manual');
            });
        });

        describe('close', () => {

            it('returns a response with auto end (handler)', async () => {

                const handler = (request, h) => {

                    return h.close;
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.result).to.equal('');
            });

            it('returns a response with auto end (pre)', async () => {

                const pre = (request, h) => {

                    return h.close;
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler: () => 'ok', options: { pre: [pre] } });

                const res = await server.inject('/');
                expect(res.result).to.equal('');
            });
        });

        describe('continue', () => {

            it('sets empty response on continue in handler', async () => {

                const handler = (request, h) => {

                    return h.continue;
                };

                const server = Hapi.server();
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(204);
                expect(res.result).to.equal(null);
                expect(res.payload).to.equal('');
            });

            it('ignores continue in prerequisite', async () => {

                const pre1 = (request, h) => {

                    return h.continue;
                };

                const pre2 = (request, h) => {

                    return h.continue;
                };

                const pre3 = (request, h) => {

                    return {
                        m1: request.pre.m1,
                        m2: request.pre.m2
                    };
                };

                const server = Hapi.server();
                server.route({
                    method: 'GET',
                    path: '/',
                    options: {
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

                const server = Hapi.server();

                server.ext('onPreResponse', (request, h) => {

                    if (request.response.isBoom) {
                        return h.response('2');
                    }

                    return h.continue;
                });

                server.ext('onPreResponse', (request, h) => {

                    request.response.source += 'x';
                    return h.continue;
                });

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: (request, h) => {

                        return h.response(request.query.x ? new Error() : '1');
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

                const handler = (request, h) => {

                    return h.continue('ok');
                };

                const server = Hapi.server({ debug: false });
                server.route({ method: 'GET', path: '/', handler });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(500);
            });
        });

        describe('entity()', () => {

            it('returns a 304 when the request has if-modified-since', async () => {

                const server = Hapi.server();

                let count = 0;
                server.route({
                    method: 'GET',
                    path: '/',
                    handler: (request, h) => {

                        if (h.entity({ modified: 1200 })) {
                            return;
                        }

                        ++count;
                        return h.response('ok');
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

            it('does not override manual last-modified header', async () => {

                const server = Hapi.server();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: (request, h) => {

                        h.entity({ modified: 1200 });
                        return h.response('ok').header('last-modified', 999);
                    }
                });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('ok');
                expect(res.headers['last-modified']).to.equal(999);
            });

            it('returns a 304 when the request has if-none-match', async () => {

                const server = Hapi.server();

                let count = 0;
                server.route({
                    method: 'GET',
                    path: '/',
                    options: {
                        cache: { expiresIn: 5000 },
                        handler: (request, h) => {

                            const response = h.entity({ etag: 'abc' });
                            if (response) {
                                response.header('X', 'y');
                                return;
                            }

                            ++count;
                            return h.response('ok');
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

                const res3 = await server.inject({ url: '/', headers: { 'if-none-match': 'W/"abc"' } });
                expect(res3.statusCode).to.equal(304);
                expect(res3.headers.etag).to.equal('W/"abc"');
                expect(res3.headers['cache-control']).to.equal('max-age=5, must-revalidate');
                expect(count).to.equal(1);
            });

            it('leaves etag header when vary is false', async () => {

                const server = Hapi.server({ compression: { minBytes: 1 } });

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: (request, h) => {

                        if (!h.entity({ etag: 'abc', vary: false })) {
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

                const server = Hapi.server();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: (request, h) => {

                        if (!h.entity({ etag: 'abc' })) {
                            return h.response('ok').etag('def');
                        }
                    }
                });

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(200);
                expect(res.headers.etag).to.equal('"def"');
            });
        });
    });
});
