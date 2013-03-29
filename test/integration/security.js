// Load modules

var Lab = require('lab');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Security', function () {

    describe('response splitting', function () {

        var server = new Hapi.Server('0.0.0.0', 0);

        internals.createItemHandler = function (request) {

            request.reply.payload('Moved').created(request.server.settings.uri + '/item/' + request.payload.name).send();
        };

        before(function (done) {

            server.addRoute({ method: 'POST', path: '/item', handler: internals.createItemHandler });
            done();
        });

        it('isn\'t allowed through the request.create method', function (done) {

            server.inject({ method: 'POST', url: '/item',
                payload: '{"name": "foobar\r\nContent-Length: \r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 19\r\n\r\n<html>Shazam</html>"}',
                headers: { 'Content-Type': 'application/json' } }, function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('Path Traversal', function () {

        var server = new Hapi.Server('0.0.0.0', 0);

        before(function (done) {

            server.addRoute({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });
            done();
        });

        it('to files outside of hosted directory is not allowed with null byte injection', function (done) {

            server.inject({ method: 'GET', url: '/%00/../security.js' }, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed', function (done) {

            server.inject({ method: 'GET', url: '/../security.js' }, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed with encoded slash', function (done) {

            server.inject({ method: 'GET', url: '/..%2Fsecurity.js' }, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed with double encoded slash', function (done) {

            server.inject({ method: 'GET', url: '/..%252Fsecurity.js' }, function (res) {

                expect(res.statusCode).to.equal(403);
                done();
            });
        });

        it('to files outside of hosted directory is not allowed with unicode encoded slash', function (done) {

            server.inject({ method: 'GET', url: '/..%u2216security.js' }, function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });
    });

    describe('Null Byte Injection', function () {

        var server = new Hapi.Server('0.0.0.0', 0);

        before(function (done) {

            server.addRoute({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory' } } });
            done();
        });

        it('isn\'t allowed when serving a file', function (done) {

            server.inject({ method: 'GET', url: '/index%00.html' }, function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });
    });

    describe('XSS', function () {

        var server = new Hapi.Server('0.0.0.0', 0, { debug: false });

        internals.postHandler = function (request) {

            request.reply.payload('Success').send();
        };

        before(function (done) {

            server.state('encoded', { encoding: 'iron' });
            server.addRoute({ method: 'POST', path: '/', handler: internals.postHandler });
            done();
        });

        it('doesn\'t exist with invalid content types', function (done) {

            server.inject({
                method: 'POST',
                url: '/',
                payload: '{"something":"something"}',
                headers: { 'content-type': '<script>alert(1)</script>;' } },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
            });
        });

        it('doesn\'t exist with invalid cookie values in the request', function (done) {

            server.inject({
                    method: 'POST',
                    url: '/',
                    payload: '{"something":"something"}',
                    headers: { 'cookie': 'encoded="<script></script>";' } },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
                });
        });

        it('doesn\'t exist when setting invalid cookie names', function (done) {

            server.route({ method: 'GET', path: '/cookiename', handler: function (request) {

                request.reply.payload('Success').setState('<script></script>', 'seomthing').send();
            }});

            server.inject({
                    method: 'GET',
                    url: '/cookiename' },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
                });
        });

        it('doesn\'t exist when setting invalid cookie value', function (done) {

            server.route({ method: 'GET', path: '/cookievalue', handler: function (request) {

                request.reply.payload('Success').setState('seomthing', '<script></script>').send();
            }});

            server.inject({
                    method: 'GET',
                    url: '/cookievalue' },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
                });
        });

        it('doesn\'t exist in path validation response message', function (done) {

            server.route({ method: 'GET', path: '/fail/{name}', handler: function (request) {

                request.reply('Success');
            },
                config: {
                    validate: { path: { name: Hapi.Types.Function() } }
                }
            });

            server.inject({
                    method: 'GET',
                    url: '/fail/<script>' },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
                });
        });

        it('doesn\'t exist in payload validation response message', function (done) {

            server.route({ method: 'POST', path: '/fail/payload', handler: function (request) {

                request.reply('Success');
            },
                config: {
                    validate: { payload: { name: Hapi.Types.String().max(4).min(1).required() } }
                }
            });

            server.inject({
                    method: 'POST',
                    url: '/fail/payload',
                    payload: '{"name":"<script></script>"}',
                    headers: { 'content-type': 'application/json' } },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
                });
        });

        it('doesn\'t exist in query validation response message', function (done) {

            server.route({ method: 'GET', path: '/fail/query', handler: function (request) {

                request.reply('Success');
            },
                config: {
                    validate: { query: { name: Hapi.Types.String().alphanum().required() } }
                }
            });

            server.inject({
                    method: 'GET',
                    url: '/fail/query?name=<script></script>' },
                function (res) {

                    expect(res.result.message).to.not.contain('<script>');
                    done();
                });
        });
    });
});