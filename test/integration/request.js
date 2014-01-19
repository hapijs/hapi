// Load modules

var Lab = require('lab');
var Net = require('net');
var Stream = require('stream');
var Nipple = require('nipple');
var Hapi = require('../..');

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

            Hapi.utils.inherits(TestStream, Stream.Readable);

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

    it('returns 500 on handler exception (next tick)', function (done) {

        var handler = function (request) {

            setImmediate(function () {

                var x = not.here;
            });
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: handler });
        server.on('internalError', function (request, err) {

            expect(err.stack.split('\n')[0]).to.equal('ReferenceError: Uncaught error: not is not defined');
            done();
        });

        var orig = console.error;
        console.error = function () {

            expect(arguments[0]).to.equal('Debug:');
            expect(arguments[1]).to.equal('hapi, internal, implementation, error');
            console.error = orig;
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

    it('handles aborted requests', function (done) {

        var handler = function (request, reply) {

            var TestStream = function () {

                Stream.Readable.call(this);
            };

            Hapi.utils.inherits(TestStream, Stream.Readable);

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
});