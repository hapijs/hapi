// Load modules

var Code = require('code');
var Hapi = require('..');
var Joi = require('joi');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Security', function () {

    describe('response splitting', function () {

        it('isn\'t allowed through the request.create method', function (done) {

            var server = new Hapi.Server();

            var createItemHandler = function (request, reply) {

                reply('Moved').created('/item/' + request.payload.name);
            };

            server.route({ method: 'POST', path: '/item', handler: createItemHandler });

            server.inject({
                method: 'POST', url: '/item',
                payload: '{"name": "foobar\r\nContent-Length: \r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 19\r\n\r\n<html>Shazam</html>"}',
                headers: { 'Content-Type': 'application/json' }
            }, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('Path Traversal', function () {

        it('to files outside of hosted directory is not allowed with null byte injection', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });

            server.inject('/%00/../security.js', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });

            server.inject('/../security.js', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed with encoded slash', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });

            server.inject('/..%2Fsecurity.js', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed with double encoded slash', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });

            server.inject('/..%252Fsecurity.js', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed with unicode encoded slash', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });

            server.inject('/..\u2216security.js', function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });
    });

    describe('Null Byte Injection', function () {

        it('isn\'t allowed when serving a file', function (done) {

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });

            server.inject('/index%00.html', function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });
    });

    describe('XSS', function () {

        it('does not exist with invalid content types', function (done) {

            var handler = function (request, reply) {

                reply('Success');
            };

            var server = new Hapi.Server();
            server.state('encoded', { encoding: 'iron' });
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({
                method: 'POST',
                url: '/',
                payload: '{"something":"something"}',
                headers: { 'content-type': '<script>alert(1)</script>;' }
            },
            function (res) {

                expect(res.result.message).to.not.contain('script');
                done();
            });
        });

        it('does not exist with invalid cookie values in the request', function (done) {

            var handler = function (request, reply) {

                reply('Success');
            };

            var server = new Hapi.Server();
            server.state('encoded', { encoding: 'iron' });
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({
                method: 'POST',
                url: '/',
                payload: '{"something":"something"}',
                headers: { cookie: 'encoded="<script></script>";' }
            },
            function (res) {

                expect(res.result.message).to.not.contain('<script>');
                done();
            });
        });

        it('does not exist with invalid cookie name in the request', function (done) {

            var handler = function (request, reply) {

                reply('Success');
            };

            var server = new Hapi.Server();
            server.state('encoded', { encoding: 'iron' });
            server.route({ method: 'POST', path: '/', handler: handler });

            server.inject({
                method: 'POST',
                url: '/',
                payload: '{"something":"something"}',
                headers: { cookie: '<script></script>=value;' }
            },
            function (res) {

                expect(res.result.message).to.not.contain('<script>');
                done();
            });
        });

        it('does not exist in path validation response message', function (done) {

            var server = new Hapi.Server();
            server.state('encoded', { encoding: 'iron' });

            server.route({
                method: 'GET', path: '/fail/{name}', handler: function (request, reply) {

                    reply('Success');
                },
                config: {
                    validate: { params: { name: Joi.number() } }
                }
            });

            server.inject({
                method: 'GET',
                url: '/fail/<script>'
            },
            function (res) {

                expect(res.result.message).to.not.contain('<script>');
                done();
            });
        });

        it('does not exist in payload validation response message', function (done) {

            var server = new Hapi.Server();
            server.route({
                method: 'POST', path: '/fail/payload', handler: function (request, reply) {

                    reply('Success');
                },
                config: {
                    validate: { payload: { name: Joi.number() } }
                }
            });

            server.inject({
                method: 'POST',
                url: '/fail/payload',
                payload: '{"<script></script>":"other"}',
                headers: { 'content-type': 'application/json' }
            },
            function (res) {

                expect(res.result.message).to.not.contain('<script>');
                done();
            });
        });

        it('does not exist in query validation response message', function (done) {

            var server = new Hapi.Server();
            server.route({
                method: 'GET', path: '/fail/query', handler: function (request, reply) {

                    reply('Success');
                },
                config: {
                    validate: { query: { name: Joi.string() } }
                }
            });

            server.inject({
                method: 'GET',
                url: '/fail/query?<script></script>=value'
            },
            function (res) {

                expect(res.result.message).to.not.contain('<script>');
                done();
            });
        });
    });
});
