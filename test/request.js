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
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Request.Generator', () => {

    it('decorates request multiple times', (done) => {

        const server = new Hapi.Server();
        server.connection();

        server.decorate('request', 'x2', () => 2);
        server.decorate('request', 'abc', () => 1);

        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply(request.x2() + request.abc());
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(3);
            done();
        });
    });

    it('decorates request with non function method', (done) => {

        const server = new Hapi.Server();
        server.connection();

        server.decorate('request', 'x2', 2);
        server.decorate('request', 'abc', 1);

        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                return reply(request.x2 + request.abc);
            }
        });

        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(3);
            done();
        });
    });
});

describe('Request', () => {

    it('sets client address', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const handler = function (request, reply) {

            let expectedClientAddress = '127.0.0.1';
            if (Net.isIPv6(server.listener.address().address)) {
                expectedClientAddress = '::ffff:127.0.0.1';
            }

            expect(request.info.remoteAddress).to.equal(expectedClientAddress);
            expect(request.info.remoteAddress).to.equal(request.info.remoteAddress);
            return reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.start((err) => {

            expect(err).to.not.exist();

            Wreck.get('http://localhost:' + server.info.port, (err, res, body) => {

                expect(err).to.not.exist();
                expect(body.toString()).to.equal('ok');
                server.stop(done);
            });
        });
    });

    it('sets referrer', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const handler = function (request, reply) {

            expect(request.info.referrer).to.equal('http://site.com');
            return reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { referrer: 'http://site.com' } }, (res) => {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('sets referer', (done) => {

        const server = new Hapi.Server();
        server.connection();

        const handler = function (request, reply) {

            expect(request.info.referrer).to.equal('http://site.com');
            return reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { referer: 'http://site.com' } }, (res) => {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('sets headers', (done) => {

        const handler = function (request, reply) {

            return reply(request.headers['user-agent']);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', (res) => {

            expect(res.payload).to.equal('shot');
            done();
        });
    });

    it('generates unique request id', (done) => {

        const handler = function (request, reply) {

            return reply(request.id);
        };

        const server = new Hapi.Server();
        server.connection();
        server.connections[0]._requestCounter = { value: 10, min: 10, max: 11 };
        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res1) => {

            server.inject('/', (res2) => {

                server.inject('/', (res3) => {

                    expect(res1.result).to.match(/10$/);
                    expect(res2.result).to.match(/11$/);
                    expect(res3.result).to.match(/10$/);
                    done();
                });
            });
        });
    });

    describe('_execute()', () => {

        it('returns 400 on invalid path', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.inject('invalid', (res) => {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('returns error response on ext error', (done) => {

            const handler = function (request, reply) {

                return reply('OK');
            };

            const server = new Hapi.Server();
            server.connection();

            const ext = function (request, reply) {

                return reply(Boom.badRequest());
            };

            server.ext('onPostHandler', ext);
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result.statusCode).to.equal(400);
                done();
            });
        });

        it('handles aborted requests', { parallel: false }, (done) => {

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
                    this.emit('data', 'success');
                };

                const stream = new TestStream();
                return reply(stream);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            let disconnected = 0;
            const onRequest = function (request, reply) {

                request.once('disconnect', () => {

                    ++disconnected;
                });

                return reply.continue();
            };

            server.ext('onRequest', onRequest);

            server.start((err) => {

                expect(err).to.not.exist();

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

                const check = function () {

                    if (total) {
                        createConnection();
                        setTimeout(check, 10);
                    }
                    else {
                        expect(disconnected).to.equal(4);       // Each connection sents two HTTP requests
                        server.stop(done);
                    }
                };

                check();
            });
        });

        it('returns empty params array when none present', (done) => {

            const handler = function (request, reply) {

                return reply(request.params);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal({});
                done();
            });
        });

        it('returns empty params array when none present (not found)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const preResponse = function (request, reply) {

                return reply(request.params);
            };

            server.ext('onPreResponse', preResponse);

            server.inject('/', (res) => {

                expect(res.result).to.equal({});
                done();
            });
        });

        it('does not fail on abort', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let clientRequest;
            const handler = function (request, reply) {

                clientRequest.abort();

                setTimeout(() => {

                    reply(new Error('fail'));
                    setTimeout(() => {

                        server.stop(done);
                    }, 10);
                }, 10);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.start((err) => {

                expect(err).to.not.exist();

                clientRequest = Http.request({
                    hostname: 'localhost',
                    port: server.info.port,
                    method: 'GET'
                });

                clientRequest.on('error', Hoek.ignore);
                clientRequest.end();
            });
        });

        it('does not fail on abort (onPreHandler)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: Hoek.ignore });

            let clientRequest;
            const preHandler = function (request, reply) {

                clientRequest.abort();
                setTimeout(() => {

                    reply.continue();
                    setTimeout(() => {

                        server.stop(done);
                    }, 10);
                }, 10);
            };

            server.ext('onPreHandler', preHandler);

            server.start((err) => {

                expect(err).to.not.exist();

                clientRequest = Http.request({
                    hostname: 'localhost',
                    port: server.info.port,
                    method: 'GET'
                });

                clientRequest.on('error', Hoek.ignore);
                clientRequest.end();
            });
        });

        it('does not fail on abort with ext', (done) => {

            let clientRequest;

            const handler = function (request, reply) {

                clientRequest.abort();
                setTimeout(() => {

                    return reply(new Error('boom'));
                }, 10);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            const preResponse = function (request, reply) {

                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.on('tail', () => {

                server.stop(done);
            });

            server.start((err) => {

                expect(err).to.not.exist();

                clientRequest = Http.request({
                    hostname: 'localhost',
                    port: server.info.port,
                    method: 'GET'
                });

                clientRequest.on('error', Hoek.ignore);
                clientRequest.end();
            });
        });

        it('returns not found on internal only route (external)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/some/route',
                config: {
                    isInternal: true,
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                }
            });

            server.start((err) => {

                expect(err).to.not.exist();
                Wreck.get('http://localhost:' + server.info.port, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(res.statusCode).to.equal(404);
                    expect(body.toString()).to.equal('{"statusCode":404,"error":"Not Found"}');
                    server.stop(done);
                });
            });
        });

        it('returns not found on internal only route (inject)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/some/route',
                config: {
                    isInternal: true,
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                }
            });

            server.inject('/some/route', (res) => {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('allows internal only route (inject with allowInternals)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'GET',
                path: '/some/route',
                config: {
                    isInternal: true,
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                }
            });

            server.inject({ url: '/some/route', allowInternals: true }, (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    describe('_finalize()', (done) => {

        it('generate response event', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.once('response', (request) => {

                expect(request.info.responded).to.be.min(request.info.received);
                done();
            });

            server.inject('/', (res) => { });
        });

        it('closes response after server timeout', (done) => {

            const handler = function (request, reply) {

                setTimeout(() => {

                    const stream = new Stream.Readable();
                    stream._read = function (size) {

                        this.push('value');
                        this.push(null);
                    };

                    stream.close = function () {

                        done();
                    };

                    return reply(stream);
                }, 100);
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 50 } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: handler
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(503);
            });
        });

        it('does not attempt to close error response after server timeout', (done) => {

            const handler = function (request, reply) {

                setTimeout(() => {

                    return reply(new Error('after'));
                }, 10);
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 5 } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: handler
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('emits request-error once', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            let errs = 0;
            let req = null;
            server.on('request-error', (request, err) => {

                errs++;
                expect(err).to.exist();
                expect(err.message).to.equal('boom2');
                req = request;
            });

            const preResponse = function (request, reply) {

                return reply(new Error('boom2'));
            };

            server.ext('onPreResponse', preResponse);

            const handler = function (request, reply) {

                return reply(new Error('boom1'));
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
                expect(res.result.message).to.equal('An internal server error occurred');
            });

            server.once('response', () => {

                expect(errs).to.equal(1);
                expect(req.getLog('error')[1].tags).to.equal(['internal', 'error']);
                done();
            });
        });

        it('emits request-error on implementation error', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            let errs = 0;
            let req = null;
            server.on('request-error', (request, err) => {

                ++errs;
                expect(err).to.exist();
                expect(err.message).to.equal('Uncaught error: boom');
                req = request;
            });

            const handler = function (request, reply) {

                throw new Error('boom');
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.once('response', () => {

                expect(errs).to.equal(1);
                expect(req.getLog('error')[0].tags).to.equal(['internal', 'implementation', 'error']);
                done();
            });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
                expect(res.result.message).to.equal('An internal server error occurred');
            });
        });

        it('does not emit request-error when error is replaced with valid response', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            let errs = 0;
            server.on('request-error', (request, err) => {

                errs++;
            });

            const preResponse = function (request, reply) {

                return reply('ok');
            };

            server.ext('onPreResponse', preResponse);

            const handler = function (request, reply) {

                return reply(new Error('boom1'));
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('ok');
            });

            server.once('response', () => {

                expect(errs).to.equal(0);
                done();
            });
        });
    });

    describe('tail()', () => {

        it('generates tail event', (done) => {

            const handler = function (request, reply) {

                const t1 = request.addTail('t1');
                const t2 = request.addTail('t2');

                reply('Done');

                t1();
                t1();                           // Ignored
                setTimeout(t2, 10);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            let result = null;

            server.once('tail', () => {

                expect(result).to.equal('Done');
                done();
            });

            server.inject('/', (res) => {

                result = res.result;
            });
        });

        it('generates tail event without name', (done) => {

            const handler = function (request, reply) {

                const tail = request.tail();
                reply('Done');
                tail();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.once('tail', () => {

                done();
            });

            server.inject('/', (res) => {

            });
        });
    });

    describe('setMethod()', () => {

        it('changes method with a lowercase version of the value passed in', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            const onRequest = function (request, reply) {

                request.setMethod('POST');
                return reply(request.method);
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.payload).to.equal('post');
                done();
            });
        });

        it('errors on missing method', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            const onRequest = function (request, reply) {

                request.setMethod();
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('errors on invalid method type', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            const onRequest = function (request, reply) {

                request.setMethod(42);
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('setUrl()', () => {

        it('sets url, path, and query', (done) => {

            const url = 'http://localhost/page?param1=something';
            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            const onRequest = function (request, reply) {

                request.setUrl(url);
                return reply([request.url.href, request.path, request.query.param1].join('|'));
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.payload).to.equal(url + '|/page|something');
                done();
            });
        });

        it('overrides query string parsing', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            const onRequest = function (request, reply) {

                const uri = request.raw.req.url;
                const parsed = Url.parse(uri, true);
                parsed.query.a = 2;
                request.setUrl(parsed);
                return reply([request.url.href, request.path, request.query.a].join('|'));
            };

            server.ext('onRequest', onRequest);

            server.inject('/?a=1', (res) => {

                expect(res.payload).to.equal('/?a=1|/|2');
                done();
            });
        });

        it('normalizes a path', (done) => {

            const rawPath = '/%0%1%2%3%4%5%6%7%8%9%a%b%c%d%e%f%10%11%12%13%14%15%16%17%18%19%1a%1b%1c%1d%1e%1f%20%21%22%23%24%25%26%27%28%29%2a%2b%2c%2d%2e%2f%30%31%32%33%34%35%36%37%38%39%3a%3b%3c%3d%3e%3f%40%41%42%43%44%45%46%47%48%49%4a%4b%4c%4d%4e%4f%50%51%52%53%54%55%56%57%58%59%5a%5b%5c%5d%5e%5f%60%61%62%63%64%65%66%67%68%69%6a%6b%6c%6d%6e%6f%70%71%72%73%74%75%76%77%78%79%7a%7b%7c%7d%7e%7f%80%81%82%83%84%85%86%87%88%89%8a%8b%8c%8d%8e%8f%90%91%92%93%94%95%96%97%98%99%9a%9b%9c%9d%9e%9f%a0%a1%a2%a3%a4%a5%a6%a7%a8%a9%aa%ab%ac%ad%ae%af%b0%b1%b2%b3%b4%b5%b6%b7%b8%b9%ba%bb%bc%bd%be%bf%c0%c1%c2%c3%c4%c5%c6%c7%c8%c9%ca%cb%cc%cd%ce%cf%d0%d1%d2%d3%d4%d5%d6%d7%d8%d9%da%db%dc%dd%de%df%e0%e1%e2%e3%e4%e5%e6%e7%e8%e9%ea%eb%ec%ed%ee%ef%f0%f1%f2%f3%f4%f5%f6%f7%f8%f9%fa%fb%fc%fd%fe%ff%0%1%2%3%4%5%6%7%8%9%A%B%C%D%E%F%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20%21%22%23%24%25%26%27%28%29%2A%2B%2C%2D%2E%2F%30%31%32%33%34%35%36%37%38%39%3A%3B%3C%3D%3E%3F%40%41%42%43%44%45%46%47%48%49%4A%4B%4C%4D%4E%4F%50%51%52%53%54%55%56%57%58%59%5A%5B%5C%5D%5E%5F%60%61%62%63%64%65%66%67%68%69%6A%6B%6C%6D%6E%6F%70%71%72%73%74%75%76%77%78%79%7A%7B%7C%7D%7E%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF';
            const normPath = '/%0%1%2%3%4%5%6%7%8%9%a%b%c%d%e%f%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20!%22%23$%25&\'()*+,-.%2F0123456789:;%3C=%3E%3F@ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF%0%1%2%3%4%5%6%7%8%9%A%B%C%D%E%F%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20!%22%23$%25&\'()*+,-.%2F0123456789:;%3C=%3E%3F@ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF';

            const url = 'http://localhost' + rawPath + '?param1=something';

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            const onRequest = function (request, reply) {

                request.setUrl(url);
                return reply([request.url.href, request.path, request.query.param1].join('|'));
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.payload).to.equal(url + '|' + normPath + '|something');
                done();
            });
        });

        it('allows missing path', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const onRequest = function (request, reply) {

                request.setUrl('');
                return reply.continue();
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('strips trailing slash', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection({ router: { stripTrailingSlash: true } });
            server.route({ method: 'GET', path: '/test', handler: handler });
            server.inject('/test/', (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('does not strip trailing slash on /', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection({ router: { stripTrailingSlash: true } });
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('strips trailing slash with query', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection({ router: { stripTrailingSlash: true } });
            server.route({ method: 'GET', path: '/test', handler: handler });
            server.inject('/test/?a=b', (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    describe('log()', { parallel: false }, () => {

        it('outputs log data to debug console', (done) => {

            const handler = function (request, reply) {

                request.log(['implementation'], 'data');
                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            const orig = console.error;
            console.error = function () {

                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    data');
                console.error = orig;
                done();
            };

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('emits a request event', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                server.on('request', (req, event, tags) => {

                    expect(event).to.contain(['request', 'timestamp', 'tags', 'data', 'internal']);
                    expect(event.data).to.equal('data');
                    expect(event.internal).to.be.false();
                    expect(tags).to.equal({ test: true });
                    return reply();
                });

                request.log(['test'], 'data');
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('outputs log to debug console without data', (done) => {

            const handler = function (request, reply) {

                request.log(['implementation']);
                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            const orig = console.error;
            console.error = function () {

                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('');
                console.error = orig;
                done();
            };

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('outputs log to debug console with error data', (done) => {

            const handler = function (request, reply) {

                request.log(['implementation'], new Error('boom'));
                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            const orig = console.error;
            console.error = function () {

                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.contain('Error: boom');
                console.error = orig;
                done();
            };

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('handles invalid log data object stringify', (done) => {

            const handler = function (request, reply) {

                const obj = {};
                obj.a = obj;

                request.log(['implementation'], obj);
                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            const orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    [Cannot display object: Converting circular structure to JSON]');
                done();
            };

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('adds a log event to the request', (done) => {

            const handler = function (request, reply) {

                request.log('1', 'log event 1', Date.now());
                request.log(['2'], 'log event 2', new Date(Date.now()));
                request.log(['3', '4']);
                request.log(['1', '4']);
                request.log(['2', '3']);
                request.log(['4']);
                request.log('4');

                return reply([request.getLog('1').length, request.getLog('4').length, request.getLog(['4']).length, request.getLog('0').length, request.getLog(['1', '2', '3', '4']).length, request.getLog().length >= 7].join('|'));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('2|4|4|0|7|true');
                done();
            });
        });

        it('does not output events when debug disabled', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            const handler = function (request, reply) {

                request.log(['implementation']);
                return reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                console.error('nothing');
                expect(i).to.equal(1);
                console.error = orig;
                done();
            });
        });

        it('does not output events when debug.request disabled', (done) => {

            const server = new Hapi.Server({ debug: { request: false } });
            server.connection();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            const handler = function (request, reply) {

                request.log(['implementation']);
                return reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                console.error('nothing');
                expect(i).to.equal(1);
                console.error = orig;
                done();
            });
        });

        it('does not output non-implementation events by default', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let i = 0;
            const orig = console.error;
            console.error = function () {

                ++i;
            };

            const handler = function (request, reply) {

                request.log(['xyz']);
                return reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                console.error('nothing');
                expect(i).to.equal(1);
                console.error = orig;
                done();
            });
        });
    });

    describe('_log()', { parallel: false }, () => {

        it('emits a request-internal event', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.once('request-internal', (request, event, tags) => {

                expect(tags.received).to.be.true();
                done();
            });

            server.inject('/', (res) => { });
        });
    });

    describe('getLog()', () => {

        it('returns the selected logs', (done) => {

            const handler = function (request, reply) {

                request._log('1');
                request.log('1');

                return reply([request.getLog('1').length, request.getLog('1', true).length, request.getLog('1', false).length, request.getLog(true).length, request.getLog(false).length, request.getLog().length].join('|'));
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.payload).to.equal('2|1|1|2|1|3');
                done();
            });
        });
    });

    describe('_setResponse()', () => {

        it('leaves the response open when the same response is set again', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const postHandler = function (request, reply) {

                return reply(request.response);
            };

            server.ext('onPostHandler', postHandler);

            const handler = function (request, reply) {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('value');
                done();
            });
        });

        it('leaves the response open when the same response source is set again', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const postHandler = function (request, reply) {

                return reply(request.response.source);
            };

            server.ext('onPostHandler', postHandler);

            const handler = function (request, reply) {

                const stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                return reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('value');
                done();
            });
        });
    });

    describe('timeout', { parallel: false }, () => {

        it('returns server error message when server taking too long', (done) => {

            const timeoutHandler = function (request, reply) { };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/timeout', config: { handler: timeoutHandler } });

            const timer = new Hoek.Bench();

            server.inject('/timeout', (res) => {

                expect(res.statusCode).to.equal(503);
                expect(timer.elapsed()).to.be.at.least(45);
                done();
            });
        });

        it('returns server error message when server timeout happens during request execution (and handler yields)', (done) => {

            const handler = function (request, reply) {

                setTimeout(() => {

                    return reply();
                }, 20);
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 10 } } });
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const postHandler = function (request, reply) {

                return reply.continue();
            };

            server.ext('onPostHandler', postHandler);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('returns server error message when server timeout is short and already occurs when request executes', (done) => {

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 2 } } });
            server.route({ method: 'GET', path: '/', config: { handler: function () { } } });
            const onRequest = function (request, reply) {

                setTimeout(() => {

                    return reply.continue();
                }, 10);
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('handles server handler timeout with onPreResponse ext', (done) => {

            const handler = function (request, reply) {

                setTimeout(reply, 20);
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 10 } } });
            server.route({ method: 'GET', path: '/', config: { handler: handler } });
            const preResponse = function (request, reply) {

                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('does not return an error response when server is slow but faster than timeout', (done) => {

            const slowHandler = function (request, reply) {

                setTimeout(() => {

                    return reply('Slow');
                }, 30);
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/slow', config: { handler: slowHandler } });

            const timer = new Hoek.Bench();
            server.inject('/slow', (res) => {

                expect(timer.elapsed()).to.be.at.least(20);
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('does not return an error when server is responding when the timeout occurs', (done) => {

            const TestStream = function () {

                Stream.Readable.call(this);
            };

            Hoek.inherits(TestStream, Stream.Readable);

            let ended = false;
            TestStream.prototype._read = function (size) {

                if (this.isDone) {
                    return;
                }

                this.isDone = true;
                this.push('Hello');

                setTimeout(() => {

                    this.push(null);
                    ended = true;
                }, 150);
            };

            const handler = function (request, reply) {

                return reply(new TestStream());
            };

            const timer = new Hoek.Bench();

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 100 } } });
            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();
                Wreck.get('http://localhost:' + server.info.port, (err, res, payload) => {

                    expect(err).to.not.exist();
                    expect(ended).to.be.true();
                    expect(timer.elapsed()).to.be.at.least(150);
                    expect(res.statusCode).to.equal(200);
                    server.stop({ timeout: 1 }, done);
                });
            });
        });

        it('does not return an error response when server is slower than timeout but response has started', (done) => {

            const streamHandler = function (request, reply) {

                const TestStream = function () {

                    Stream.Readable.call(this);
                };

                Hoek.inherits(TestStream, Stream.Readable);

                TestStream.prototype._read = function (size) {

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
                };

                return reply(new TestStream());
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/stream', config: { handler: streamHandler } });
            server.start((err) => {

                expect(err).to.not.exist();

                const options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/stream',
                    method: 'GET'
                };

                const req = Http.request(options, (res) => {

                    expect(res.statusCode).to.equal(200);
                    server.stop({ timeout: 1 }, done);
                });
                req.end();
            });
        });

        it('does not return an error response when server takes less than timeout to respond', (done) => {

            const fastHandler = function (request, reply) {

                return reply('Fast');
            };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 50 } } });
            server.route({ method: 'GET', path: '/fast', config: { handler: fastHandler } });

            server.inject('/fast', (res) => {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('handles race condition between equal client and server timeouts', (done) => {

            const timeoutHandler = function (request, reply) { };

            const server = new Hapi.Server();
            server.connection({ routes: { timeout: { server: 50 }, payload: { timeout: 50 } } });
            server.route({ method: 'POST', path: '/timeout', config: { handler: timeoutHandler } });

            server.start((err) => {

                expect(err).to.not.exist();

                const timer = new Hoek.Bench();
                const options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/timeout',
                    method: 'POST'
                };

                const req = Http.request(options, (res) => {

                    expect([503, 408]).to.contain(res.statusCode);
                    expect(timer.elapsed()).to.be.at.least(45);
                    server.stop({ timeout: 1 }, done);
                });

                req.on('error', (err) => {

                    expect(err).to.not.exist();
                });

                req.write('\n');
                setTimeout(() => {

                    req.end();
                }, 100);
            });
        });
    });
});
