// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var Async = require('async');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


require('../suite')(function(useRedis) {
    describe('Proxy', function() {

        var _server = null;
        var _serverUrl = 'http://127.0.0.1:18099';

        before(function(done) {

            this.timeout(4000);
            var config = {};
            var routeCache = {};
            if (useRedis) {
                config.cache = 'redis';
                routeCache.mode = 'server+client';
                routeCache.expiresIn = 3000;
            }

            _server = new Hapi.Server('0.0.0.0', 18099, config);
            _server.addRoutes([
                { method: 'GET', path: '/', config: { proxy: { host: 'google.com', port: 80 }, cache: routeCache } },
                { method: 'POST', path: '/', config: { proxy: { host: 'google.com', port: 80 } } }
            ]);
            _server.listener.on('listening', function() {
                done();
            });
            _server.start();
        });

        function makeRequest(options, callback) {
            var next = function(res) {
                return callback(res);
            };

            options.method = options.method || 'get';

            _server.inject({
                method: options.method,
                url: _serverUrl + options.path
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

        it('forwards on the response when making a GET request', function(done) {
            makeRequest({ path: '/' }, function(rawRes) {
                expect(rawRes.result).to.contain('Google Search');
                done();
            });
        });

        it('forwards on the response when making a POST request', function(done) {
            makeRequest({ path: '/', method: 'post' }, function(rawRes) {
                expect(rawRes.statusCode).to.equal(405);
                done();
            });
        });
    });
});