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
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
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
                        { method: 'GET', path: '/item', handler: { proxy: { host: 'localhost', port: backendPort, protocol: 'http:' } }, config: { cache: routeCache } },
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

