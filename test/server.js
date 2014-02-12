// Load modules

var Net = require('net');
var Fs = require('fs');
var Https = require('https');
var Lab = require('lab');
var Hapi = require('..');
var Path = require('path');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Server', function () {

    it('calls start twice', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            server.start(function () {

                server.stop(function () {

                    done();
                });
            });
        });
    });

    it('won\'t stop until all connections are closed', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();
            socket1.on('error', function () { });
            socket2.on('error', function () { });

            socket1.connect(server.info.port, '127.0.0.1', function () {

                socket2.connect(server.info.port, '127.0.0.1', function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);

                        server.stop(function () {

                            server.listener.getConnections(function (err, count) {

                                expect(count).to.equal(0);
                                done();
                            });
                        });

                        socket1.end();
                        socket2.end();
                    });
                });
            });
        });
    });

    it('won\'t destroy connections until after the timeout', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket2.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket1.connect(server.info.port, server.settings.host, function () {

                socket2.connect(server.info.port, server.settings.host, function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);
                        var timer = new Hapi.utils.Bench();

                        server.stop({ timeout: 20 }, function () {

                            expect(timer.elapsed()).to.be.at.least(19);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('won\'t destroy connections if they close by themselves', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket2.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket1.connect(server.info.port, server.settings.host, function () {

                socket2.connect(server.info.port, server.settings.host, function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);
                        var timer = new Hapi.utils.Bench();

                        server.stop(function () {

                            server.listener.getConnections(function (err, count) {

                                expect(count).to.equal(0);
                                expect(timer.elapsed()).to.be.at.least(9);
                                done();
                            });
                        });

                        setTimeout(function () {

                            socket1.end();
                            socket2.end();
                        }, 10);
                    });
                });
            });
        });
    });

    it('removes connection event listeners after it stops', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            server.stop(function () {

                server.start(function () {

                    server.stop(function () {

                        expect(server.listeners('connection').length).to.be.eql(0);
                        done();
                    });
                });
            });
        });
    });

    it('provisions a server cache', function (done) {

        var server = new Hapi.Server(0);
        var cache = server.cache('test', { expiresIn: 1000 });
        server.start(function () {

            cache.set('a', 'going in', 0, function (err) {

                cache.get('a', function (err, value) {

                    expect(value.item).to.equal('going in');

                    server.stop(function () {

                        done();
                    });
                });
            });
        });
    });

    it('measures loop delay', function (done) {

        var server = new Hapi.Server(0, { load: { sampleInterval: 4 } });
        var handler = function (request, reply) {

            var start = Date.now();
            while (Date.now() - start < 5);
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.start(function (err) {

            server.inject('/', function (res) {

                expect(server.load.eventLoopDelay).to.equal(0);

                setImmediate(function () {

                    server.inject('/', function (res) {

                        expect(server.load.eventLoopDelay).to.be.above(0);

                        setImmediate(function () {

                            server.inject('/', function (res) {

                                expect(server.load.eventLoopDelay).to.be.above(0);
                                expect(server.load.heapUsed).to.be.above(1024 * 1024);
                                expect(server.load.rss).to.be.above(1024 * 1024);
                                server.stop(function () {

                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('rejects request due to high load', function (done) {

        var server = new Hapi.Server(0, { load: { sampleInterval: 5, maxRssBytes: 1 } });
        var handler = function (request, reply) {

            var start = Date.now();
            while (Date.now() - start < 10);
            reply('ok');
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.start(function (err) {

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);

                setImmediate(function () {

                    server.inject('/', function (res) {

                        expect(res.statusCode).to.equal(503);
                        server.stop(function () {

                            done();
                        });
                    });
                });
            });
        });
    });

    it('reuses the same cache segment', function (done) {

        var server = new Hapi.Server({ cache: { engine: 'memory', shared: true } });
        expect(function () {

            var a1 = server.cache('a', { expiresIn: 1000 });
            var a2 = server.cache('a', { expiresIn: 1000 });
        }).to.not.throw;
        done();
    });

    var tlsOptions = {
        key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
        cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
    };

    it('throws an error constructed without new', function (done) {

        var fn = function () {

            Hapi.Server();
        };
        expect(fn).throws(Error, 'Server must be instantiated using new');
        done();
    });

    it('defaults to port 80 when no port is provided', function (done) {

        var server = new Hapi.Server();
        expect(server.info.port).to.be.equal(80);
        done();
    });

    it('defaults to port 443 when no port is provided with tls', function (done) {

        var server = new Hapi.Server({ tls: tlsOptions });
        expect(server.info.port).to.be.equal(443);
        done();
    });

    it('defaults to port 80 when a null port is provided', function (done) {

        var server = new Hapi.Server(null);
        expect(server.info.port).to.be.equal(80);
        done();
    });

    it('allows a ephemeral port to be set', function (done) {

        var server = new Hapi.Server(0);
        expect(server.info.port).to.be.equal(0);
        done();
    });

    it('defaults to 0.0.0.0 when no host is provided', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            expect(server.info.host).to.equal('0.0.0.0');
            done();
        });
    });

    it('does not throw an error when host and port are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('localhost', 8888);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('does not throw an error when host and port are provided and port is a string', function (done) {

        var fn = function () {

            var server = new Hapi.Server('localhost', '8888');
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('does not throw an error when port is a string', function (done) {

        var fn = function () {

            var server = new Hapi.Server('8888');
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('does throw an error when two ports and one is a string is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('8888', 8900);
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('does throw an error when two hosts are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('localhost', '127.0.0.1');
        };
        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error when double port config is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server(8080, 8084);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error when invalid config properties are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server({ cache: 'memory', something: false });
        };

        expect(fn).throws(Error);
        done();
    });

    it('throws an error when double host config is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('0.0.0.0', 'localhost');
        };
        expect(fn).throws(Error);
        done();
    });

    it('creates a server listening on a unix domain socket', function (done) {

        var host = Path.join(__dirname, 'hapi-server.socket');
        var server = new Hapi.Server(host);

        expect(server._unixDomainSocket).to.equal(true);
        expect(server._host).to.equal(host);

        server.start(function () {

            var absSocketPath = Path.resolve(host);
            expect(server.info.host).to.equal(absSocketPath);
            server.stop(function () {

                if (Fs.existsSync(host)) {
                    Fs.unlinkSync(host);
                }
                done();
            });
        });
    });

    it('creates a server listening on a windows named pipe', function (done) {

        var host = '\\\\.\\pipe\\6653e55f-26ec-4268-a4f2-882f4089315c';
        var server = new Hapi.Server(host);

        expect(server._windowsNamedPipe).to.equal(true);
        expect(server._host).to.equal(host);

        server.start(function () {

            expect(server.info.host).to.equal(host);
            server.stop(function () {

                done();
            });
        });
    });

    it('throws an error when unknown arg type is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server(true);
        };
        expect(fn).throws(Error);
        done();
    });

    it('assigns this.views when config enables views', function (done) {

        var server = new Hapi.Server({
            views: {
                engines: { 'html': 'handlebars' }
            }
        });
        expect(server._views).to.exist;
        done();
    });

    it('creates an https server when passed tls options', function (done) {

        var server = new Hapi.Server({ tls: tlsOptions });
        expect(server.listener instanceof Https.Server).to.equal(true);
        done();
    });

    describe('#start', function () {

        it('does not throw an error', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0);
                server.start();
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('calls the callback when provided', function (done) {

            var server = new Hapi.Server(0);
            server.start(function () {

                expect(server.info.host).to.equal('0.0.0.0');
                expect(server.info.port).to.not.equal(0);
                done();
            });
        });

        it('calls the callback when provided with tls', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0, { tls: tlsOptions });
            server.start(function () {

                expect(server.info.host).to.equal('0.0.0.0');
                expect(server.info.port).to.not.equal(0);
                done();
            });
        });
    });

    describe('#stop', function () {

        it('does not throw an error when the server is started', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0);

                server.start(function () {

                    server.stop();
                    done();
                });
            };
            expect(fn).to.not.throw(Error);
        });

        it('ignores repeated calls when the server is not started', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0);
                server.stop();
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('calls the callback when provided with one', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0);

                server.start(function () {

                    server.stop(function () {

                        done();
                    });

                });
            };
            expect(fn).to.not.throw(Error);
        });
    });

    describe('#route', function () {

        it('throws an error when a route is passed in that is missing a path', function (done) {

            var fn = function () {

                var route = {};
                var server = new Hapi.Server();
                server.route(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when a route is passed in that is missing a method', function (done) {

            var fn = function () {

                var route = {
                    path: '/test'
                };
                var server = new Hapi.Server();
                server.route(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when a route is passed in that is missing a handler', function (done) {

            var fn = function () {

                var route = {
                    path: '/test',
                    method: 'put'
                };
                var server = new Hapi.Server();
                server.route(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('adds route to correct _router method property', function (done) {

            var route = {
                path: '/test',
                method: 'put',
                handler: function () { }
            };
            var server = new Hapi.Server();
            server.route(route);

            expect(server._router.routes.put[0].path).to.equal('/test');
            done();
        });

        it('throws an error when a new route conflicts with an existing route', function (done) {

            var fn = function () {

                var server = new Hapi.Server();
                server.route({ path: '/test/{p}/{p}/end', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p*2}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('does not throw an error when routes differ in case and case is sensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: true } });
                server.route({ path: '/test/{p}/End', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('throws an error when routes differ in case and case is insensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: false } });
                server.route({ path: '/test/{p}/End', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when route params differ in case and case is sensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: true } });
                server.route({ path: '/test/{P}/end', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('does not lowercase params when case is insensitive', function (done) {

            var server = new Hapi.Server({ router: { isCaseSensitive: false } });
            server.route({
                path: '/test/{userId}/end', method: 'put', handler: function (request) {

                    expect(request.params.userId).to.exist;
                    done();
                }
            });

            server.inject({ url: '/test/2100/end', method: 'PUT' }, function () {

            });
        });

        it('adds to routes object with the passed in routes values', function (done) {

            var routes = [{
                path: '/test',
                method: 'put',
                handler: function () { }
            }, {
                path: '/test',
                method: 'post',
                handler: function () { }
            }];
            var server = new Hapi.Server();
            server.route(routes);

            expect(server._router.routes.put[0].path).to.equal('/test');
            done();
        });
    });

    describe('#helper', function () {

        it('throws an error when name is not a string', function (done) {

            var fn = function () {

                var server = new Hapi.Server();
                server.helper(0, function () { });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when method is not a function', function (done) {

            var fn = function () {

                var server = new Hapi.Server();
                server.helper('user', 'function');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options is not an object', function (done) {

            var fn = function () {

                var server = new Hapi.Server();
                server.helper('user', function () { }, 'options');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.generateKey is not a function', function (done) {

            var fn = function () {

                var server = new Hapi.Server();
                server.helper('user', function () { }, { generateKey: 'function' });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.cache is not valid', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ cache: 'memory' });
                server.helper('user', function () { }, { cache: { x: 'y' } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('returns a valid result when calling a helper without using the cache', function (done) {

            var server = new Hapi.Server();
            server.helper('user', function (id, next) { return next({ id: id }); });
            server.helpers.user(4, function (result) {

                expect(result.id).to.equal(4);
                done();
            });
        });

        it('returns a valid result when calling a helper when using the cache', function (done) {

            var server = new Hapi.Server(0);
            server.start(function () {

                server.helper('user', function (id, str, next) { return next({ id: id, str: str }); }, { cache: { expiresIn: 1000 } });
                server.helpers.user(4, 'something', function (result) {

                    expect(result.id).to.equal(4);
                    expect(result.str).to.equal('something');
                    done();
                });
            });
        });

        it('returns an error result when calling a helper that returns an error', function (done) {

            var server = new Hapi.Server();
            server.helper('user', function (id, next) { return next(new Error()); });
            server.helpers.user(4, function (result) {

                expect(result instanceof Error).to.equal(true);
                done();
            });
        });

        it('returns a different result when calling a helper without using the cache', function (done) {

            var server = new Hapi.Server();
            var gen = 0;
            server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); });
            server.helpers.user(4, function (result1) {

                expect(result1.id).to.equal(4);
                expect(result1.gen).to.equal(1);
                server.helpers.user(4, function (result2) {

                    expect(result2.id).to.equal(4);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });

        describe('with cache', function () {

            it('returns a valid result when calling a helper using the cache', function (done) {

                var server = new Hapi.Server(0, { cache: 'memory' });

                var gen = 0;
                server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });

                server.start(function () {

                    var id = Math.random();
                    server.helpers.user(id, function (result1) {

                        expect(result1.id).to.equal(id);
                        expect(result1.gen).to.equal(1);
                        server.helpers.user(id, function (result2) {

                            expect(result2.id).to.equal(id);
                            expect(result2.gen).to.equal(1);
                            done();
                        });
                    });
                });
            });

            it('supports empty key helper', function (done) {

                var server = new Hapi.Server(0, { cache: 'memory' });

                var gen = 0;
                var terms = 'I agree to give my house';
                server.helper('tos', function (next) { return next({ gen: gen++, terms: terms }); }, { cache: { expiresIn: 2000 } });

                server.start(function () {

                    server.helpers.tos(function (result1) {

                        expect(result1.terms).to.equal(terms);
                        expect(result1.gen).to.equal(0);
                        server.helpers.tos(function (result2) {

                            expect(result2.terms).to.equal(terms);
                            expect(result2.gen).to.equal(0);
                            done();
                        });
                    });
                });
            });

            it('returns valid results when calling a helper (with different keys) using the cache', function (done) {

                var server = new Hapi.Server(0, { cache: 'memory' });
                var gen = 0;
                server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
                server.start(function () {
                    
                    var id1 = Math.random();
                    server.helpers.user(id1, function (result1) {

                        expect(result1.id).to.equal(id1);
                        expect(result1.gen).to.equal(1);
                        var id2 = Math.random();
                        server.helpers.user(id2, function (result2) {

                            expect(result2.id).to.equal(id2);
                            expect(result2.gen).to.equal(2);
                            done();
                        });
                    });
                });
            });

            it('returns new object (not cached) when second key generation fails when using the cache', function (done) {

                var server = new Hapi.Server(0, { cache: 'memory' });
                var id1 = Math.random();
                var gen = 0;
                var helper = function (id, next) {

                    if (typeof id === 'function') {
                        id = id1;
                    }

                    return next({ id: id, gen: ++gen });
                };

                server.helper([{ name: 'user', method: helper, options: { cache: { expiresIn: 2000 } } }]);

                server.start(function () {

                    server.helpers.user(id1, function (result1) {

                        expect(result1.id).to.equal(id1);
                        expect(result1.gen).to.equal(1);

                        server.helpers.user(function () { }, function (result2) {

                            expect(result2.id).to.equal(id1);
                            expect(result2.gen).to.equal(2);
                            done();
                        });
                    });
                });
            });
        });
    });

    describe('#table', function () {

        it('returns an array of the current routes', function (done) {

            var server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            var routes = server.table();

            expect(routes.length).to.equal(2);
            expect(routes[0].path).to.equal('/test/');
            done();
        });
    });

    describe('#log', function () {

        it('emits a log event', function (done) {

            var server = new Hapi.Server();

            server.once('log', function (event) {

                expect(event.data).to.equal('log event 1');
            });
            server.log('1', 'log event 1', Date.now());

            server.once('log', function (event) {

                expect(event.data).to.equal('log event 2');
            });
            server.log(['2'], 'log event 2', new Date(Date.now()));

            done();
        });
    });
});
