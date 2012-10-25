// Load modules

var expect = require('chai').expect;
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');
var Request = require('request');

describe('Proxy', function() {

    before(startServer);

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18092';

    function startServer(done) {

        var listening = false;
        var dummyServer = new Hapi.Server('0.0.0.0', 18093);
        dummyServer.addRoutes([{ method: 'GET', path: '/profile', config: { handler: profile } },
            { method: 'GET', path: '/item', config: { handler: activeItem } },
            { method: 'POST', path: '/item', config: { handler: item } }]);

        _server = new Hapi.Server('0.0.0.0', 18092);
        _server.addRoutes([
            { method: 'GET', path: '/profile', config: { proxy: { host: '127.0.0.1', port: 18093, xforward: true, passThrough: true } } },
            { method: 'POST', path: '/item', config: { proxy: { host: '127.0.0.1', port: 18093 } } }
        ]);

        dummyServer.listener.on('listening', function() {
            if (listening) {
                done();
            }
            else {
                listening = true;
            }
        });
        _server.listener.on('listening', function() {
            if (listening) {
                done();
            }
            else {
                listening = true;
            }
        });

        dummyServer.start();
        _server.start();
    }

    function profile(request) {
        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    }

    function activeItem(request) {
        request.reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    }

    function item(request) {
        request.reply.created('http://google.com')({
            'id': '55cf687663',
            'name': 'Item'
        });
    }

    function makeRequest(options, callback) {
        var next = function(err, res) {
            return callback(res);
        };

        options = options || {};
        options.path = options.path || '/';
        options.method = options.method || 'get';

       Request({
            method: options.method,
            url: _serverUrl + options.path
        }, next);
    }

    it('forwards on the response when making a GET request', function(done) {
        makeRequest({ path: '/profile' }, function(rawRes) {
            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.contain('John Doe');
            done();
        });
    });

    it('forwards on the status code when making a POST request', function(done) {
        makeRequest({ path: '/item', method: 'post' }, function(rawRes) {
            expect(rawRes.statusCode).to.equal(201);
            expect(rawRes.body).to.contain('Item');
            done();
        });
    });
});