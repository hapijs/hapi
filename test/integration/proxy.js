// Load modules

var expect = require('chai').expect;
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');
var Request = require('request');

describe('Proxy', function () {

    before(startServer);

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18092';

    function startServer(done) {

        var listening = false;

        var routeCache = {
            expiresIn: 500
        };

        config = {
            cache: {
                engine: 'memory',
                host: '127.0.0.1',
                port: 6379
            }
        };

        var dummyServer = new Hapi.Server('0.0.0.0', 18093);
        dummyServer.addRoutes([{ method: 'GET', path: '/profile', config: { handler: profile } },
            { method: 'GET', path: '/item', config: { handler: activeItem } },
            { method: 'POST', path: '/item', config: { handler: item } },
            { method: 'GET', path: '/unauthorized', config: { handler: unauthorized }},
            { method: 'POST', path: '/echo', config: { handler: echoPostBody } }
        ]);

        _server = new Hapi.Server('0.0.0.0', 18092, config);
        _server.addRoutes([
            { method: 'GET', path: '/profile', config: { proxy: { host: '127.0.0.1', port: 18093, xforward: true, passThrough: true } } },
            { method: 'GET', path: '/item', config: { proxy: { host: '127.0.0.1', port: 18093 }, cache: routeCache } },
            { method: 'GET', path: '/unauthorized', config: { proxy: { host: '127.0.0.1', port: 18093 }, cache: routeCache } },
            { method: 'POST', path: '/item', config: { proxy: { host: '127.0.0.1', port: 18093 } } },
            { method: 'POST', path: '/notfound', config: { proxy: { host: '127.0.0.1', port: 18093 } } },
            { method: 'GET', path: '/postResponseError', config: { proxy: { host: '127.0.0.1', port: 18093, postResponse: postResponseWithError }, cache: routeCache } },
            { method: 'POST', path: '/echo', config: { proxy: { mapUri: mapUri } } }
        ]);

        dummyServer.listener.on('listening', function () {
            if (listening) {
                done();
            }
            else {
                listening = true;
            }
        });
        _server.listener.on('listening', function () {
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

    function mapUri(request, callback) {

        return callback(null, 'http://127.0.0.1:18093' + request.path, request.query);
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

    function echoPostBody(request) {

        request.reply(request.payload);
    }

    function unauthorized(request) {

        request.reply(Hapi.Error.unauthorized('Not authorized'));
    }

    function postResponseWithError(request) {

        request.reply(Hapi.Error.forbidden('Forbidden'));
    }

    function postResponse(request, settings, response, payload) {

        request.reply.type(response.headers['content-type']);
        request.reply(payload);
    }

    function makeRequest(options, callback) {

        var next = function (err, res) {
            return callback(res);
        };

        options = options || {};
        options.path = options.path || '/';
        options.method = options.method || 'get';

        Request({
            method: options.method,
            url: _serverUrl + options.path,
            form: options.form
        }, next);
    }

    it('forwards on the response when making a GET request', function (done) {

        makeRequest({ path: '/profile' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.contain('John Doe');
            done();
        });
    });

    it('forwards on the response when making a GET request to a route that also accepts a POST', function (done) {

        makeRequest({ path: '/item' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.contain('Active Item');
            done();
        });
    });

    it('forwards on the status code when making a POST request', function (done) {

        makeRequest({ path: '/item', method: 'post' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(201);
            expect(rawRes.body).to.contain('Item');
            done();
        });
    });

    it('sends the correct status code with a request is unauthorized', function(done) {

        makeRequest({ path: '/unauthorized', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(401);
            done();
        });
    });

    it('sends a 404 status code with a proxied route doesn\'t exist', function(done) {

        makeRequest({ path: '/notfound', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(404);
            done();
        });
    });

    it('forwards on the status code when a custom postResponse returns an error', function(done) {

        makeRequest({ path: '/postResponseError', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(403);
            done();
        });
    });

    it('forwards the error message with a custom postResponse and a route error', function(done) {

        makeRequest({ path: '/postResponseNotFound', method: 'get' }, function (rawRes) {

            expect(rawRes.body).to.contain('error');
            done();
        });
    });

    it('forwards on a POST body', function(done) {

        makeRequest({ path: '/echo', method: 'post', form: { echo: true } }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.contain('echo');
            done();
        });
    });
});