// Load modules

var Async = require('async');
var Lab = require('lab');
var Fs = require('fs');
var Http = require('http');
var Zlib = require('zlib');
var Nipple = require('nipple');
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
    var sslServer = null;
    var timeoutServer = null;
    var upstreamSingle = null;

    before(function (done) {

        var tlsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOwIBAAJBANysie374iGH54SVcmM4vb+CjN4nVVCmL6af9XOUxTqq/50CBn+Z\nZol0XDG+OK55HTOht4CsQrAXey69ZTxgUMcCAwEAAQJAX5t5XtxkiraA/hZpqsdo\nnlKHibBs7DY0KvLeuybXlKS3ar/0Uz0OSJ1oLx3d0KDSmcdAIrfnyFuBNuBzb3/J\nEQIhAPX/dh9azhztRppR+9j8CxDg4ixJ4iZbHdK0pfnY9oIFAiEA5aV8edK31dkF\nfBXoqlOvIeuNc6WBZrYjUNspH8M+BVsCIQDZF3U6/nve81bXYXqMZwGtB4kR5LH7\nf3W2OU4wS9RfsQIhAJkNB76xX3AYqX0fpOcPyuLSeH2gynNH5JWY2vmeSBGNAiAm\nLon4E3M/IrVVvpxGRFOazKlgIsQFGAaoylDrRFYgBA==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIB0TCCAXugAwIBAgIJANGtTMK5HBUIMA0GCSqGSIb3DQEBBQUAMEQxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UECgwJaGFwaSB0ZXN0MRQwEgYDVQQD\nDAtleGFtcGxlLmNvbTAeFw0xMzA0MDQxNDQ4MDJaFw0yMzA0MDIxNDQ4MDJaMEQx\nCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UECgwJaGFwaSB0ZXN0MRQw\nEgYDVQQDDAtleGFtcGxlLmNvbTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQDcrInt\n++Ihh+eElXJjOL2/gozeJ1VQpi+mn/VzlMU6qv+dAgZ/mWaJdFwxvjiueR0zobeA\nrEKwF3suvWU8YFDHAgMBAAGjUDBOMB0GA1UdDgQWBBQBOiF6iL2PI4E6PBj071Dh\nAiQOGjAfBgNVHSMEGDAWgBQBOiF6iL2PI4E6PBj071DhAiQOGjAMBgNVHRMEBTAD\nAQH/MA0GCSqGSIb3DQEBBQUAA0EAw8Y2rpM8SUQXjgaJJmFXrfEvnl/he7q83K9W\n9Sr/QLHpCFxunWVd8c0wz+b8P/F9uW2V4wUf5NWj1UdHMCd6wQ==\n-----END CERTIFICATE-----\n'
        };

        var mapUriWithError = function (request, callback) {

            return callback(new Error('myerror'));
        };

        var profile = function (request, reply) {

            if (request.state.test) {
                return reply('error');
            }

            var profile = {
                id: 'fa0dbda9b1b',
                name: 'John Doe'
            };

            reply(profile).state('test', '123');
        };

        var activeCount = 0;
        var activeItem = function (request, reply) {

            reply({
                id: '55cf687663',
                name: 'Active Item',
                count: activeCount++
            });
        };

        var item = function (request, reply) {

            reply({
                id: '55cf687663',
                name: 'Item'
            }).created('http://example.com');
        };

        var echoPostBody = function (request, reply) {

            reply(request.payload.echo + request.raw.req.headers['x-super-special']);
        };

        var unauthorized = function (request, reply) {

            reply(Hapi.error.unauthorized('Not authorized'));
        };

        var postResponseWithError = function (request, reply, res, settings, ttl) {

            reply(Hapi.error.forbidden('Forbidden'));
        };

        var streamHandler = function (request, reply) {

            reply('success');
        };

        var forward = function (request, reply) {

            expect(request.raw.req.headers['x-forwarded-for']).to.contain('xforwardfor');
            expect(request.raw.req.headers['x-forwarded-port']).to.contain('9000');
            expect(request.raw.req.headers['x-forwarded-proto']).to.contain('xforwardproto');
            reply('Success');
        };

        var headers = function (request, reply) {

            reply({ status: 'success' })
                .header('Custom1', 'custom header value 1')
                .header('X-Custom2', 'custom header value 2')
                .header('access-control-allow-headers', 'Invalid, List, Of, Values');
        };

        var gzipHandler = function (request, reply) {

            reply('123456789012345678901234567890123456789012345678901234567890');
        };

        var gzipStreamHandler = function (request, reply) {

            reply.file(__dirname + '/../../package.json');
        };

        var redirectHandler = function (request, reply) {

            switch (request.query.x) {
                case '1': reply().redirect('/redirect?x=1'); break;
                case '2': reply().header('Location', '//localhost:' + request.server.info.port + '/profile').code(302); break;
                case '3': reply().code(302); break;
                default: reply().redirect('/profile'); break;
            }
        };

        var timeoutHandler = function (request, reply) {

            setTimeout(function () {

                reply('Ok');
            }, 10);
        };

        var sslHandler = function (request, reply) {

            reply('Ok');
        };

        var upstream = new Hapi.Server(0);
        upstream.route([
            { method: 'GET', path: '/profile', handler: profile, config: { cache: { expiresIn: 2000 } } },
            { method: 'GET', path: '/item', handler: activeItem },
            { method: 'GET', path: '/cachedItem', handler: activeItem, config: { cache: { expiresIn: 2000 } } },
            { method: 'GET', path: '/proxyerror', handler: activeItem },
            { method: 'POST', path: '/item', handler: item },
            { method: 'GET', path: '/unauthorized', handler: unauthorized },
            { method: 'POST', path: '/file', handler: streamHandler, config: { payload: { output: 'stream' } } },
            { method: 'POST', path: '/echo', handler: echoPostBody },
            { method: 'GET', path: '/headers', handler: headers },
            { method: 'GET', path: '/noHeaders', handler: headers },
            { method: 'GET', path: '/forward', handler: forward },
            { method: 'GET', path: '/gzip', handler: gzipHandler },
            { method: 'GET', path: '/gzipstream', handler: gzipStreamHandler },
            { method: 'GET', path: '/redirect', handler: redirectHandler },
            { method: 'POST', path: '/post1', handler: function (request, reply) { reply().redirect('/post2').rewritable(false); } },
            { method: 'POST', path: '/post2', handler: function (request, reply) { reply(request.payload); } },
            { method: 'GET', path: '/timeout1', handler: timeoutHandler },
            { method: 'GET', path: '/timeout2', handler: timeoutHandler },
            { method: 'GET', path: '/handlerOldSchool', handler: activeItem }
        ]);

        var upstreamSsl = new Hapi.Server(0, { tls: tlsOptions });
        upstreamSsl.route([
            { method: 'GET', path: '/', handler: sslHandler }
        ]);

        upstreamSingle = new Hapi.Server(0);
        upstreamSingle.route([
            { method: 'GET', path: '/', handler: profile }
        ]);

        var mapUri = function (request, callback) {

            return callback(null, 'http://127.0.0.1:' + upstream.info.port + request.path + (request.url.search || ''), { 'x-super-special': '@' });
        };

        var mapSslUri = function (request, callback) {

            return callback(null, 'https://127.0.0.1:' + upstreamSsl.info.port);
        };

        var mapSingleUri = function (request, callback) {

            return callback(null, 'https://127.0.0.1:' + upstreamSingle.info.port);
        };
        
        var postResponse = function (request, reply, res, settings, ttl) {

            reply(res);
        };

        upstream.start(function () {

            upstreamSsl.start(function () {

                upstreamSingle.start(function () {

                    var backendPort = upstream.info.port;
                    var routeCache = { expiresIn: 500 };

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
                        { method: 'POST', path: '/file', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { payload: { output: 'stream' } } },
                        { method: 'GET', path: '/maperror', handler: { proxy: { mapUri: mapUriWithError } } },
                        { method: 'GET', path: '/forward', handler: { proxy: { host: 'localhost', port: backendPort, xforward: true, passThrough: true } } },
                        { method: 'GET', path: '/headers', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true } } },
                        { method: 'GET', path: '/noHeaders', handler: { proxy: { host: 'localhost', port: backendPort } } },
                        { method: 'GET', path: '/gzip', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true } } },
                        { method: 'GET', path: '/gzipstream', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true } } },
                        { method: 'GET', path: '/redirect', handler: { proxy: { host: 'localhost', port: backendPort, passThrough: true, redirects: 2 } } },
                        { method: 'POST', path: '/post1', handler: { proxy: { host: 'localhost', port: backendPort, redirects: 3 } }, config: { payload: { output: 'stream' } } },
                        { method: 'GET', path: '/nowhere', handler: { proxy: { host: 'no.such.domain.x8' } } },
                        { method: 'GET', path: '/timeout1', handler: { proxy: { host: 'localhost', port: backendPort, timeout: 5 } } },
                        { method: 'GET', path: '/timeout2', handler: { proxy: { host: 'localhost', port: backendPort } } },
                        { method: 'GET', path: '/single', handler: { proxy: { mapUri: mapSingleUri } } },
                        { method: 'GET', path: '/handler', handler: function (request, reply) { reply.proxy({ uri: 'http://localhost:' + backendPort + '/item' }); } },
                        { method: 'GET', path: '/handlerTemplate', handler: function (request, reply) { reply.proxy({ uri: '{protocol}://localhost:' + backendPort + '/item' }); } },
                        { method: 'GET', path: '/handlerOldSchool', handler: function (request, reply) { reply.proxy({ host: 'localhost', port: backendPort }); } },
                        { method: 'GET', path: '/cachedItem', handler: { proxy: { host: 'localhost', port: backendPort, ttl: 'upstream' } } },
                        { method: 'GET', path: '/clientCachedItem', handler: { proxy: { uri: 'http://localhost:' + backendPort + '/cachedItem', ttl: 'upstream' } } }
                    ]);

                    sslServer = new Hapi.Server(0);
                    sslServer.route([
                        { method: 'GET', path: '/allow', handler: { proxy: { mapUri: mapSslUri, rejectUnauthorized: false } } },
                        { method: 'GET', path: '/reject', handler: { proxy: { mapUri: mapSslUri, rejectUnauthorized: true } } },
                        { method: 'GET', path: '/sslDefault', handler: { proxy: { mapUri: mapSslUri } } }
                    ]);

                    timeoutServer = new Hapi.Server(0, { timeout: { server: 5 } });
                    timeoutServer.route([
                        { method: 'GET', path: '/timeout1', handler: { proxy: { host: 'localhost', port: backendPort, timeout: 15 } } },
                        { method: 'GET', path: '/timeout2', handler: { proxy: { host: 'localhost', port: backendPort, timeout: 2 } } },
                        { method: 'GET', path: '/item', handler: { proxy: { host: 'localhost', port: backendPort } } }
                    ]);

                    server.state('auto', { autoValue: 'xyz' });
                    server.start(function () {

                        sslServer.start(function () {

                            timeoutServer.start(done);
                        });
                    });
                });
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
            expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate, private');

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
                expect(new Buffer(res.payload, 'binary')).to.deep.equal(zipped);
                done();
            });
        });
    });

    it('forwards gzipped stream', function (done) {

        server.inject({ url: '/gzipstream', headers: { 'accept-encoding': 'gzip' } }, function (res) {

            expect(res.statusCode).to.equal(200);

            Fs.readFile(__dirname + '/../../package.json', { encoding: 'utf8' }, function (err, file) {

                Zlib.unzip(new Buffer(res.payload, 'binary'), function (err, unzipped) {

                    expect(err).to.not.exist;
                    expect(unzipped.toString('utf8')).to.deep.equal(file);
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

    it('request a cached proxy route', function (done) {

        server.inject('/item', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('Active Item');
            var counter = res.result.count;

            server.inject('/item', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result.count).to.equal(counter);
                done();
            });
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

    it('sends a 404 status code with a proxied route does not exist', function (done) {

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

    it('maxs out redirects to another endpoint', function (done) {

        server.inject('/redirect?x=1', function (res) {

            expect(res.statusCode).to.equal(502);
            done();
        });
    });

    it('errors on redirect missing location header', function (done) {

        server.inject('/redirect?x=3', function (res) {

            expect(res.statusCode).to.equal(502);
            done();
        });
    });

    it('errors on redirection to bad host', function (done) {

        server.inject('/nowhere', function (res) {

            expect(res.statusCode).to.equal(502);
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

    it('redirects to another endpoint with relative location', function (done) {

        server.inject('/redirect?x=2', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('John Doe');
            expect(res.headers['set-cookie']).to.deep.equal(['test=123', 'auto=xyz']);
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

    it('errors when proxied request times out', function (done) {

        server.inject('/timeout1', function (res) {

            expect(res.statusCode).to.equal(504);
            done();
        });
    });

    it('uses default timeout when nothing is set', function (done) {

        server.inject('/timeout2', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('uses rejectUnauthorized to allow proxy to self signed ssl server', function (done) {

        sslServer.inject('/allow', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('Ok');
            done();
        });
    });

    it('uses rejectUnauthorized to not allow proxy to self signed ssl server', function (done) {

        sslServer.inject('/reject', function (res) {

            expect(res.statusCode).to.equal(502);
            done();
        });
    });

    it('the default rejectUnauthorized should not allow proxied server cert to be self signed', function (done) {

        sslServer.inject('/sslDefault', function (res) {

            expect(res.statusCode).to.equal(502);
            done();
        });
    });

    it('times out when proxy timeout is less than server', function (done) {

        timeoutServer.inject('/timeout2', function (res) {

            expect(res.statusCode).to.equal(504);
            done();
        });
    });

    it('times out when server timeout is less than proxy', function (done) {

        timeoutServer.inject('/timeout1', function (res) {

            expect(res.statusCode).to.equal(503);
            done();
        });
    });

    it('proxies via reply.proxy()', function (done) {

        server.inject('/handler', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('Active Item');
            var counter = res.result.count;
            done();
        });
    });

    it('proxies via reply.proxy() with uri tempalte', function (done) {

        server.inject('/handlerTemplate', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('Active Item');
            var counter = res.result.count;
            done();
        });
    });

    it('proxies via reply.proxy() with individual options', function (done) {

        server.inject('/handlerOldSchool', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('Active Item');
            var counter = res.result.count;
            done();
        });
    });

    it('passes upstream caching headers', function (done) {

        server.inject('/cachedItem', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('max-age=2, must-revalidate, private');
            done();
        });
    });
});

