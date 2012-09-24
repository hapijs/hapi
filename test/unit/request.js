// Load modules

var expect = require('chai').expect;
var Request = require('../../lib/request');
var ServerMock = require('./mocks/server');

describe('Request', function() {
    var _req = {
        url: '/test',
        method: 'GET',
        headers: []
    };

    var _res = {};

    it('throws an error if constructed without new', function(done) {
        var fn = function() {
            var request = Request(ServerMock, null, null);
        };
        expect(fn).throws(Error, 'Request must be instantiated using new');
        done();
    });

    it('throws an error when no server is provided', function(done) {
        var fn = function() {
            var request = new Request(null, _req, _res);
        };
        expect(fn).throws(Error, 'server must be provided');
        done();
    });

    it('throws an error when no req is provided', function(done) {
        var fn = function() {
            var request = new Request(ServerMock, null, _res);
        };
        expect(fn).throws(Error, 'req must be provided');
        done();
    });

    it('throws an error when no res is provided', function(done) {
        var fn = function() {
            var request = new Request(ServerMock, _req, null);
        };
        expect(fn).throws(Error, 'res must be provided');
        done();
    });

    it('is created without error when correct parameters are provided', function(done) {
        var fn = function() {
            var request = new Request(ServerMock, _req, _res);
        };
        expect(fn).not.to.throw(Error);
        done();
    });

    describe('#_setMethod', function() {
        it('throws an error when a null method is passed in', function(done) {
            var fn = function() {
                var request = new Request(ServerMock, _req, _res);
                request._setMethod(null);
            };

            expect(fn).throws(Error, 'method must be provided');
            done();
        });

        it('changes method with a lowercase version of the value passed in', function(done) {
            var request = new Request(ServerMock, _req, _res);
            request._setMethod('GET');

            expect(request.method).to.equal('get');
            done();
        });
    });

    describe('#_setUrl', function() {
        it('throws an error when a null url is passed in', function(done) {
            var fn = function() {
                var request = new Request(ServerMock, _req, _res);
                request._setUrl(null);
            };

            expect(fn).throws(Error, 'url must be provided');
            done();
        });

        it('sets url, path, and query', function(done) {
            var request = new Request(ServerMock, _req, _res);
            var url = 'http://localhost/page?param1=something';
            request._setUrl(url);

            expect(request.url).to.exist;
            expect(request.url.href).to.equal(url);
            expect(request.path).to.equal('/page');
            expect(request.query.param1).to.equal('something');
            done();
        });
    });
});