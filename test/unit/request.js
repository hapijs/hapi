// Load modules

var Chai = require('chai');
var Shot = require('shot');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');
var Request = process.env.TEST_COV ? require('../../lib-cov/request') : require('../../lib/request');
var Defaults = process.env.TEST_COV ? require('../../lib-cov/defaults') : require('../../lib/defaults');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Request', function () {

    var server = { settings: Defaults.server };

    var _req = null;
    var _res = null;
    var reqOptions = {
        url: 'http://localhost',
        method: 'GET',
        headers: []
    };

    before(function (done) {

        Shot.inject(function (req, res) {

            _req = req;
            _res = res;
            done();
        }, reqOptions,
            function () { }
        );
    });

    it('throws an error if constructed without new', function (done) {

        var fn = function () {

            var request = Request(server, null, null);
        };

        expect(fn).throws(Error, 'Request must be instantiated using new');
        done();
    });

    it('throws an error when no server is provided', function (done) {

        var fn = function () {

            var request = new Request(null, _req, _res);
        };

        expect(fn).throws(Error, 'server must be provided');
        done();
    });

    it('throws an error when no req is provided', function (done) {

        var fn = function () {

            var request = new Request(server, null, _res);
        };

        expect(fn).throws(Error, 'req must be provided');
        done();
    });

    it('throws an error when no res is provided', function (done) {

        var fn = function () {

            var request = new Request(server, _req, null);
        };

        expect(fn).throws(Error, 'res must be provided');
        done();
    });

    it('is created without error when correct parameters are provided', function (done) {

        var fn = function () {

            var request = new Request(server, _req, _res);
        };
        expect(fn).not.to.throw(Error);
        done();
    });

    it('assigns _debug when created request has debug querystring key', function (done) {

        var req = Hapi.Utils.clone(_req);
        req.pause = function () { };
        var serverModified = Hapi.Utils.clone(server);

        req.url = 'http://localhost/?debug=test';
        serverModified.settings.debug = {
            queryKey: 'debug'
        };

        var request = new Request(serverModified, req, _res);

        expect(request._debug).to.exist;
        done();
    });

    describe('#_setMethod', function () {

        it('throws an error when a null method is passed in', function (done) {

            var fn = function () {

                var request = new Request(server, _req, _res);
                request._setMethod(null);
            };

            expect(fn).throws(Error, 'method must be provided');
            done();
        });

        it('changes method with a lowercase version of the value passed in', function (done) {

            var request = new Request(server, _req, _res);
            request._setMethod('GET');

            expect(request.method).to.equal('get');
            done();
        });
    });

    describe('#_setUrl', function () {

        it('throws an error when a null url is passed in', function (done) {

            var fn = function () {

                var request = new Request(server, _req, _res);
                request._setUrl(null);
            };

            expect(fn).throws(Error, 'url must be provided');
            done();
        });

        it('sets url, path, and query', function (done) {

            var request = new Request(server, _req, _res);
            var url = 'http://localhost/page?param1=something';
            request._setUrl(url);

            expect(request.url).to.exist;
            expect(request.url.href).to.equal(url);
            expect(request.path).to.equal('/page');
            expect(request.query.param1).to.equal('something');
            done();
        });
    });

    describe('#log', function () {

        it('adds a log event to the request', function (done) {

            var request = new Request(server, _req, _res);
            request.log('1', 'log event 1');
            request.log(['2'], 'log event 2');
            request.log(['3', '4']);
            request.log(['1', '4']);
            request.log(['2', '3']);
            request.log(['4']);
            request.log('4');

            expect(request.getLog('1').length).to.equal(2);
            expect(request.getLog('4').length).to.equal(4);
            expect(request.getLog('0').length).to.equal(0);
            expect(request.getLog().length).to.be.above(7);
            done();
        });
    });
});