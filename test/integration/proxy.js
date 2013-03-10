// Load modules

var Lab = require('lab');
var Fs = require('fs');
var Request = require('request');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Proxy', function () {

    var server = null;

    before(function (done) {

        // Define backend handlers

        var mapUriWithError = function (request, callback) {

            return callback(new Error('myerror'));
        }

        var profile = function () {

            this.reply({
                'id': 'fa0dbda9b1b',
                'name': 'John Doe'
            });
        }

        var activeItem = function () {

            this.reply({
                'id': '55cf687663',
                'name': 'Active Item'
            });
        }

        var item = function () {

            this.reply.payload({
                'id': '55cf687663',
                'name': 'Item'
            }).created('http://google.com').send();
        }

        var echoPostBody = function () {

            this.reply(this.payload);
        }

        var unauthorized = function () {

            this.reply(Hapi.error.unauthorized('Not authorized'));
        }

        var postResponseWithError = function (request) {

            request.reply(Hapi.error.forbidden('Forbidden'));
        }

        var postResponse = function (request, settings, response, payload) {

            request.reply.payload(payload).type(response.headers['content-type']).send();
        }

        var streamHandler = function () {

            this.reply('success');
        }

        var backendServer = new Hapi.Server(0);
        backendServer.route([
            { method: 'GET', path: '/profile', handler: profile },
            { method: 'GET', path: '/item', handler: activeItem },
            { method: 'GET', path: '/proxyerror', handler: activeItem },
            { method: 'POST', path: '/item', handler: item },
            { method: 'GET', path: '/unauthorized', handler: unauthorized },
            { method: 'POST', path: '/file', handler: streamHandler, config: { payload: 'stream' } },
            { method: 'POST', path: '/echo', handler: echoPostBody }
        ]);

        var mapUri = function (request, callback) {

            return callback(null, backendServer.settings.uri + request.path + (request.url.search || ''));
        };

        backendServer.start(function () {

            var backendPort = backendServer.settings.port;
            var routeCache = { expiresIn: 500 };

            server = new Hapi.Server(0, { cache: { engine: 'memory' } });
            server.route([
                { method: 'GET', path: '/profile', handler: { proxy: { host: 'localhost', port: backendPort, xforward: true, passThrough: true } } },
                { method: 'GET', path: '/item', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { cache: routeCache } },
                { method: 'GET', path: '/unauthorized', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { cache: routeCache } },
                { method: 'POST', path: '/item', handler: { proxy: { host: 'localhost', port: backendPort } } },
                { method: 'POST', path: '/notfound', handler: { proxy: { host: 'localhost', port: backendPort } } },
                { method: 'GET', path: '/proxyerror', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { cache: routeCache } },
                { method: 'GET', path: '/postResponseError', handler: { proxy: { host: 'localhost', port: backendPort, postResponse: postResponseWithError } }, config: { cache: routeCache } },
                { method: 'GET', path: '/errorResponse', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { cache: routeCache } },
                { method: 'POST', path: '/echo', handler: { proxy: { mapUri: mapUri } } },
                { method: 'POST', path: '/file', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { payload: 'stream' } },
                { method: 'GET', path: '/maperror', handler: { proxy: { mapUri: mapUriWithError } } }
            ]);

            server.start(function () {

                done();
            });
        });
    });

    function makeRequest (options, callback) {

        var next = function (err, res) {

            return callback(res);
        };

        options = options || {};
        options.path = options.path || '/';
        options.method = options.method || 'get';

        Request({
            method: options.method,
            url: server.settings.uri + options.path,
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

        var route = server._router.route({ method: 'get', path: '/proxyerror', raw: { req: { headers: {} } } });
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

    it('works with a stream when the proxy response is streamed', function (done) {

        Fs.createReadStream(__dirname + '/proxy.js').pipe(Request.post(server.settings.uri + '/file', function (err, rawRes, body) {

            expect(rawRes.statusCode).to.equal(200);
            done();
        }));
    }); 
});