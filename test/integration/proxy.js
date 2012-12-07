// Load modules

var Chai = require('chai');
var Fs = require('fs');
var Request = require('request');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Proxy', function () {

    before(startServer);

    var _server = null;
    var _serverUrl = 'http://127.0.0.1:18092';

    function startServer (done) {

        var listening = false;

        var routeCache = {
            expiresIn: 500
        };

        var config = {
            cache: {
                engine: 'memory',
                host: '127.0.0.1',
                port: 6379
            }
        };

        var dummyServer = new Hapi.Server('0.0.0.0', 18093);
        dummyServer.addRoutes([
            { method: 'GET', path: '/profile', handler: profile },
            { method: 'GET', path: '/item', handler: activeItem },
            { method: 'GET', path: '/proxyerror', handler: activeItem },
            { method: 'POST', path: '/item', handler: item },
            { method: 'GET', path: '/unauthorized', handler: unauthorized },
            { method: 'POST', path: '/file', handler: streamHandler, config: { payload: 'stream' } },
            { method: 'POST', path: '/echo', handler: echoPostBody }
        ]);

        _server = new Hapi.Server('0.0.0.0', 18092, config);
        _server.addRoutes([
            { method: 'GET', path: '/profile', handler: { proxy: { host: '127.0.0.1', port: 18093, xforward: true, passThrough: true } } },
            { method: 'GET', path: '/item', handler: { proxy: { host: '127.0.0.1', port: 18093 } }, config: { cache: routeCache } },
            { method: 'GET', path: '/unauthorized', handler: { proxy: { host: '127.0.0.1', port: 18093 } }, config: { cache: routeCache } },
            { method: 'POST', path: '/item', handler: { proxy: { host: '127.0.0.1', port: 18093 } } },
            { method: 'POST', path: '/notfound', handler: { proxy: { host: '127.0.0.1', port: 18093 } } },
            { method: 'GET', path: '/proxyerror', handler: { proxy: { host: '127.0.0.1', port: 18093 } }, config: { cache: routeCache } },
            { method: 'GET', path: '/postResponseError', handler: { proxy: { host: '127.0.0.1', port: 18093, postResponse: postResponseWithError } }, config: { cache: routeCache } },
            { method: 'GET', path: '/errorResponse', handler: { proxy: { host: '127.0.0.1', port: 18093 } }, config: { cache: routeCache } },
            { method: 'POST', path: '/echo', handler: { proxy: { mapUri: mapUri } } },
            { method: 'POST', path: '/file', handler: { proxy: { host: '127.0.0.1', port: 18093 } }, config: { payload: 'stream' } },
            { method: 'GET', path: '/maperror', handler: { proxy: { mapUri: mapUriWithError } } }
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

    function mapUri (request, callback) {

        return callback(null, 'http://127.0.0.1:18093' + request.path, request.query);
    }

    function mapUriWithError (request, callback) {

        return callback(new Error('myerror'));
    }

    function profile (request) {

        request.reply({
            'id': 'fa0dbda9b1b',
            'name': 'John Doe'
        });
    }

    function activeItem (request) {

        request.reply({
            'id': '55cf687663',
            'name': 'Active Item'
        });
    }

    function item (request) {

        request.reply.payload({
            'id': '55cf687663',
            'name': 'Item'
        }).created('http://google.com').send();
    }

    function echoPostBody (request) {

        request.reply(request.payload);
    }

    function unauthorized (request) {

        request.reply(Hapi.Error.unauthorized('Not authorized'));
    }

    function postResponseWithError (request) {

        request.reply(Hapi.Error.forbidden('Forbidden'));
    }

    function postResponse (request, settings, response, payload) {

        request.reply.payload(payload).type(response.headers['content-type']).send();
    }

    function streamHandler (request) {

        console.log(request);
        request.reply('success');
    }

    function makeRequest (options, callback) {

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

    it('sends the correct status code with a request is unauthorized', function (done) {

        makeRequest({ path: '/unauthorized', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(401);
            done();
        });
    });

    it('sends a 404 status code with a proxied route doesn\'t exist', function (done) {

        makeRequest({ path: '/notfound', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(404);
            done();
        });
    });

    it('forwards on the status code when a custom postResponse returns an error', function (done) {

        makeRequest({ path: '/postResponseError', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(403);
            done();
        });
    });

    it('forwards the error message with a custom postResponse and a route error', function (done) {

        makeRequest({ path: '/postResponseNotFound', method: 'get' }, function (rawRes) {

            expect(rawRes.body).to.contain('error');
            done();
        });
    });

    it('handles an error from request safely', function (done) {

        var requestStub = function (options, callback) {

            callback(new Error());
        };

        var route = _server._match('get', '/proxyerror');
        route.proxy.httpClient = requestStub;

        makeRequest({ path: '/proxyerror', method: 'get' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(500);
            done();
        });
    });

    it('forwards on a POST body', function (done) {

        makeRequest({ path: '/echo', method: 'post', form: { echo: true } }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.contain('echo');
            done();
        });
    });

    it('replies with an error when it occurs in mapUri', function (done) {

        makeRequest({ path: '/maperror', method: 'get' }, function (rawRes) {

            expect(rawRes.body).to.contain('myerror');
            done();
        });
    });

   /* it.only('works with a stream when the proxy response is streamed', function (done) {

        Fs.createReadStream(__dirname + '/proxy.js').pipe(Request.post('http://localhost:18092/file', function (err, rawRes) {

            console.log(err);
            done();
        }));
    }); */
});