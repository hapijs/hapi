// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var Async = require('async');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


require('../suite').Server(function(Server, useMongo) {
    describe('Proxy', function() {

        var _server = null;
        var _serverUrl = 'http://127.0.0.1:18095';

        function setupServer(done) {
            _server = new Hapi.Server('0.0.0.0', 18095);
            _server.addRoutes([
                { method: 'GET', path: '/', config: { proxy: { host: 'google.com', port: 80 }, cache: { mode: 'client+server', expiresIn: 120000 } } }
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
    });
};