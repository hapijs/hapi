'use strict';

// Load modules

const Http = require('http');
const Net = require('net');
const Stream = require('stream');
const Url = require('url');

const Boom = require('boom');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');
const Teamwork = require('teamwork');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Request.Generator', () => {

    it('decorates request multiple times', async () => {

        const server = Hapi.server();

        server.decorate('request', 'x2', () => 2);
        server.decorate('request', 'abc', () => 1);

        server.route({
            method: 'GET',
            path: '/',
            handler: (request) => {

                return request.x2() + request.abc();
            }
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(3);
    });

    it('decorates request with non function method', async () => {

        const server = Hapi.server();
        const symbol = Symbol('abc');

        server.decorate('request', 'x2', 2);
        server.decorate('request', symbol, 1);

        server.route({
            method: 'GET',
            path: '/',
            handler: (request) => {

                return request.x2 + request[symbol];
            }
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(3);
    });

    it('does not share decorations between servers via prototypes', async () => {

        const server1 = Hapi.server();
        const server2 = Hapi.server();
        const route = {
            method: 'GET',
            path: '/',
            handler: (request) => {

                return Object.keys(Object.getPrototypeOf(request));
            }
        };
        let res;

        server1.decorate('request', 'x1', 1);
        server2.decorate('request', 'x2', 2);

        server1.route(route);
        server2.route(route);

        res = await server1.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(['x1']);

        res = await server2.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(['x2']);
    });
});

describe('Request', () => {

    it('sets client address', async () => {

        const server = Hapi.server();

        const handler = (request) => {

            let expectedClientAddress = '127.0.0.1';
            if (Net.isIPv6(server.listener.address().address)) {
                expectedClientAddress = '::ffff:127.0.0.1';
            }

            expect(request.info.remoteAddress).to.equal(expectedClientAddress);
            expect(request.info.remoteAddress).to.equal(request.info.remoteAddress);
            return 'ok';
        };

        server.route({ method: 'GET', path: '/', handler });

        await server.start();

        const { payload } = await Wreck.get('http://localhost:' + server.info.port);
        expect(payload.toString()).to.equal('ok');
        await server.stop();
    });

    it('sets referrer', async () => {

        const server = Hapi.server();

        const handler = (request) => {

            expect(request.info.referrer).to.equal('http://site.com');
            return 'ok';
        };

        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject({ url: '/', headers: { referrer: 'http://site.com' } });
        expect(res.result).to.equal('ok');
    });

    it('sets referer', async () => {

        const server = Hapi.server();

        const handler = (request) => {

            expect(request.info.referrer).to.equal('http://site.com');
            return 'ok';
        };

        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject({ url: '/', headers: { referer: 'http://site.com' } });
        expect(res.result).to.equal('ok');
    });

    it('sets acceptEncoding', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: (request) => request.info.acceptEncoding });

        const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
        expect(res.result).to.equal('gzip');
    });

    it('handles invalid accept encoding header', async () => {

        const server = Hapi.server({ routes: { log: { collect: true } } });

        const handler = (request) => {

            expect(request.logs[0].error.header).to.equal('a;b');
            return request.info.acceptEncoding;
        };

        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject({ url: '/', headers: { 'accept-encoding': 'a;b' } });
        expect(res.result).to.equal('identity');
    });

    it('sets headers', async () => {

        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', handler: (request) => request.headers['user-agent'] });

        const res = await server.inject('/');
        expect(res.payload).to.equal('shot');
    });

    it('generates unique request id', async () => {

        const server = Hapi.server();
        server._core.requestCounter = { value: 10, min: 10, max: 11 };
        server.route({ method: 'GET', path: '/', handler: (request) => request.info.id });

        const res1 = await server.inject('/');
        expect(res1.result).to.match(/10$/);

        const res2 = await server.inject('/');
        expect(res2.result).to.match(/11$/);

        const res3 = await server.inject('/');
        expect(res3.result).to.match(/10$/);
    });

    describe('active()', () => {

        it('exits handler early when request is no longer active', async () => {

            const server = Hapi.server();
            const team = new Teamwork();

            let rounds = 0;
            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: async (request, h) => {

                        for (let i = 0; i < 100; ++i) {
                            ++rounds;
                            await Hoek.wait(10);

                            if (!request.active()) {
                                break;
                            }
                        }

                        team.attend();
                        return null;
                    }
                }
            });

            await server.start();

            const req = Http.get(server.info.uri, (res) => { });
            req.on('error', Hoek.ignore);

            await Hoek.wait(50);
            req.abort();
            await server.stop();

            await team.work;
            expect(rounds).to.be.below(10);
        });
    });

    describe('_execute()', () => {

        it('returns 400 on invalid path', async () => {

            const server = Hapi.server();
            const res = await server.inject('invalid');
            expect(res.statusCode).to.equal(400);
        });

        it('returns boom response on ext error', async () => {

            const server = Hapi.server();

            const ext = (request) => {

                throw Boom.badRequest();
            };

            server.ext('onPostHandler', ext);
            server.route({ method: 'GET', path: '/', handler: () => 'OK' });

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(400);
        });

        it('returns error response on ext error', async () => {

            const server = Hapi.server();

            const ext = (request) => {

                throw new Error('oops');
            };

            server.ext('onPostHandler', ext);
            server.route({ method: 'GET', path: '/', handler: () => 'OK' });

            const res = await server.inject('/');
            expect(res.result.statusCode).to.equal(500);
        });

        it('handles aborted requests (during response)', async () => {

            const handler = (request) => {

                const TestStream = class extends Stream.Readable {

                    _read(size) {

                        if (this.isDone) {
                            return;
                        }

                        this.isDone = true;

                        this.push('success');
                        this.emit('data', 'success');
                    }
                };

                const stream = new TestStream();
                return stream;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            let disconnected = 0;
            const onRequest = (request, h) => {

                request.events.once('disconnect', () => {

                    ++disconnected;
                });

                return h.continue;
            };

            server.ext('onRequest', onRequest);

            await server.start();

            let total = 2;
            const createConnection = function () {

                const client = Net.connect(server.info.port, () => {

                    client.write('GET / HTTP/1.1\r\n\r\n');
                    client.write('GET / HTTP/1.1\r\n\r\n');
                });

                client.on('data', () => {

                    --total;
                    client.destroy();
                });
            };

            await new Promise((resolve) => {

                const check = function () {

                    if (total) {
                        createConnection();
                        setTimeout(check, 100);
                    }
                    else {
                        expect(disconnected).to.equal(4);       // Each connection sends two HTTP requests
                        resolve();
                    }
                };

                check();
            });

            await server.stop();
        });

        it('handles aborted requests (pre response)', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/test',
                handler: () => null
            });

            const team = new Teamwork();
            const onRequest = (request, h) => {

                request.events.once('disconnect', () => team.attend());
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const onPreHandler = (request, h) => {

                client.destroy();
                return h.continue;
            };

            server.ext('onPreHandler', onPreHandler);

            await server.start();

            const client = Net.connect(server.info.port, () => {

                client.write('GET /test HTTP/1.1\r\n\r\n');
                client.write('GET /test HTTP/1.1\r\n\r\n');
                client.write('GET /test HTTP/1.1\r\n\r\n');
            });

            await team.work;
            await server.stop();
        });

        it('returns empty params array when none present', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.params });

            const res = await server.inject('/');
            expect(res.result).to.equal({});
        });

        it('returns empty params array when none present (not found)', async () => {

            const server = Hapi.server();
            const preResponse = (request) => {

                return request.params;
            };

            server.ext('onPreResponse', preResponse);

            const res = await server.inject('/');
            expect(res.result).to.equal({});
        });

        it('does not fail on abort', async () => {

            const server = Hapi.server();
            const team = new Teamwork();

            const handler = async (request) => {

                clientRequest.abort();
                await Hoek.wait(10);
                team.attend();
                throw new Error('fail');
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

        it('does not fail on abort (onPreHandler)', async () => {

            const server = Hapi.server();
            const team = new Teamwork();

            server.route({ method: 'GET', path: '/', handler: () => null });

            const preHandler = async (request, h) => {

                clientRequest.abort();
                await Hoek.wait(10);
                team.attend();
                return h.continue;
            };

            server.ext('onPreHandler', preHandler);

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

        it('does not fail on abort with ext', async () => {

            const handler = async (request) => {

                clientRequest.abort();
                await Hoek.wait(10);
                throw new Error('boom');
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const preResponse = (request, h) => {

                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            const log = server.events.once('response');

            await server.start();

            const clientRequest = Http.request({
                hostname: 'localhost',
                port: server.info.port,
                method: 'GET'
            });

            clientRequest.on('error', Hoek.ignore);
            clientRequest.end();

            await log;
            await server.stop();
        });

        it('returns not found on internal only route (external)', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/some/route',
                options: {
                    isInternal: true,
                    handler: () => 'ok'
                }
            });

            await server.start();
            const err = await expect(Wreck.get('http://localhost:' + server.info.port)).to.reject();
            expect(err.data.res.statusCode).to.equal(404);
            expect(err.data.payload.toString()).to.equal('{"statusCode":404,"error":"Not Found","message":"Not Found"}');
            await server.stop();
        });

        it('returns not found on internal only route (inject)', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/some/route',
                options: {
                    isInternal: true,
                    handler: () => 'ok'
                }
            });

            const res = await server.inject('/some/route');
            expect(res.statusCode).to.equal(404);
        });

        it('allows internal only route (inject with allowInternals)', async () => {

            const server = Hapi.server();
            server.route({
                method: 'GET',
                path: '/some/route',
                options: {
                    isInternal: true,
                    handler: () => 'ok'
                }
            });

            const res = await server.inject({ url: '/some/route', allowInternals: true });
            expect(res.statusCode).to.equal(200);
        });
    });

    describe('_onRequest()', () => {

        it('errors on non-takeover response', async () => {

            const server = Hapi.server({ debug: false });
            server.ext('onRequest', () => 'something');
            server.route({ method: 'GET', path: '/', handler: () => null });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('_lifecycle()', () => {

        it('errors on non-takeover response in pre handler ext', async () => {

            const server = Hapi.server({ debug: false });
            server.ext('onPreHandler', () => 'something');
            server.route({ method: 'GET', path: '/', handler: () => null });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('_postCycle()', () => {

        it('skips onPreResponse when validation terminates request', async () => {

            const server = Hapi.server();
            const team = new Teamwork();

            let called = false;
            server.ext('onPreResponse', (request, h) => {

                called = true;
                return h.continue;
            });

            server.route({
                method: 'GET',
                path: '/',
                options: {
                    handler: () => null,
                    response: {
                        status: {
                            200: async () => {

                                req.abort();
                                await Hoek.wait(10);
                                team.attend();
                            }
                        }
                    }
                }
            });

            await server.start();

            const req = Http.get(server.info.uri, (res) => { });
            req.on('error', Hoek.ignore);

            await team.work;
            await Hoek.wait(100);
            await server.stop();

            expect(called).to.be.false();
        });
    });

    describe('_reply()', () => {

        it('returns a reply with auto end in onPreResponse', async () => {

            const server = Hapi.server();
            server.ext('onPreResponse', (request, h) => h.close);
            server.route({ method: 'GET', path: '/', handler: () => null });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('');
        });
    });

    describe('_finalize()', () => {

        it('generate response event', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });

            const log = server.events.once('response');
            await server.inject('/');
            const [request] = await log;
            expect(request.info.responded).to.be.min(request.info.received);
            expect(request.response.source).to.equal('ok');
            expect(request.response.statusCode).to.equal(200);
        });

        it('closes response after server timeout', async () => {

            const team = new Teamwork();
            const handler = async (request) => {

                await Hoek.wait(100);

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                stream.close = () => team.attend();
                return stream;
            };

            const server = Hapi.server({ routes: { timeout: { server: 50 } } });
            server.route({
                method: 'GET',
                path: '/',
                handler
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(503);
            await team.work;
        });

        it('does not attempt to close error response after server timeout', async () => {

            const handler = async (request) => {

                await Hoek.wait(10);
                throw new Error('after');
            };

            const server = Hapi.server({ routes: { timeout: { server: 5 } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(503);
        });

        it('emits request-error once', async () => {

            const server = Hapi.server({ debug: false, routes: { log: { collect: true } } });

            let errs = 0;
            let req = null;
            server.events.on({ name: 'request', channels: 'error' }, (request, { error }) => {

                errs++;
                expect(error).to.exist();
                expect(error.message).to.equal('boom2');
                req = request;
            });

            const preResponse = (request) => {

                throw new Error('boom2');
            };

            server.ext('onPreResponse', preResponse);

            const handler = (request) => {

                throw new Error('boom1');
            };

            server.route({ method: 'GET', path: '/', handler });

            const log = server.events.once('response');

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
            expect(res.result).to.exist();
            expect(res.result.message).to.equal('An internal server error occurred');

            await log;
            expect(errs).to.equal(1);
            expect(req.logs[1].tags).to.equal(['internal', 'error']);
        });

        it('does not emit request-error when error is replaced with valid response', async () => {

            const server = Hapi.server({ debug: false });

            let errs = 0;
            server.events.on({ name: 'request', channels: 'error' }, (request, event) => {

                errs++;
            });

            server.ext('onPreResponse', () => 'ok');

            const handler = (request) => {

                throw new Error('boom1');
            };

            server.route({ method: 'GET', path: '/', handler });

            const log = server.events.once('response');

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('ok');

            await log;
            expect(errs).to.equal(0);
        });
    });

    describe('setMethod()', () => {

        it('changes method with a lowercase version of the value passed in', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const onRequest = (request, h) => {

                request.setMethod('POST');
                return h.response(request.method).takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.payload).to.equal('post');
        });

        it('errors on missing method', async () => {

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler: () => null });
            server.ext('onRequest', (request) => request.setMethod());

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });

        it('errors on invalid method type', async () => {

            const server = Hapi.server({ debug: false });
            server.route({ method: 'GET', path: '/', handler: () => null });
            server.ext('onRequest', (request) => request.setMethod(42));

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(500);
        });
    });

    describe('setUrl()', () => {

        it('sets url, path, and query', async () => {

            const url = 'http://localhost/page?param1=something';
            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const onRequest = (request, h) => {

                request.setUrl(url);
                return h.response([request.url.href, request.path, request.query.param1].join('|')).takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.payload).to.equal(url + '|/page|something');
        });

        it('updates host info', async () => {

            const url = 'http://redirected:321/';
            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const onRequest = (request, h) => {

                const initialHost = request.info.host;

                request.setUrl(url);
                return h.response([request.url.href, request.path, initialHost, request.info.host, request.info.hostname].join('|')).takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject({ url: '/', headers: { host: 'initial:123' } });
            expect(res.payload).to.equal(url + '|/|initial:123|redirected:321|redirected');
        });

        it('updates host info when set without port number', async () => {

            const url = 'http://redirected/';
            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const onRequest = (request, h) => {

                const initialHost = request.info.host;

                request.setUrl(url);
                return h.response([request.url.href, request.path, initialHost, request.info.host, request.info.hostname].join('|')).takeover();
            };

            server.ext('onRequest', onRequest);

            const res1 = await server.inject({ url: '/', headers: { host: 'initial:123' } });
            const res2 = await server.inject({ url: '/', headers: { host: 'initial' } });
            expect(res1.payload).to.equal(url + '|/|initial:123|redirected|redirected');
            expect(res2.payload).to.equal(url + '|/|initial|redirected|redirected');
        });

        it('overrides query string parsing', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const onRequest = (request, h) => {

                const uri = request.raw.req.url;
                const parsed = Url.parse(uri, true);
                parsed.query.a = 2;
                request.setUrl(parsed);
                return h.response([request.url.href, request.path, request.query.a].join('|')).takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/?a=1');
            expect(res.payload).to.equal('/?a=1|/|2');
        });

        it('normalizes a path', async () => {

            const rawPath = '/%0%1%2%3%4%5%6%7%8%9%a%b%c%d%e%f%10%11%12%13%14%15%16%17%18%19%1a%1b%1c%1d%1e%1f%20%21%22%23%24%25%26%27%28%29%2a%2b%2c%2d%2e%2f%30%31%32%33%34%35%36%37%38%39%3a%3b%3c%3d%3e%3f%40%41%42%43%44%45%46%47%48%49%4a%4b%4c%4d%4e%4f%50%51%52%53%54%55%56%57%58%59%5a%5b%5c%5d%5e%5f%60%61%62%63%64%65%66%67%68%69%6a%6b%6c%6d%6e%6f%70%71%72%73%74%75%76%77%78%79%7a%7b%7c%7d%7e%7f%80%81%82%83%84%85%86%87%88%89%8a%8b%8c%8d%8e%8f%90%91%92%93%94%95%96%97%98%99%9a%9b%9c%9d%9e%9f%a0%a1%a2%a3%a4%a5%a6%a7%a8%a9%aa%ab%ac%ad%ae%af%b0%b1%b2%b3%b4%b5%b6%b7%b8%b9%ba%bb%bc%bd%be%bf%c0%c1%c2%c3%c4%c5%c6%c7%c8%c9%ca%cb%cc%cd%ce%cf%d0%d1%d2%d3%d4%d5%d6%d7%d8%d9%da%db%dc%dd%de%df%e0%e1%e2%e3%e4%e5%e6%e7%e8%e9%ea%eb%ec%ed%ee%ef%f0%f1%f2%f3%f4%f5%f6%f7%f8%f9%fa%fb%fc%fd%fe%ff%0%1%2%3%4%5%6%7%8%9%A%B%C%D%E%F%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20%21%22%23%24%25%26%27%28%29%2A%2B%2C%2D%2E%2F%30%31%32%33%34%35%36%37%38%39%3A%3B%3C%3D%3E%3F%40%41%42%43%44%45%46%47%48%49%4A%4B%4C%4D%4E%4F%50%51%52%53%54%55%56%57%58%59%5A%5B%5C%5D%5E%5F%60%61%62%63%64%65%66%67%68%69%6A%6B%6C%6D%6E%6F%70%71%72%73%74%75%76%77%78%79%7A%7B%7C%7D%7E%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF';
            const normPath = '/%0%1%2%3%4%5%6%7%8%9%a%b%c%d%e%f%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20!%22%23$%25&\'()*+,-.%2F0123456789:;%3C=%3E%3F@ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF%0%1%2%3%4%5%6%7%8%9%A%B%C%D%E%F%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20!%22%23$%25&\'()*+,-.%2F0123456789:;%3C=%3E%3F@ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF';

            const url = 'http://localhost' + rawPath + '?param1=something';
            const normUrl = 'http://localhost' + normPath + '?param1=something';

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const onRequest = (request, h) => {

                request.setUrl(url);
                return h.response([request.url.href, request.path, request.query.param1].join('|')).takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.payload).to.equal(normUrl + '|' + normPath + '|something');
        });

        it('allows missing path', async () => {

            const server = Hapi.server();
            const onRequest = (request, h) => {

                request.setUrl('');
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(400);
        });

        it('strips trailing slash', async () => {

            const server = Hapi.server({ router: { stripTrailingSlash: true } });
            server.route({ method: 'GET', path: '/test', handler: () => null });
            const res = await server.inject('/test/');
            expect(res.statusCode).to.equal(200);
        });

        it('does not strip trailing slash on /', async () => {

            const server = Hapi.server({ router: { stripTrailingSlash: true } });
            server.route({ method: 'GET', path: '/', handler: () => null });
            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('strips trailing slash with query', async () => {

            const server = Hapi.server({ router: { stripTrailingSlash: true } });
            server.route({ method: 'GET', path: '/test', handler: () => null });
            const res = await server.inject('/test/?a=b');
            expect(res.statusCode).to.equal(200);
        });

        it('clones passed url', async () => {

            const urlObject = {
                protocol: 'http:',
                pathname: '/%41'
            };
            const passedUrl = Hoek.clone(urlObject);
            let requestUrl;

            const server = Hapi.server();
            const onRequest = (request, h) => {

                request.setUrl(passedUrl);
                requestUrl = request.url;

                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(404);
            expect(passedUrl).to.equal(urlObject);
            expect(requestUrl).to.not.shallow.equal(passedUrl);
            expect(requestUrl).to.not.equal(urlObject);
        });

        it('handles vhost redirection', async () => {

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', vhost: 'one', handler: () => 'success' });

            const onRequest = (request, h) => {

                request.setUrl('http://one/');
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('success');
        });

        it('handles hostname in HTTP request resource', async () => {

            const server = Hapi.server({ debug: false });

            let hostname;
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => {

                    hostname = request.info.hostname;
                    return null;
                }
            });

            await server.start();
            const socket = Net.createConnection(server.info.port, '127.0.0.1', () => socket.write('GET http://host.com\r\n\r\n'));
            await Hoek.wait(10);
            socket.destroy();
            await server.stop();
            expect(hostname).to.equal('host.com');
        });
    });

    describe('_tap()', () => {

        it('listens to request payload read finish', async () => {

            let finish;
            const ext = (request, h) => {

                finish = request.events.once('finish');
                return h.continue;
            };

            const server = Hapi.server();
            server.ext('onRequest', ext);
            server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { parse: false } } });

            const payload = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
            await server.inject({ method: 'POST', url: '/', payload });
            await finish;
        });

        it('ignores emitter when created for other events', async () => {

            const ext = (request, h) => {

                request.events;
                return h.continue;
            };

            const server = Hapi.server();
            server.ext('onRequest', ext);
            server.route({ method: 'POST', path: '/', options: { handler: () => null, payload: { parse: false } } });

            const payload = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
            await server.inject({ method: 'POST', url: '/', payload });
        });
    });

    describe('log()', () => {

        it('outputs log data to debug console', async () => {

            const handler = (request) => {

                request.log(['implementation'], 'data');
                return null;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function (...args) {

                    expect(args[0]).to.equal('Debug:');
                    expect(args[1]).to.equal('implementation');
                    expect(args[2]).to.equal('\n    data');
                    console.error = orig;
                    resolve();
                };
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            await log;
        });

        it('emits a request event', async () => {

            const server = Hapi.server();

            const handler = async (request) => {

                const log = server.events.once({ name: 'request', channels: 'app' });
                request.log(['test'], 'data');
                const [, event, tags] = await log;
                expect(event).to.contain(['request', 'timestamp', 'tags', 'data', 'channel']);
                expect(event.data).to.equal('data');
                expect(event.channel).to.equal('app');
                expect(tags).to.equal({ test: true });
                return null;
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('emits a request event (function data + collect)', async () => {

            const server = Hapi.server({ routes: { log: { collect: true } } });

            const handler = async (request) => {

                const log = server.events.once('request');
                request.log(['test'], () => 'data');

                const [, event, tags] = await log;
                expect(event).to.contain(['request', 'timestamp', 'tags', 'data', 'channel']);
                expect(event.data).to.equal('data');
                expect(event.channel).to.equal('app');
                expect(tags).to.equal({ test: true });
                expect(request.logs[0].data).to.equal('data');
                return null;
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('emits a request event (function data)', async () => {

            const server = Hapi.server();

            const handler = async (request) => {

                const log = server.events.once('request');
                request.log(['test'], () => 'data');

                const [, event, tags] = await log;
                expect(event).to.contain(['request', 'timestamp', 'tags', 'data', 'channel']);
                expect(event.data).to.equal('data');
                expect(event.channel).to.equal('app');
                expect(tags).to.equal({ test: true });
                return null;
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
        });

        it('outputs log to debug console without data', async () => {

            const handler = (request) => {

                request.log(['implementation']);
                return null;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function (...args) {

                    expect(args[0]).to.equal('Debug:');
                    expect(args[1]).to.equal('implementation');
                    expect(args[2]).to.equal('');
                    console.error = orig;
                    resolve();
                };
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            await log;
        });

        it('outputs log to debug console with error data', async () => {

            const handler = (request) => {

                request.log(['implementation'], new Error('boom'));
                return null;
            };

            const server = Hapi.server();
            server.route({ method: 'GET', path: '/', handler });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function (...args) {

                    expect(args[0]).to.equal('Debug:');
                    expect(args[1]).to.equal('implementation');
                    expect(args[2]).to.contain('Error: boom');
                    console.error = orig;
                    resolve();
                };
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            await log;
        });

        it('handles invalid log data object stringify', async () => {

            const handler = (request) => {

                const obj = {};
                obj.a = obj;

                request.log(['implementation'], obj);
                return null;
            };

            const server = Hapi.server({ routes: { log: { collect: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const log = new Promise((resolve) => {

                const orig = console.error;
                console.error = function (...args) {

                    expect(args[0]).to.equal('Debug:');
                    expect(args[1]).to.equal('implementation');
                    expect(args[2]).to.equal('\n    [Cannot display object: Converting circular structure to JSON]');
                    console.error = orig;
                    resolve();
                };
            });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            await log;
        });

        it('adds a log event to the request', async () => {

            const handler = (request) => {

                request.log('1', 'log event 1');
                request.log(['2'], 'log event 2');
                request.log(['3', '4']);
                request.log(['1', '4']);
                request.log(['2', '3']);
                request.log(['4']);
                request.log('4');

                return request.logs.map((event) => event.tags).join('|');
            };

            const server = Hapi.server({ routes: { log: { collect: true } } });
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.payload).to.equal('1|2|3,4|1,4|2,3|4|4');
        });

        it('does not output events when debug disabled', async () => {

            const server = Hapi.server({ debug: false });

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            const handler = (request) => {

                request.log(['implementation']);
                return null;
            };

            server.route({ method: 'GET', path: '/', handler });

            await server.inject('/');
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
        });

        it('does not output events when debug.request disabled', async () => {

            const server = Hapi.server({ debug: { request: false } });

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            const handler = (request) => {

                request.log(['implementation']);
                return null;
            };

            server.route({ method: 'GET', path: '/', handler });

            await server.inject('/');
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
        });

        it('does not output non-implementation events by default', async () => {

            const server = Hapi.server();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            const handler = (request) => {

                request.log(['xyz']);
                return null;
            };

            server.route({ method: 'GET', path: '/', handler });

            await server.inject('/');
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
        });
    });

    describe('_setResponse()', () => {

        it('leaves the response open when the same response is set again', async () => {

            const server = Hapi.server();
            const postHandler = (request) => {

                return request.response;
            };

            server.ext('onPostHandler', postHandler);

            const handler = (request) => {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                return stream;
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('value');
        });

        it('leaves the response open when the same response source is set again', async () => {

            const server = Hapi.server();
            server.ext('onPostHandler', (request) => request.response.source);

            const handler = (request) => {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                return stream;
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.result).to.equal('value');
        });
    });

    describe('timeout', () => {

        it('returns server error message when server taking too long', async () => {

            const handler = async (request) => {

                await Hoek.wait(100);
                return 'too slow';
            };

            const server = Hapi.server({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/timeout', handler });

            const timer = new Hoek.Bench();

            const res = await server.inject('/timeout');
            expect(res.statusCode).to.equal(503);
            expect(timer.elapsed()).to.be.at.least(49);
        });

        it('returns server error message when server timeout happens during request execution (and handler yields)', async () => {

            const handler = async (request) => {

                await Hoek.wait(20);
                return null;
            };

            const server = Hapi.server({ routes: { timeout: { server: 10 } } });
            server.route({ method: 'GET', path: '/', options: { handler } });

            const postHandler = (request, h) => {

                return h.continue;
            };

            server.ext('onPostHandler', postHandler);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(503);
        });

        it('returns server error message when server timeout is short and already occurs when request executes', async () => {

            const server = Hapi.server({ routes: { timeout: { server: 2 } } });
            server.route({ method: 'GET', path: '/', options: { handler: function () { } } });
            const onRequest = async (request, h) => {

                await Hoek.wait(10);
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(503);
        });

        it('handles server handler timeout with onPreResponse ext', async () => {

            const handler = async (request) => {

                await Hoek.wait(20);
                return null;
            };

            const server = Hapi.server({ routes: { timeout: { server: 10 } } });
            server.route({ method: 'GET', path: '/', options: { handler } });
            const preResponse = (request, h) => {

                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(503);
        });

        it('does not return an error response when server is slow but faster than timeout', async () => {

            const slowHandler = async (request) => {

                await Hoek.wait(30);
                return 'slow';
            };

            const server = Hapi.server({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/slow', options: { handler: slowHandler } });

            const timer = new Hoek.Bench();
            const res = await server.inject('/slow');
            expect(timer.elapsed()).to.be.at.least(20);
            expect(res.statusCode).to.equal(200);
        });

        it('does not return an error when server is responding when the timeout occurs', async () => {

            let ended = false;
            const TestStream = class extends Stream.Readable {

                _read(size) {

                    if (this.isDone) {
                        return;
                    }

                    this.isDone = true;
                    this.push('Hello');

                    setTimeout(() => {

                        this.push(null);
                        ended = true;
                    }, 150);
                }
            };

            const handler = (request) => {

                return new TestStream();
            };

            const timer = new Hoek.Bench();

            const server = Hapi.server({ routes: { timeout: { server: 100 } } });
            server.route({ method: 'GET', path: '/', handler });
            await server.start();
            const { res } = await Wreck.get('http://localhost:' + server.info.port);
            expect(ended).to.be.true();
            expect(timer.elapsed()).to.be.at.least(150);
            expect(res.statusCode).to.equal(200);
            await server.stop({ timeout: 1 });
        });

        it('does not return an error response when server is slower than timeout but response has started', async () => {

            const streamHandler = (request) => {

                const TestStream = class extends Stream.Readable {

                    _read(size) {

                        if (this.isDone) {
                            return;
                        }

                        this.isDone = true;

                        setTimeout(() => {

                            this.push('Hello');
                        }, 30);

                        setTimeout(() => {

                            this.push(null);
                        }, 60);
                    }
                };

                return new TestStream();
            };

            const server = Hapi.server({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/stream', options: { handler: streamHandler } });

            await server.start();
            const { res } = await Wreck.get(`http://localhost:${server.info.port}/stream`);
            expect(res.statusCode).to.equal(200);
            await server.stop({ timeout: 1 });
        });

        it('does not return an error response when server takes less than timeout to respond', async () => {

            const server = Hapi.server({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/fast', handler: () => 'Fast' });

            const res = await server.inject('/fast');
            expect(res.statusCode).to.equal(200);
        });

        it('handles race condition between equal client and server timeouts', async () => {

            const server = Hapi.server({ routes: { timeout: { server: 50 }, payload: { timeout: 50 } } });
            server.route({ method: 'POST', path: '/timeout', options: { handler: Hoek.block } });

            await server.start();

            const timer = new Hoek.Bench();
            const options = {
                hostname: '127.0.0.1',
                port: server.info.port,
                path: '/timeout',
                method: 'POST'
            };

            await new Promise(async (resolve) => {

                const req = Http.request(options, (res) => {

                    expect([503, 408]).to.contain(res.statusCode);
                    expect(timer.elapsed()).to.be.at.least(45);
                    resolve();
                });

                req.on('error', (err) => {

                    expect(err).to.not.exist();
                });

                req.write('\n');
                await Hoek.wait(100);
                req.end();
            });

            await server.stop({ timeout: 1 });
        });
    });
});
