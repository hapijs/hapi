// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var Async = require('async');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');

describe('Proxy', function() {

    before(startServer);

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18099';

    function startServer(done) {

        _server = new Hapi.Server('0.0.0.0', 18099);
        _server.addRoutes([
            { method: 'GET', path: '/', config: { proxy: { host: 'google.com', port: 80 } } },
            { method: 'POST', path: '/', config: { proxy: { host: 'google.com', port: 80 } } }
        ]);
        _server.listener.on('listening', function() {
            done();
        });
        _server.start();
    }

    function makeRequest(options, callback) {
        var next = function(res) {
            return callback(res);
        };

        options = options || {};
        options.path = options.path || '/';
        options.method = options.method || 'get';

        _server.inject({
            method: options.method,
            url: _serverUrl + options.path
        }, next);
    }

    it('forwards on the response when making a GET request', function(done) {
        this.timeout(4000);
        makeRequest(null, function(rawRes) {
            expect(rawRes.statusCode).to.equal(200);
            done();
        });
    });

    it('forwards on the response when making a POST request', function(done) {
        makeRequest({ method: 'post' }, function(rawRes) {
            expect(rawRes.statusCode).to.equal(405);
            done();
        });
    });
});