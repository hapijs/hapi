// Load modules

var Lab = require('lab');
var Net = require('net');
var Stream = require('stream');
var Request = require('request');
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

    var customErrorHandler = function (request) {

        request.reply(Hapi.error.passThrough(599, 'heya', 'text/plain'));
    };

    var tailHandler = function (request) {

        var t1 = request.addTail('t1');
        var t2 = request.addTail('t2');

        request.reply('Done');

        t1();
        t1();                           // Ignored
        setTimeout(t2, 10);
    };

    var plainHandler = function (request) {

        request.reply('OK');
    };

    var postHandler = function (request, next) {

        next(request.path === '/ext' ? Hapi.error.badRequest() : null);
    };

    var unknownRouteHandler = function (request) {

        if (request.path === '/unknown/reply') {
            request.reply('unknown-reply');
        }
        else if (request.path === '/unknown/close') {
            request.reply('unknown-close');
        }
        else {
            request.reply('unknown-error');
        }
    };

    var responseErrorHandler = function (request) {

        request.reply('success');

        var orig = request.raw.res.write;
        request.raw.res.write = function (chunk, encoding) {

            orig.call(request.raw.res, chunk, encoding);
            request.raw.res.emit('error', new Error('fail'));
        };
    };

    var streamErrorHandler = function (request) {

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
        request.reply(stream);
    };

    var forbiddenErrorHandler = function (request) {

        request.reply(Hapi.error.forbidden('Unauthorized content'));
    };

    var addressHandler = function (request) {

        expect(request.info.remoteAddress).to.equal('127.0.0.1');
        expect(request.info.remoteAddress).to.equal(request.info.address);
        request.reply('ok');
    };

    var simpleHandler = function (request) {

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
        request.reply(stream);
    };

    var server = new Hapi.Server('0.0.0.0', 0, { cors: true });
    server.ext('onPostHandler', postHandler);
    server.route([
        { method: 'GET', path: '/', config: { handler: simpleHandler } },
        { method: 'GET', path: '/custom', config: { handler: customErrorHandler } },
        { method: 'GET', path: '/tail', config: { handler: tailHandler } },
        { method: 'GET', path: '/ext', config: { handler: plainHandler } },
        { method: 'GET', path: '/response', config: { handler: responseErrorHandler } },
        { method: 'GET', path: '/stream', config: { handler: streamErrorHandler } },
        { method: 'GET', path: '/forbidden', config: { handler: forbiddenErrorHandler } }
    ]);

    server.route({ method: 'GET', path: '/address', handler: addressHandler });
    server.route({ method: '*', path: '/{p*}', handler: unknownRouteHandler });

    before(function (done) {

        server.start(done);
    });

    it('returns custom error response', function (done) {

        server.inject('/custom', function (res) {

            expect(res.headers['content-type']).to.equal('text/plain; charset=utf-8');
            done();
        });
    });

    it('returns valid OPTIONS response', function (done) {

        server.inject({ method: 'OPTIONS', url: '/custom' }, function (res) {

            expect(res.headers['access-control-allow-origin']).to.equal('*');
            done();
        });
    });

    it('generates tail event', function (done) {

        var result = null;

        server.once('tail', function () {

            expect(result).to.equal('Done');
            done();
        });

        server.inject('/tail', function (res) {

            result = res.result;
        });
    });

    it('returns error response on ext error', function (done) {

        server.inject('/ext', function (res) {

            expect(res.result.code).to.equal(400);
            done();
        });
    });

    it('returns unknown response using reply()', function (done) {

        server.inject('/unknown/reply', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('unknown-reply');
            done();
        });
    });

    it('returns unknown response using close()', function (done) {

        server.inject('/unknown/close', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('unknown-close');
            done();
        });
    });

    it('handles errors on the response after the response has been started', function (done) {

        server.inject('/response', function (res) {

            expect(res.result).to.equal('success');
            done();
        });
    });

    it('handles stream errors on the response after the response has been piped', function (done) {

        server.inject('/stream', function (res) {

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

        var server = new Hapi.Server();

        var handler = function (request) {

            setImmediate(function () {

                var x = not.here;
            });
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });
        server.on('internalError', function (request, err) {

            expect(err.trace[0]).to.equal('ReferenceError: not is not defined');
            done();
        });

        var orig = console.error;
        var prints = 0;
        console.error = function () {

            ++prints;

            if (prints === 1) {
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('hapi, uncaught, handler, error');
            }
            else {
                console.error = orig;
            }
        };

        server.inject('/domain', function (res) {

            expect(res.statusCode).to.equal(500);
        });
    });

    it('ignores second call to onReply()', function (done) {

        var server = new Hapi.Server();

        var handler = function () {

            this.reply('123').hold().send();
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject('/domain', function (res) {

            expect(res.result).to.equal('123');
            done();
        });
    });

    it('sends reply after handler timeout', function (done) {

        var server = new Hapi.Server();

        var handler = function () {

            var response = this.reply('123').hold();
            setTimeout(function ()
            {
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

        var handler = function () {

            this.reply('neven gonna happen');
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

            expect(this).to.equal(request);
            expect(arguments.length).to.equal(2);
            expect(reply.send).to.not.exist;
            expect(this.reply.redirect).to.exist;
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('request has client address', function (done) {

        Request('http://localhost:' + server.info.port + '/address', function (err, res, body) {

            expect(body).to.equal('ok');
            done();
        });
    });

    it('request has referrer', function (done) {

        var server = new Hapi.Server();

        var handler = function (request) {

            expect(request.info.referrer).to.equal('http://site.com');
            request.reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ url: '/', headers: { referrer: 'http://site.com' } }, function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('returns 400 on invalid path', function (done) {

        server.inject('invalid', function (res) {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('returns 403 on forbidden response', function (done) {

        server.inject('/forbidden', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('handles aborted requests', function (done) {

        var total = 2;
        var createConnection = function () {

            var client = Net.connect(server.info.port, function () {

                client.write('GET / HTTP/1.1\r\n\r\n');
                client.write('GET / HTTP/1.1\r\n\r\n');
            });

            client.on('data', function() {

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