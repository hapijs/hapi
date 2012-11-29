// Load modules

var expect = require('chai').expect;
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


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
            request.raw.res.writeHead(400, { 'Content-Length': 13 });
            request.raw.res.end('unknown-close');
            request.reply.close();
        }
        else {
            request.reply('unknown-error');
        }
    };

    var server = new Hapi.Server('0.0.0.0', 18085, { ext: { onUnknownRoute: unknownRouteHandler, onPostHandler: postHandler } });
    server.addRoutes([
        { method: 'GET', path: '/custom', config: { handler: customErrorHandler } },
        { method: 'GET', path: '/tail', config: { handler: tailHandler } },
        { method: 'GET', path: '/ext', config: { handler: plainHandler } }
    ]);

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

            expect(res.headers['Content-Type']).to.equal('text/plain');
            done();
        });
    });

    it('returns valid OPTIONS response', function (done) {

        makeRequest('OPTIONS', '/custom', function (res) {

            expect(res.headers['Access-Control-Allow-Origin']).to.equal('*');
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

            expect(res.statusCode).to.equal(400);
            expect(res.readPayload()).to.equal('unknown-close');
            done();
        });
    });
});