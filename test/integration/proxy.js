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
        };

        var profile = function () {

            this.reply({
                'id': 'fa0dbda9b1b',
                'name': 'John Doe'
            });
        };

        var activeItem = function () {

            this.reply({
                'id': '55cf687663',
                'name': 'Active Item'
            });
        };

        var item = function () {

            this.reply.payload({
                'id': '55cf687663',
                'name': 'Item'
            }).created('http://google.com').send();
        };

        var echoPostBody = function () {

            this.reply(this.payload);
        };

        var unauthorized = function () {

            this.reply(Hapi.error.unauthorized('Not authorized'));
        };

        var postResponseWithError = function (request) {

            request.reply(Hapi.error.forbidden('Forbidden'));
        };

        var streamHandler = function () {

            this.reply('success');
        };

        var forward = function () {

            expect(this.raw.req.headers['x-forwarded-for']).to.contain('xforwardfor');
            expect(this.raw.req.headers['x-forwarded-port']).to.contain('9000');
            expect(this.raw.req.headers['x-forwarded-proto']).to.contain('xforwardproto');
            this.reply('Success');
        };

        var headers = function () {

            this.reply.payload({ status: 'success' })
                      .header('Custom1', 'custom header value 1')
                      .header('X-Custom2', 'custom header value 2')
                      .header('access-control-allow-headers', 'Invalid, List, Of, Values')
                      .send();
        };

        var backendServer = new Hapi.Server(0);
        backendServer.route([
            { method: 'GET', path: '/profile', handler: profile },
            { method: 'GET', path: '/item', handler: activeItem },
            { method: 'GET', path: '/proxyerror', handler: activeItem },
            { method: 'POST', path: '/item', handler: item },
            { method: 'GET', path: '/unauthorized', handler: unauthorized },
            { method: 'POST', path: '/file', handler: streamHandler, config: { payload: 'stream' } },
            { method: 'POST', path: '/echo', handler: echoPostBody },
            { method: 'GET', path: '/headers', handler: headers },
            { method: 'GET', path: '/noHeaders', handler: headers },
            { method: 'GET', path: '/forward', handler: forward }
        ]);

        var mapUri = function (request, callback) {

            return callback(null, backendServer.settings.uri + request.path + (request.url.search || ''));
        };

        backendServer.start(function () {

            var backendPort = backendServer.settings.port;
            var routeCache = { expiresIn: 500 };

            server = new Hapi.Server(0, { cors: true, cache: { engine: 'memory' } });
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
                { method: 'GET', path: '/maperror', handler: { proxy: { mapUri: mapUriWithError } } },
                { method: 'GET', path: '/forward', handler: { proxy: { host: 'localhost', port: backendPort, xforward: true, passThrough: true } } },
                { method: 'GET', path: '/headers', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true } } },
                { method: 'GET', path: '/noHeaders', handler: { proxy: { host: 'localhost', port: backendPort } } }
            ]);

            server.start(function () {

                done();
            });
        });
    });

    function makeRequest(options, callback) {

        var next = function (err, res) {

            return callback(res);
        };

        options = options || {};
        options.path = options.path || '/';
        options.method = options.method || 'get';

        Request({
            method: options.method,
            url: server.settings.uri + options.path,
            form: options.form,
            headers: options.headers
        }, next);
    }

    it('forwards on the response when making a GET request', function (done) {

        makeRequest({ path: '/profile' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.contain('John Doe');
            done();
        });
    });

    it('forwards on x-forward headers', function (done) {

        makeRequest({ path: '/forward', headers: { 'x-forwarded-for': 'xforwardfor', 'x-forwarded-port': '9000', 'x-forwarded-proto': 'xforwardproto' } }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.equal('Success');
            done();
        });
    });

    it('forwards upstream headers', function (done) {

        server.inject({ url: '/headers', method: 'GET' }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('{\"status\":\"success\"}');
            expect(res.headers.custom1).to.equal('custom header value 1');
            expect(res.headers['x-custom2']).to.equal('custom header value 2');
            expect(res.headers['access-control-allow-headers']).to.equal('Authorization, Content-Type, If-None-Match');
            done();
        });
    });

    it('does not forward upstream headers without passThrough', function (done) {

        makeRequest({ path: '/noHeaders' }, function (rawRes) {

            expect(rawRes.statusCode).to.equal(200);
            expect(rawRes.body).to.equal('{\"status\":\"success\"}');
            expect(rawRes.headers.custom1).to.not.exist;
            expect(rawRes.headers['x-custom2']).to.not.exist;
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

    it('can add a proxy route with a http protocol set', function (done) {

        server.route({ method: 'GET', path: '/httpport', handler: { proxy: { host: 'localhost', protocol: 'http' } } });
        done();
    });

    it('can add a proxy route with a https protocol set', function (done) {

        server.route({ method: 'GET', path: '/httpsport', handler: { proxy: { host: 'localhost', protocol: 'https' } } });
        done();
    });
});