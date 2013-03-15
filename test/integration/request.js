// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Request = require('../../lib/request');


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

        request.removeTail(t1);
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
            request.reply.payload('unknown-close').send();
        }
        else {
            request.reply('unknown-error');
        }
    };

    var responseErrorHandler = function (request) {

        request.reply('success');
        request.raw.res.emit('error', new Error('fail'));
    };

    var server = new Hapi.Server('0.0.0.0', 0, { cors: true });
    server.ext('onPostHandler', postHandler);
    server.route([
        { method: 'GET', path: '/custom', config: { handler: customErrorHandler } },
        { method: 'GET', path: '/tail', config: { handler: tailHandler } },
        { method: 'GET', path: '/ext', config: { handler: plainHandler } },
        { method: 'GET', path: '/response', config: { handler: responseErrorHandler } }
    ]);

    server.route({ method: '*', path: '/{p*}', handler: unknownRouteHandler });

    var makeRequest = function (method, path, callback) {

        var next = function (res) {

            return callback(res);
        };

        server.inject({
            method: method,
            url: path
        }, next);
    };

    it('returns custom error response', function (done) {

        makeRequest('GET', '/custom', function (res) {

            expect(res.headers['content-type']).to.equal('text/plain; charset=utf-8');
            done();
        });
    });

    it('returns valid OPTIONS response', function (done) {

        makeRequest('OPTIONS', '/custom', function (res) {

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

        makeRequest('GET', '/tail', function (res) {

            result = res.result;
        });
    });

    it('returns error response on ext error', function (done) {

        makeRequest('GET', '/ext', function (res) {

            expect(res.result.code).to.equal(400);
            done();
        });
    });

    it('returns unknown response using reply()', function (done) {

        makeRequest('GET', '/unknown/reply', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('unknown-reply');
            done();
        });
    });

    it('returns unknown response using close()', function (done) {

        makeRequest('GET', '/unknown/close', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('unknown-close');
            done();
        });
    });

    it('handles errors on the response after the response has been started', function (done) {

        makeRequest('GET', '/response', function (res) {

            expect(res.result).to.equal('success');
            done();
        });
    });
    
    it('returns 500 on handler exception (same tick)', function (done) {

        var server = new Hapi.Server();

        var handler = function (request) {

            var x = a.b.c;
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject({ method: 'GET', url: '/domain' }, function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });
    
    it('returns 500 on handler exception (next tick)', function (done) {

        var server = new Hapi.Server();

        var handler = function (request) {

            setTimeout(function () {

                var x = a.b.c;
            }, 1);
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject({ method: 'GET', url: '/domain' }, function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });
    
    it('ignores second call to reply()', function (done) {

        var server = new Hapi.Server();

        var handler = function () {

            var reply = this.reply;
            reply('123');
            reply('456');
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject({ method: 'GET', url: '/domain' }, function (res) {

            expect(res.result).to.equal('123');
            done();
        });
    });
    
    
    it('returns 500 on ext method exception (same tick)', function (done) {

        var server = new Hapi.Server();
        server.ext('onRequest', function (request, next) {
           
           var x = a.b.c; 
        });

        var handler = function () {

            this.reply('neven gonna happen');
        };

        server.route({ method: 'GET', path: '/domain', handler: handler });

        server.inject({ method: 'GET', url: '/domain' }, function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('invokes handler with no arguments', function (done) {

        var server = new Hapi.Server();

        var handler = function () {

            expect(this instanceof Request).to.equal(true);
            expect(arguments.length).to.equal(0);
            this.reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'GET', url: '/' }, function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('invokes handler with 1 arguments', function (done) {

        var server = new Hapi.Server();

        var handler = function (request) {

            expect(this instanceof Request).to.equal(false);
            expect(arguments.length).to.equal(1);
            request.reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'GET', url: '/' }, function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('invokes handler with 3 arguments', function (done) {

        var server = new Hapi.Server();

        var handler = function (request, reply) {

            expect(this instanceof Request).to.equal(false);
            expect(arguments.length).to.equal(2);
            expect(reply.send).to.not.exist;
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject({ method: 'GET', url: '/' }, function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });
});