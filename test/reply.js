// Load modules

var Stream = require('stream');
var Boom = require('boom');
var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Reply', function () {

    it('throws when reply called twice', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); return reply('not ok'); } });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('proxies from handler', function (done) {

        var upstream = new Hapi.Server();
        upstream.connection();
        upstream.route({ method: 'GET', path: '/item', handler: function (request, reply) { return reply({ a: 1 }); } });
        upstream.start(function () {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/handler', handler: function (request, reply) { return reply.proxy({ uri: 'http://localhost:' + upstream.info.port + '/item' }); } });

            server.inject('/handler', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('"a":1');
                done();
            });
        });
    });

    it('redirects from handler', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply.redirect('/elsewhere'); } });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('/elsewhere');
            done();
        });
    });

    it('returns a file', function (done) {

        var server = new Hapi.Server();
        server.connection({ files: { relativeTo: __dirname } });
        var handler = function (request, reply) {

            return reply.file('../package.json').code(499);
        };

        server.route({ method: 'GET', path: '/file', handler: handler });

        server.inject('/file', function (res) {

            expect(res.statusCode).to.equal(499);
            expect(res.payload).to.contain('hapi');
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.headers['content-length']).to.exist();
            expect(res.headers['content-disposition']).to.not.exist();
            done();
        });
    });

    describe('_interface()', function () {

        it('uses reply(null, result) for result', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(null, 'steve'); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('steve');
                done();
            });
        });

        it('uses reply(null, err) for err', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(null, Boom.badRequest()); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });

        it('ignores result when err provided in reply(err, result)', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(Boom.badRequest(), 'steve'); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('response()', function () {

        it('returns null', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(null, null); } });
            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(null);
                done();
            });
        });

        it('returns a buffer reply', function (done) {

            var handler = function (request, reply) {

                return reply(new Buffer('Tada1')).code(299);
            };

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal('Tada1');
                expect(res.headers['content-type']).to.equal('application/octet-stream');
                done();
            });
        });

        it('returns an object response', function (done) {

            var handler = function (request, reply) {

                return reply({ a: 1, b: 2 });
            };

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('{\"a\":1,\"b\":2}');
                expect(res.headers['content-length']).to.equal(13);
                done();
            });
        });

        it('returns false', function (done) {

            var handler = function (request, reply) {

                return reply(false);
            };

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.payload).to.equal('false');
                done();
            });
        });

        it('returns an error reply', function (done) {

            var handler = function (request, reply) {

                return reply(new Error('boom'));
            };

            var server = new Hapi.Server({ debug: false });
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(500);
                expect(res.result).to.exist();
                done();
            });
        });

        it('returns an empty reply', function (done) {

            var handler = function (request, reply) {

                return reply().code(299);
            };

            var server = new Hapi.Server();
            server.connection({ cors: { credentials: true } });
            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(299);
                expect(res.result).to.equal(null);
                expect(res.headers['access-control-allow-credentials']).to.equal('true');
                done();
            });
        });

        it('returns a stream reply', function (done) {

            var TestStream = function () {

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

            var handler = function (request, reply) {

                return reply(new TestStream()).ttl(2000);
            };

            var server = new Hapi.Server({ debug: false });
            server.connection({ cors: { origin: ['test.example.com'] } });
            server.route({ method: 'GET', path: '/stream', config: { handler: handler, cache: { expiresIn: 9999 } } });

            server.inject('/stream', function (res) {

                expect(res.result).to.equal('xy');
                expect(res.statusCode).to.equal(200);
                expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');

                server.inject({ method: 'HEAD', url: '/stream' }, function (res) {

                    expect(res.result).to.equal('');
                    expect(res.statusCode).to.equal(200);
                    expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate');
                    expect(res.headers['access-control-allow-origin']).to.equal('test.example.com');
                    done();
                });
            });
        });
    });

    describe('hold()', function () {

        it('undo scheduled next tick in reply interface', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var handler = function (request, reply) {

                return reply('123').hold().send();
            };

            server.route({ method: 'GET', path: '/domain', handler: handler });

            server.inject('/domain', function (res) {

                expect(res.result).to.equal('123');
                done();
            });
        });

        it('sends reply after timed handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

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
    });

    describe('close()', function () {

        it('returns a reply with manual end', function (done) {

            var handler = function (request, reply) {

                request.raw.res.end();
                return reply.close({ end: false });
            };

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });

        it('returns a reply with auto end', function (done) {

            var handler = function (request, reply) {

                return reply.close();
            };

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('');
                done();
            });
        });
    });
});
