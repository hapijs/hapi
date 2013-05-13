// Load modules

var Lab = require('lab');
var Fs = require('fs');
var Zlib = require('zlib');
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

        var mapUriWithError = function (request, callback) {

            return callback(new Error('myerror'));
        };

        var profile = function () {

            if (this.state.test) {
                return this.reply('error');
            }

            var profile = {
                'id': 'fa0dbda9b1b',
                'name': 'John Doe'
            };

            this.reply(profile).state('test', '123');
        };

        var activeItem = function () {

            this.reply({
                'id': '55cf687663',
                'name': 'Active Item'
            });
        };

        var item = function () {

            this.reply({
                'id': '55cf687663',
                'name': 'Item'
            }).created('http://example.com');
        };

        var echoPostBody = function () {

            this.reply(this.payload.echo + this.raw.req.headers['x-super-special']);
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

            this.reply({ status: 'success' })
                .header('Custom1', 'custom header value 1')
                .header('X-Custom2', 'custom header value 2')
                .header('access-control-allow-headers', 'Invalid, List, Of, Values');
        };

        var gzipHandler = function () {

            this.reply('123456789012345678901234567890123456789012345678901234567890');
        };

        var gzipStreamHandler = function () {

            this.reply(new Hapi.response.File(__dirname + '/../../package.json'));
        };

        var upstream = new Hapi.Server(0);
        upstream.route([
            { method: 'GET', path: '/profile', handler: profile },
            { method: 'GET', path: '/item', handler: activeItem },
            { method: 'GET', path: '/proxyerror', handler: activeItem },
            { method: 'POST', path: '/item', handler: item },
            { method: 'GET', path: '/unauthorized', handler: unauthorized },
            { method: 'POST', path: '/file', handler: streamHandler, config: { payload: 'stream' } },
            { method: 'POST', path: '/echo', handler: echoPostBody },
            { method: 'GET', path: '/headers', handler: headers },
            { method: 'GET', path: '/noHeaders', handler: headers },
            { method: 'GET', path: '/forward', handler: forward },
            { method: 'GET', path: '/gzip', handler: gzipHandler },
            { method: 'GET', path: '/gzipstream', handler: gzipStreamHandler },
            { method: 'GET', path: '/redirect', handler: function () { this.reply.redirect(this.query.x ? '/redirect?x=1' : '/profile'); } },
            { method: 'POST', path: '/post1', handler: function () { this.reply.redirect('/post2').rewritable(false); } },
            { method: 'POST', path: '/post2', handler: function () { this.reply(this.payload); } }
        ]);

        var mapUri = function (request, callback) {

            return callback(null, upstream.info.uri + request.path + (request.url.search || ''), { 'x-super-special': '@' });
        };

        upstream.start(function () {

            var backendPort = upstream.info.port;
            var routeCache = { expiresIn: 500, mode: 'server+client' };

            server = new Hapi.Server(0, { cors: true, maxSockets: 10 });
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
                { method: 'GET', path: '/noHeaders', handler: { proxy: { host: 'localhost', port: backendPort } } },
                { method: 'GET', path: '/gzip', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true } } },
                { method: 'GET', path: '/gzipstream', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true } } },
                { method: 'GET', path: '/google', handler: { proxy: { mapUri: function (request, callback) { callback(null, 'http://www.google.com'); } } } },
                { method: 'GET', path: '/googler', handler: { proxy: { mapUri: function (request, callback) { callback(null, 'http://google.com'); }, redirects: 1 } } },
                { method: 'GET', path: '/redirect', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true, redirects: 2 } } },
                { method: 'POST', path: '/post1', handler: { proxy: { host: 'localhost', port: backendPort, redirects: 10 } }, config: { payload: 'parse' } }
            ]);

            server.state('auto', { autoValue: 'xyz' });
            server.start(function () {

                done();
            });
        });
    });

    it('can add a proxy route with a http protocol set', function (done) {

        server.route({ method: 'GET', path: '/httpport', handler: { proxy: { host: 'localhost', protocol: 'http' } } });
        done();
    });

    it('can add a proxy route with a https protocol set', function (done) {

        server.route({ method: 'GET', path: '/httpsport', handler: { proxy: { host: 'localhost', protocol: 'https' } } });
        done();
    });

    it('forwards on the response when making a GET request', function (done) {

        server.inject('/profile', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('John Doe');
            expect(res.headers['set-cookie']).to.deep.equal(['test=123', 'auto=xyz']);

            server.inject('/profile', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('John Doe');
                done();
            });
        });
    });

    it('forwards on x-forward headers', function (done) {

        server.inject({ url: '/forward', headers: { 'x-forwarded-for': 'xforwardfor', 'x-forwarded-port': '9000', 'x-forwarded-proto': 'xforwardproto' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('Success');
            done();
        });
    });

    it('forwards upstream headers', function (done) {

        server.inject('/headers', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('{\"status\":\"success\"}');
            expect(res.headers.custom1).to.equal('custom header value 1');
            expect(res.headers['x-custom2']).to.equal('custom header value 2');
            expect(res.headers['access-control-allow-headers']).to.equal('Authorization, Content-Type, If-None-Match');
            expect(res.headers['access-control-expose-headers']).to.equal('WWW-Authenticate, Server-Authorization');
            done();
        });
    });

    it('forwards gzipped content', function (done) {

        Zlib.gzip(new Buffer('123456789012345678901234567890123456789012345678901234567890'), function (err, zipped) {

            expect(err).to.not.exist;

            server.inject({ url: '/gzip', headers: { 'accept-encoding': 'gzip' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.rawPayload).to.deep.equal(zipped);
                done();
            });
        });
    });

    it('forwards gzipped stream', function (done) {

        server.inject({ url: '/gzipstream', headers: { 'accept-encoding': 'gzip' } }, function (res) {

            expect(res.statusCode).to.equal(200);

            Fs.readFile(__dirname + '/../../package.json', function (err, file) {

                Zlib.gzip(file, function (err, zipped) {

                    expect(zipped.toString()).to.equal(res.payload);
                    done();
                });
            });
        });
    });

    it('does not forward upstream headers without passThrough', function (done) {

        server.inject('/noHeaders', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('{\"status\":\"success\"}');
            expect(res.headers.custom1).to.not.exist;
            expect(res.headers['x-custom2']).to.not.exist;
            done();
        });
    });

    it('forwards on the response when making a GET request to a route that also accepts a POST', function (done) {

        server.inject('/item', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('Active Item');
            done();
        });
    });

    it('forwards on the status code when making a POST request', function (done) {

        server.inject({ url: '/item', method: 'POST' }, function (res) {

            expect(res.statusCode).to.equal(201);
            expect(res.payload).to.contain('Item');
            done();
        });
    });

    it('sends the correct status code with a request is unauthorized', function (done) {

        server.inject('/unauthorized', function (res) {

            expect(res.statusCode).to.equal(401);
            done();
        });
    });

    it('sends a 404 status code with a proxied route doesn\'t exist', function (done) {

        server.inject('/notfound', function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('forwards on the status code when a custom postResponse returns an error', function (done) {

        server.inject('/postResponseError', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('forwards the error message with a custom postResponse and a route error', function (done) {

        server.inject('/postResponseNotFound', function (res) {

            expect(res.payload).to.contain('error');
            done();
        });
    });

    it('forwards on a POST body', function (done) {

        server.inject({ url: '/echo', method: 'POST', payload: '{"echo":true}' }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('true@');
            done();
        });
    });

    it('replies with an error when it occurs in mapUri', function (done) {

        server.inject('/maperror', function (res) {

            expect(res.payload).to.contain('myerror');
            done();
        });
    });

    it('works with a stream when the proxy response is streamed', function (done) {

        Fs.createReadStream(__dirname + '/proxy.js').pipe(Request.post(server.info.uri + '/file', function (err, res, body) {

            expect(res.statusCode).to.equal(200);
            done();
        }));
    });

    it('proxies to a remote site', function (done) {

        server.inject('/google', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('proxies to a remote site with redirects', function (done) {

        server.inject('/googler', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('redirects to another endpoint', function (done) {

        server.inject('/redirect', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('John Doe');
            expect(res.headers['set-cookie']).to.deep.equal(['test=123', 'auto=xyz']);
            done();
        });
    });

    it('maxs out redirects to another endpoint', function (done) {

        server.inject('/redirect?x=1', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('redirects to a post endpoint with stream', function (done) {

        server.inject({ method: 'POST', url: '/post1', payload: 'test', headers: { 'content-type': 'text/plain' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('test');
            done();
        });
    });
});