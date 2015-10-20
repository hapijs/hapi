// Load modules

var Boom = require('boom');
var Code = require('code');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('CORS', function () {

    it('returns 404 on OPTIONS when cors disabled', function (done) {

        var handler = function (request, reply) {

            return reply();
        };

        var server = new Hapi.Server();
        server.connection({ routes: { cors: false } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('returns OPTIONS response', function (done) {

        var handler = function (request, reply) {

            return reply(Boom.badRequest());
        };

        var server = new Hapi.Server();
        server.connection({ routes: { cors: true } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

            expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
            done();
        });
    });

    it('returns OPTIONS response (server config)', function (done) {

        var handler = function (request, reply) {

            return reply(Boom.badRequest());
        };

        var server = new Hapi.Server({ connections: { routes: { cors: true } } });
        server.connection();
        server.route({ method: 'GET', path: '/x', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/x', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

            expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
            done();
        });
    });

    it('returns headers on single route', function (done) {

        var handler = function (request, reply) {

            return reply('ok');
        };

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: true } });
        server.route({ method: 'GET', path: '/b', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res1) {

            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.be.null();
            expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

            server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res2) {

                expect(res2.statusCode).to.equal(404);
                expect(res2.result.message).to.equal('CORS is disabled for this route');
                expect(res2.headers['access-control-allow-origin']).to.not.exist();
                done();
            });
        });
    });

    it('allows headers on multiple routes but not all', function (done) {

        var handler = function (request, reply) {

            return reply('ok');
        };

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: true } });
        server.route({ method: 'GET', path: '/b', handler: handler, config: { cors: true } });
        server.route({ method: 'GET', path: '/c', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res1) {

            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.be.null();
            expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

            server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res2) {

                expect(res2.statusCode).to.equal(200);
                expect(res2.result).to.be.null();
                expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');

                server.inject({ method: 'OPTIONS', url: '/c', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res3) {

                    expect(res3.statusCode).to.equal(404);
                    expect(res3.result.message).to.equal('CORS is disabled for this route');
                    expect(res3.headers['access-control-allow-origin']).to.not.exist();
                    done();
                });
            });
        });
    });

    it('allows same headers on multiple routes with same path', function (done) {

        var handler = function (request, reply) {

            return reply('ok');
        };

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: true } });
        server.route({ method: 'POST', path: '/a', handler: handler, config: { cors: true } });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.be.null();
            expect(res.headers['access-control-allow-origin']).to.equal('http://example.com/');
            done();
        });
    });

    it('returns headers on single route (overrides defaults)', function (done) {

        var handler = function (request, reply) {

            return reply('ok');
        };

        var server = new Hapi.Server();
        server.connection({ routes: { cors: { origin: ['b'] } } });
        server.route({ method: 'GET', path: '/a', handler: handler, config: { cors: { origin: ['a'] } } });
        server.route({ method: 'GET', path: '/b', handler: handler });

        server.inject({ method: 'OPTIONS', url: '/a', headers: { origin: 'a', 'access-control-request-method': 'GET' } }, function (res1) {

            expect(res1.statusCode).to.equal(200);
            expect(res1.result).to.be.null();
            expect(res1.headers['access-control-allow-origin']).to.equal('a');

            server.inject({ method: 'OPTIONS', url: '/b', headers: { origin: 'b', 'access-control-request-method': 'GET' } }, function (res2) {

                expect(res2.statusCode).to.equal(200);
                expect(res2.result).to.be.null();
                expect(res2.headers['access-control-allow-origin']).to.equal('b');
                done();
            });
        });
    });

    it('sets access-control-allow-credentials header', function (done) {

        var handler = function (request, reply) {

            return reply();
        };

        var server = new Hapi.Server();
        server.connection({ routes: { cors: { credentials: true } } });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { origin: 'http://example.com/' } }, function (res) {

            expect(res.result).to.equal(null);
            expect(res.headers['access-control-allow-credentials']).to.equal('true');
            done();
        });
    });

    describe('headers()', function () {

        it('returns CORS origin (route level)', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler, config: { cors: true } });

            server.inject({ url: '/', headers: { origin: 'http://example.com/' } }, function (res1) {

                expect(res1.result).to.exist();
                expect(res1.result).to.equal('ok');
                expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');

                server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res2) {

                    expect(res2.result).to.be.null();
                    expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');
                    done();
                });
            });
        });

        it('returns CORS origin (GET)', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://x.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.equal('http://x.example.com');
                done();
            });
        });

        it('returns CORS origin (OPTIONS)', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://test.example.com', 'access-control-request-method': 'GET' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload.length).to.equal(0);
                expect(res.headers['access-control-allow-origin']).to.equal('http://test.example.com');
                done();
            });
        });

        it('merges CORS access-control-expose-headers header', function (done) {

            var handler = function (request, reply) {

                return reply('ok').header('access-control-expose-headers', 'something');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { additionalExposedHeaders: ['xyz'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://example.com/' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-expose-headers']).to.equal('something,WWW-Authenticate,Server-Authorization,xyz');
                done();
            });
        });

        it('returns no CORS headers when route CORS disabled', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler, config: { cors: false } });

            server.inject({ url: '/', headers: { origin: 'http://x.example.com' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('ok');
                expect(res.headers['access-control-allow-origin']).to.not.exist();
                done();
            });
        });

        it('returns matching CORS origin', function (done) {

            var handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.example.com' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns origin header when matching against *', function (done) {

            var handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['*'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.example.com' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.example.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns matching CORS origin wildcard', function (done) {

            var handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.a.com' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('returns matching CORS origin wildcard when more than one wildcard', function (done) {

            var handler = function (request, reply) {

                return reply('Tada').header('vary', 'x-test', true);
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['http://test.example.com', 'http://www.example.com', 'http://*.b.com', 'http://*.a.com'] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://www.a.com' } }, function (res) {

                expect(res.result).to.exist();
                expect(res.result).to.equal('Tada');
                expect(res.headers['access-control-allow-origin']).to.equal('http://www.a.com');
                expect(res.headers.vary).to.equal('x-test,origin');
                done();
            });
        });

        it('does not set empty CORS expose headers', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { exposedHeaders: [] } } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({ url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res1) {

                expect(res1.headers['access-control-allow-origin']).to.equal('http://example.com/');
                expect(res1.headers['access-control-expose-headers']).to.not.exist();

                server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res2) {

                    expect(res2.headers['access-control-allow-origin']).to.equal('http://example.com/');
                    expect(res2.headers['access-control-expose-headers']).to.not.exist();
                    done();
                });
            });
        });
    });

    describe('options()', function () {

        it('ignores OPTIONS route', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'OPTIONS',
                path: '/',
                handler: function (request, reply) { }
            });

            expect(server.connections[0]._router.special.options).to.not.exist();
            done();
        });
    });

    describe('handler()', function () {

        it('errors on missing origin header', function (done) {

            var server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { 'access-control-request-method': 'GET' } }, function (res) {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('Missing Origin header');
                done();
            });
        });

        it('errors on missing access-control-request-method header', function (done) {

            var server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/' } }, function (res) {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('Missing Access-Control-Request-Method header');
                done();
            });
        });

        it('errors on missing route', function (done) {

            var server = new Hapi.Server();
            server.connection({ routes: { cors: true } });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('errors on mismatching origin header', function (done) {

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { origin: ['a'] } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('Origin not allowed');
                done();
            });
        });

        it('matches allowed headers', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'Authorization'
                }
            }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-headers']).to.equal('Accept,Authorization,Content-Type,If-None-Match');
                done();
            });
        });

        it('errors on disallowed headers', function (done) {

            var handler = function (request, reply) {

                return reply('ok');
            };

            var server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject({
                method: 'OPTIONS',
                url: '/',
                headers: {
                    origin: 'http://test.example.com',
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'X'
                }
            }, function (res) {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('Some headers are not allowed');
                done();
            });
        });

        it('allows credentials', function (done) {

            var server = new Hapi.Server();
            server.connection({ routes: { cors: { credentials: true } } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { }
            });

            server.inject({ method: 'OPTIONS', url: '/', headers: { origin: 'http://example.com/', 'access-control-request-method': 'GET' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-credentials']).to.equal('true');
                done();
            });
        });
    });

    describe('headers()', function () {

        it('skips CORS when missing origin header', function (done) {

            var server = new Hapi.Server();
            server.connection({ routes: { cors: true } });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply('ok');
                }
            });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['access-control-allow-origin']).to.not.exist();
                done();
            });
        });
    });
});
