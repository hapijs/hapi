// Load modules

var Async = require('async');
var Lab = require('lab');
var Fs = require('fs');
var Http = require('http');
var Zlib = require('zlib');
var Hapi = require('../..');
var Client = require('../../lib/client');


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

        var profile = function () {

            if (this.state.test) {
                return this.reply('error');
            }

            var profile = {
                id: 'fa0dbda9b1b',
                name: 'John Doe'
            };

            this.reply(profile).state('test', '123');
        };

        var activeCount = 0;
        var activeItem = function () {

            this.reply({
                id: '55cf687663',
                name: 'Active Item',
                count: activeCount++
            });
        };

        var item = function () {

            this.reply({
                id: '55cf687663',
                name: 'Item'
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

        var redirectHandler = function () {

            switch (this.query.x) {
                case '1': this.reply.redirect('/redirect?x=1'); break;
                case '2': this.reply().header('Location', '//localhost:' + this.server.info.port + '/profile').code(302); break;
                case '3': this.reply().code(302); break;
                default: this.reply.redirect('/profile'); break;
            }
        };

        var timeoutHandler = function (req) {

            setTimeout(function () {

                req.reply('Ok');
            }, 10);
        };

        var sslHandler = function (req) {

            req.reply('Ok');
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
            { method: 'GET', path: '/redirect', handler: redirectHandler },
            { method: 'POST', path: '/post1', handler: function () { this.reply.redirect('/post2').rewritable(false); } },
            { method: 'POST', path: '/post2', handler: function () { this.reply(this.payload); } },
            { method: 'GET', path: '/cached', handler: profile },
            { method: 'GET', path: '/timeout1', handler: timeoutHandler },
            { method: 'GET', path: '/timeout2', handler: timeoutHandler }
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

        upstream.start(function () {

            upstreamSsl.start(function () {

                upstreamSingle.start(function () {

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
                        { method: 'POST', path: '/post1', handler: { proxy: { host: 'localhost', port: backendPort, redirects: 3 } }, config: { payload: 'stream' } },
                        { method: 'GET', path: '/nowhere', handler: { proxy: { host: 'no.such.domain.x8' } } },
                        { method: 'GET', path: '/cached', handler: { proxy: { host: 'localhost', port: backendPort } }, config: { cache: routeCache } },
                        { method: 'GET', path: '/timeout1', handler: { proxy: { host: 'localhost', port: backendPort, timeout: 5 } } },
                        { method: 'GET', path: '/timeout2', handler: { proxy: { host: 'localhost', port: backendPort } } },
                        { method: 'GET', path: '/single', handler: { proxy: { mapUri: mapSingleUri } } }
                    ]);

                    sslServer = new Hapi.Server(0);
                    sslServer.route([
                        { method: 'GET', path: '/allow', handler: { proxy: { mapUri: mapSslUri, rejectUnauthorized: false } } },
                        { method: 'GET', path: '/reject', handler: { proxy: { mapUri: mapSslUri, rejectUnauthorized: true } } },
                        { method: 'GET', path: '/sslDefault', handler: { proxy: { mapUri: mapSslUri } } }
                    ]);

                    timeoutServer = new Hapi.Server(0, { timeout: { server: 5 }});
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

            Fs.readFile(__dirname + '/../../package.json', { encoding: 'utf-8' }, function (err, file) {

                Zlib.unzip(new Buffer(res.payload, 'binary'), function (err, unzipped) {

                    expect(err).to.not.exist;
                    expect(unzipped.toString('utf-8')).to.deep.equal(file);
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

    it('maxs out redirects to another endpoint', function (done) {

        server.inject('/redirect?x=1', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('errors on redirect missing location header', function (done) {

        server.inject('/redirect?x=3', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('errors on redirection to bad host', function (done) {

        server.inject('/nowhere', function (res) {

            expect(res.statusCode).to.equal(500);
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

    it('errors on invalid response stream', function (done) {

        var orig = Client.parse;
        Client.parse = function (res, callback) {

            Client.parse = orig;
            callback(Hapi.error.internal('Fake error'));
        };

        server.inject('/cached', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('errors when proxied request times out', function (done) {

        server.inject('/timeout1', function (res) {

            expect(res.statusCode).to.equal(500);
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

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('the default rejectUnauthorized should not allow proxied server cert to be self signed', function (done) {

        sslServer.inject('/sslDefault', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('doesn\'t consume all sockets when server times out before proxy', function (done) {

        var wrappedReq = function (next) {

            timeoutServer.inject('/timeout1', next);
        };

        Async.series([
            wrappedReq,
            wrappedReq,
            wrappedReq,
            wrappedReq,
            wrappedReq,
            wrappedReq,
            wrappedReq
        ], function () {

            timeoutServer.inject('/item', function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('times out when proxy timeout is less than server', function (done) {

        timeoutServer.inject('/timeout2', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('times out when server timeout is less than proxy', function (done) {

        timeoutServer.inject('/timeout1', function (res) {

            expect(res.statusCode).to.equal(503);
            done();
        });
    });

    it('handles an error from the downstream response by closing proxy request', function (done) {

        var client = Http.get('http://127.0.0.1:' + server.info.port + '/profile', function (res) {

            res.on('data', function () {});
        });

        client.once('socket', function () {

            client.socket.write('GET /profile HTTP/1.1\r\n\r\n');
            setImmediate(function () {

                client.socket.destroySoon();
            });

        });

        client.once('error', function () {

            done();
        });
    });
});

