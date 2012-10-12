// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var Async = require('async');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


describe('Cache', function() {
    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18085';

    var profileHandler = function (request) {
        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    };

    var activeItemHandler = function (request) {
        request.reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    };

    function setupServer(done) {
        _server = new Hapi.Server('0.0.0.0', 18085);
        _server.addRoutes([
            { method: 'GET', path: '/profile', config: { handler: profileHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/item', config: { handler: activeItemHandler, cache: { mode: 'client', expiresIn: 120000 } } },
            { method: 'GET', path: '/item2', config: { handler: activeItemHandler, cache: { mode: 'none' } } },
            { method: 'GET', path: '/item3', config: { handler: activeItemHandler, cache: { mode: 'client', expiresIn: 120000 } } }
        ]);
        _server.listener.on('listening', function() {
            done();
        });
        _server.start();
    }

    function makeRequest(path, callback) {
        var next = function(res) {
            return callback(res);
        };

        _server.inject({
            method: 'get',
            url: _serverUrl + path
        }, next);
    }

    function parseHeaders(res) {

        var headersObj = {};
        var headers = res._header.split('\r\n');
        for (var i = 0, il = headers.length; i < il; i++) {
            var header = headers[i].split(':');
            var headerValue = header[1] ? header[1].trim() : '';
            headersObj[header[0]] = headerValue;
        }

        return headersObj;
    }

    before(setupServer);

    it('returns max-age value when route uses default cache rules', function(done) {
        makeRequest('/profile', function(rawRes) {
            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Cache-Control']).to.equal('max-age=120');
            done();
        });
    });

    it('returns max-age value when route uses client cache mode', function(done) {
        makeRequest('/profile', function(rawRes) {
            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Cache-Control']).to.equal('max-age=120');
            done();
        });
    });

    it('doesn\'t return max-age value when route is not cached', function(done) {
        makeRequest('/item2', function(rawRes) {
            var headers = parseHeaders(rawRes.raw.res);
            expect(headers['Cache-Control']).to.not.equal('max-age=120');
            done();
        });
    });
});