// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
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

    var server = new Hapi.Server('0.0.0.0', 18085, { ext: { onPostHandler: postHandler } });
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

        makeRequest('GET', '/custom', function (rawRes) {

            expect(rawRes.headers['Content-Type']).to.equal('text/plain');
            done();
        });
    });

    it('returns valid OPTIONS response', function (done) {

        makeRequest('OPTIONS', '/custom', function (rawRes) {

            expect(rawRes.headers['Access-Control-Allow-Origin']).to.equal('*');
            done();
        });
    });

    it('generates tail event', function (done) {

        var result = null;

        server.once('tail', function () {

            expect(result).to.equal('Done');
            done();
        });

        makeRequest('GET', '/tail', function (rawRes) {
            
            result = rawRes.result;
        });
    });

    it('returns error response on ext error', function (done) {

        makeRequest('GET', '/ext', function (rawRes) {

            expect(rawRes.result.code).to.equal(400);
            done();
        });
    });
});