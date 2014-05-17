// Load modules

var Net = require('net');
var Stream = require('stream');
var Http = require('http');
var Lab = require('lab');
var Nipple = require('nipple');
var Hoek = require('hoek');
var Shot = require('shot');
var Hoek = require('hoek');
var Hapi = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Request', function () {

    it('returns valid OPTIONS response', function (done) {

        var handler = function (request, reply) {

            reply(Hapi.error.badRequest());
        };

        var server = new Hapi.Server({ cors: true });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/' }, function (res) {

            expect(res.headers['access-control-allow-origin']).to.equal('*');
            done();
        });
    });

    it('generates tail event', function (done) {

        var handler = function (request, reply) {

            var t1 = request.addTail('t1');
            var t2 = request.addTail('t2');

            reply('Done');

            t1();
            t1();                           // Ignored
            setTimeout(t2, 10);
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        var result = null;

        server.once('tail', function () {

            expect(result).to.equal('Done');
            done();
        });

        server.inject('/', function (res) {

            result = res.result;
        });
    });

    it('generates tail event without name', function (done) {

        var handler = function (request, reply) {

            var tail = request.tail();
            reply('Done');
            tail();
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        var result = null;

        server.once('tail', function () {

            done();
        });

        server.inject('/', function (res) {

        });
    });

    it('returns error response on ext error', function (done) {

        var handler = function (request, reply) {

            reply('OK');
        };

        var server = new Hapi.Server();

        var ext = function (request, next) {

            next(Hapi.error.badRequest());
        };

        server.ext('onPostHandler', ext);
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result.statusCode).to.equal(400);
            done();
        });
    });

    it('returns unknown response using reply()', function (done) {

        var unknownRouteHandler = function (request, reply) {

            reply('unknown-reply');
        };

        var server = new Hapi.Server();
        server.route({ method: '*', path: '/{p*}', handler: unknownRouteHandler });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('unknown-reply');
            done();
        });
    });

    it('handles errors on the response after the response has been started', function (done) {

        var handler = function (request, reply) {

            reply('success');

            var orig = request.raw.res.write;
            request.raw.res.write = function (chunk, encoding) {

                orig.call(request.raw.res, chunk, encoding);
                request.raw.res.emit('error', new Error('fail'));
            };
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result).to.equal('success');
            done();
        });
    });

    it('handles stream errors on the response after the response has been piped', function (done) {

        var handler = function (request, reply) {

            var TestStream = function () {

                Stream.Readable.call(this);
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                var self = this;

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                self.push('success');

                setImmediate(function () {

                    self.emit('error', new Error());
                });
            };

            var stream = new TestStream();
            reply(stream);
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result).to.equal('success');
            done();
        });
    });

    it('returns 500 on handler exception (same tick)', function (done) {

        var server = new Hapi.Server({ debug: false });

        var handler = function (request) {

            var x = a.b.c;
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject('/domain', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('returns 500 on handler exception (next tick)', { parallel: false }, function (done) {

        var handler = function (request) {

            setImmediate(function () {

                var x = not.here;
            });
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });
        server.on('internalError', function (request, err) {

            expect(err.message).to.equal('Uncaught error: not is not defined');
            done();
        });

        var orig = console.error;
        console.error = function () {

            console.error = orig;
            expect(arguments[0]).to.equal('Debug:');
            expect(arguments[1]).to.equal('hapi, internal, implementation, error');
        };

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(500);
        });
    });

    it('ignores second call to onReply()', function (done) {

        var server = new Hapi.Server();

        var handler = function (request, reply) {

            reply('123').hold().send();
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject('/domain', function (res) {

            expect(res.result).to.equal('123');
            done();
        });
    });

    it('sends reply after handler timeout', function (done) {

        var server = new Hapi.Server();

        var handler = function (request, reply) {

            var response = reply('123').hold();
            setTimeout(function () {
                response.send();
            }, 10);
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject('/domain', function (res) {

            expect(res.result).to.equal('123');
            done();
        });
    });

    it('returns 500 on ext method exception (same tick)', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.ext('onRequest', function (request, next) {

            var x = a.b.c;
        });

        var handler = function (request, reply) {

            reply('neven gonna happen');
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject('/domain', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('invokes handler with right arguments', function (done) {

        var server = new Hapi.Server();

        var handler = function (request, reply) {

            expect(arguments.length).to.equal(2);
            expect(reply.send).to.not.exist;
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('request has client address', function (done) {

        var handler = function (request, reply) {

            expect(request.info.remoteAddress).to.equal('127.0.0.1');
            expect(request.info.remoteAddress).to.equal(request.info.remoteAddress);
            reply('ok');
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/', handler: handler });

        server.start(function () {

            Nipple.get('http://localhost:' + server.info.port, function (err, res, body) {

                expect(body).to.equal('ok');
                done();
            });
        });
    });

    it('request has referrer', function (done) {

        var server = new Hapi.Server();

        var handler = function (request, reply) {

            expect(request.info.referrer).to.equal('http://site.com');
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { referrer: 'http://site.com' } }, function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('request has referer', function (done) {

        var server = new Hapi.Server();

        var handler = function (request, reply) {

            expect(request.info.referrer).to.equal('http://site.com');
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { referer: 'http://site.com' } }, function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('returns 400 on invalid path', function (done) {

        var server = new Hapi.Server();
        server.inject('invalid', function (res) {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('returns 403 on forbidden response', function (done) {

        var handler = function (request, reply) {

            reply(Hapi.error.forbidden('Unauthorized content'));
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('handles aborted requests', { parallel: false }, function (done) {

        var handler = function (request, reply) {

            var TestStream = function () {

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

            var stream = new TestStream();
            reply(stream);
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/', handler: handler });

        server.start(function () {

            var total = 2;
            var createConnection = function () {

                var client = Net.connect(server.info.port, function () {

                    client.write('GET / HTTP/1.1\r\n\r\n');
                    client.write('GET / HTTP/1.1\r\n\r\n');
                });

                client.on('data', function () {

                    total--;
                    client.destroy();
                });
            };

            var check = function () {

                if (total) {
                    createConnection();
                    setImmediate(check);
                }
                else {
                    done();
                }
            };

            check();
        });
    });

    it('returns request header', function (done) {

        var handler = function (request, reply) {

            reply(request.headers['user-agent']);
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.payload).to.equal('shot');
            done();
        });
    });

    it('parses nested query string', function (done) {

        var handler = function (request, reply) {

            reply(request.query);
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/?a[b]=5&d[ff]=ok', function (res) {

            expect(res.result).to.deep.equal({ a: { b: '5' }, d: { ff: 'ok' } });
            done();
        });
    });

    it('returns empty params array when none present', function (done) {

        var handler = function (request, reply) {

            reply(request.params);
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result).to.deep.equal({});
            done();
        });
    });

    it('gunzips when parse=gunzip', function (done) {

        var zlib = require('zlib');
        var msg = "hapi=joi";
        var buf = new Buffer(msg, 'utf-8');

        var handler = function (request, reply) {
            reply({
                isBuffer: Buffer.isBuffer(request.payload),
                msg: request.payload.toString()
            });
        };

        var server = new Hapi.Server();
        server.route({
            method: 'POST', path: '/',
            config: {
                payload: { parse: 'gunzip' },
                handler: handler
            }
        });

        zlib.gzip(buf, function (err, gz_data) {
            server.inject({
                method: 'POST', url: '/', payload: gz_data,
                headers: {
                    'Content-Encoding': 'gzip',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, function (res) {

                expect(res.result.isBuffer).to.equal(true);
                expect(res.result.msg).to.equal(msg);

                done();
            });
        });
    });
    
    it('does not fail on abort', function (done) {

        var clientRequest;

        var handler = function (request, reply) {

            clientRequest.abort();

            setTimeout(function () {

                reply(new Error('fail'));
                setTimeout(done, 10);
            }, 10);
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/', handler: handler });

        server.start(function () {

            clientRequest = Http.request({
                hostname: 'localhost',
                port: server.info.port,
                method: 'GET'
            });

            clientRequest.on('error', function () { /* NOP */ });
            clientRequest.end();
        });
    });

    it('does not fail on abort with ext', function (done) {

        var clientRequest;

        var handler = function (request, reply) {

            clientRequest.abort();
            setTimeout(function () {

                reply(new Error('boom'));
            }, 10);
        };

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/', handler: handler });

        server.ext('onPreResponse', function (request, reply) {

            return reply();
        });

        server.on('tail', function () {

            done();
        });

        server.start(function () {

            clientRequest = Http.request({
                hostname: 'localhost',
                port: server.info.port,
                method: 'GET'
            });

            clientRequest.on('error', function () { /* NOP */ });
            clientRequest.end();
        });
    });

    it('closes response after server timeout', function (done) {

        var handler = function (request, reply) {

            setTimeout(function () {

                var stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                stream.close = function () {

                    done();
                }

                reply(stream);
            }, 10)
        };

        var server = new Hapi.Server({ timeout: { server: 5 } });
        server.route({
            method: 'GET',
            path: '/',
            handler: handler
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(503);
        });
    });

    it('does not close error response after server timeout', function (done) {

        var handler = function (request, reply) {

            setTimeout(function () {

                reply(new Error('after'));
            }, 10)
        };

        var server = new Hapi.Server({ timeout: { server: 5 } });
        server.route({
            method: 'GET',
            path: '/',
            handler: handler
        });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(503);
            done();
        });
    });

    describe('#setMethod', function () {

        it('changes method with a lowercase version of the value passed in', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            server.ext('onRequest', function (request, reply) {

                request.setMethod('POST');
                reply(request.method);
            });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('post');
                done();
            });
        });

        it('errors on missing method', function (done) {

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            server.ext('onRequest', function (request, reply) {

                request.setMethod();
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });

        it('errors on invalid method type', function (done) {

            var server = new Hapi.Server({ debug: false });
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            server.ext('onRequest', function (request, reply) {

                request.setMethod(42);
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });

    describe('#setUrl', function () {

        it('sets url, path, and query', function (done) {

            var url = 'http://localhost/page?param1=something';
            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            server.ext('onRequest', function (request, reply) {

                request.setUrl(url);
                reply([request.url.href, request.path, request.query.param1].join('|'));
            });

            server.inject('/', function (res) {

                expect(res.payload).to.equal(url + '|/page|something');
                done();
            });
        });

        it('normalizes a path', function (done) {

            var rawPath = '/%0%1%2%3%4%5%6%7%8%9%a%b%c%d%e%f%10%11%12%13%14%15%16%17%18%19%1a%1b%1c%1d%1e%1f%20%21%22%23%24%25%26%27%28%29%2a%2b%2c%2d%2e%2f%30%31%32%33%34%35%36%37%38%39%3a%3b%3c%3d%3e%3f%40%41%42%43%44%45%46%47%48%49%4a%4b%4c%4d%4e%4f%50%51%52%53%54%55%56%57%58%59%5a%5b%5c%5d%5e%5f%60%61%62%63%64%65%66%67%68%69%6a%6b%6c%6d%6e%6f%70%71%72%73%74%75%76%77%78%79%7a%7b%7c%7d%7e%7f%80%81%82%83%84%85%86%87%88%89%8a%8b%8c%8d%8e%8f%90%91%92%93%94%95%96%97%98%99%9a%9b%9c%9d%9e%9f%a0%a1%a2%a3%a4%a5%a6%a7%a8%a9%aa%ab%ac%ad%ae%af%b0%b1%b2%b3%b4%b5%b6%b7%b8%b9%ba%bb%bc%bd%be%bf%c0%c1%c2%c3%c4%c5%c6%c7%c8%c9%ca%cb%cc%cd%ce%cf%d0%d1%d2%d3%d4%d5%d6%d7%d8%d9%da%db%dc%dd%de%df%e0%e1%e2%e3%e4%e5%e6%e7%e8%e9%ea%eb%ec%ed%ee%ef%f0%f1%f2%f3%f4%f5%f6%f7%f8%f9%fa%fb%fc%fd%fe%ff%0%1%2%3%4%5%6%7%8%9%A%B%C%D%E%F%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20%21%22%23%24%25%26%27%28%29%2A%2B%2C%2D%2E%2F%30%31%32%33%34%35%36%37%38%39%3A%3B%3C%3D%3E%3F%40%41%42%43%44%45%46%47%48%49%4A%4B%4C%4D%4E%4F%50%51%52%53%54%55%56%57%58%59%5A%5B%5C%5D%5E%5F%60%61%62%63%64%65%66%67%68%69%6A%6B%6C%6D%6E%6F%70%71%72%73%74%75%76%77%78%79%7A%7B%7C%7D%7E%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF';
            var normPath = '/%0%1%2%3%4%5%6%7%8%9%a%b%c%d%e%f%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20!%22%23$%25&\'()*+,-.%2F0123456789:;%3C=%3E%3F@ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF%0%1%2%3%4%5%6%7%8%9%A%B%C%D%E%F%10%11%12%13%14%15%16%17%18%19%1A%1B%1C%1D%1E%1F%20!%22%23$%25&\'()*+,-.%2F0123456789:;%3C=%3E%3F@ABCDEFGHIJKLMNOPQRSTUVWXYZ%5B%5C%5D%5E_%60abcdefghijklmnopqrstuvwxyz%7B%7C%7D~%7F%80%81%82%83%84%85%86%87%88%89%8A%8B%8C%8D%8E%8F%90%91%92%93%94%95%96%97%98%99%9A%9B%9C%9D%9E%9F%A0%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF';

            var url = 'http://localhost' + rawPath + '?param1=something';

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { } });

            server.ext('onRequest', function (request, reply) {

                request.setUrl(url);
                reply([request.url.href, request.path, request.query.param1].join('|'));
            });

            server.inject('/', function (res) {

                expect(res.payload).to.equal(url + '|' + normPath + '|something');
                done();
            });
        });

        it('allows missing path', function (done) {

            var server = new Hapi.Server();
            server.ext('onRequest', function (request, reply) {

                request.setUrl('');
                reply();
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('#log', { parallel: false }, function () {

        it('outputs log data to debug console', function (done) {

            var handler = function (request, reply) {

                request.log(['implementation'], 'data');
                reply();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            var orig = console.error;
            console.error = function () {

                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    data');
                console.error = orig;
                done();
            };

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('outputs log to debug console without data', function (done) {

            var handler = function (request, reply) {

                request.log(['implementation']);
                reply();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            var orig = console.error;
            console.error = function () {

                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('');
                console.error = orig;
                done();
            };

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('handles invalid log data object stringify', function (done) {

            var handler = function (request, reply) {

                var obj = {};
                obj.a = obj;

                request.log(['implementation'], obj);
                reply();
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    [Cannot display object: Converting circular structure to JSON]');
                done();
            };

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
            });
        });

        it('adds a log event to the request', function (done) {

            var handler = function (request, reply) {

                request.log('1', 'log event 1', Date.now());
                request.log(['2'], 'log event 2', new Date(Date.now()));
                request.log(['3', '4']);
                request.log(['1', '4']);
                request.log(['2', '3']);
                request.log(['4']);
                request.log('4');

                reply([request.getLog('1').length, request.getLog('4').length, request.getLog(['4']).length, request.getLog('0').length, request.getLog(['1', '2', '3', '4']).length, request.getLog().length >= 7].join('|'));
            };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('2|4|4|0|7|true');
                done();
            });
        });

        it('does not output events when debug disabled', function (done) {

            var server = new Hapi.Server({ debug: false });

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            var handler = function (request, reply) {

                request.log(['implementation']);
                reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                console.error('nothing');
                expect(i).to.equal(1);
                console.error = orig;
                done();
            });
        });

        it('does not output events when debug.request disabled', function (done) {

            var server = new Hapi.Server({ debug: { request: false } });

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            var handler = function (request, reply) {

                request.log(['implementation']);
                reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                console.error('nothing');
                expect(i).to.equal(1);
                console.error = orig;
                done();
            });
        });

        it('does not output non-implementation events by default', function (done) {

            var server = new Hapi.Server();

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            var handler = function (request, reply) {

                request.log(['xyz']);
                reply();
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                console.error('nothing');
                expect(i).to.equal(1);
                console.error = orig;
                done();
            });
        });
    });

    describe('#_setResponse', function () {

        it('leaves the response open when the same response is set again', function (done) {

            var server = new Hapi.Server();
            server.ext('onPostHandler', function (request, reply) {

                reply(request.response);
            });

            var handler = function (request, reply) {

                var stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('value');
                done();
            });
        });

        it('leaves the response open when the same response source is set again', function (done) {

            var server = new Hapi.Server();
            server.ext('onPostHandler', function (request, reply) {

                reply(request.response.source);
            });

            var handler = function (request, reply) {

                var stream = new Stream.Readable();
                stream._read = function (size) {

                    this.push('value');
                    this.push(null);
                };

                reply(stream);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.result).to.equal('value');
                done();
            });
        });
    });
});
