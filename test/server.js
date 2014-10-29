// Load modules

var Net = require('net');
var Fs = require('fs');
var Http = require('http');
var Https = require('https');
var Stream = require('stream');
var Os = require('os');
var Path = require('path');
var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');
var Wreck = require('wreck');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Server', function () {

    it('shallow clones app config', function (done) {

        var item = {};
        var server = new Hapi.Server({ app: item });
        expect(server.settings.app).to.equal(item);
        done();
    });

    it('shallow clones plugins config', function (done) {

        var item = {};
        var server = new Hapi.Server({ plugins: item });
        expect(server.settings.plugins).to.equal(item);
        done();
    });

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

    it('waits to stop until all connections are closed', function (done) {

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

    it('waits to destroy connections until after the timeout', function (done) {

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
                        var timer = new Hoek.Bench();

                        server.stop({ timeout: 20 }, function () {

                            expect(timer.elapsed()).to.be.at.least(19);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('waits to destroy connections if they close by themselves', function (done) {

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
                        var timer = new Hoek.Bench();

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

                        expect(server.listeners('connection').length).to.equal(0);
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

                cache.get('a', function (err, value, cached, report) {

                    expect(value).to.equal('going in');

                    server.stop(function () {

                        done();
                    });
                });
            });
        });
    });

    it('provisions a server cache with custom partition', function (done) {

        var server = new Hapi.Server(0, { cache: { engine: require('catbox-memory'), partition: 'hapi-test-other' } });
        var cache = server.cache('test', { expiresIn: 1000 });
        server.start(function () {

            cache.set('a', 'going in', 0, function (err) {

                cache.get('a', function (err, value, cached, report) {

                    expect(value).to.equal('going in');
                    expect(cache._cache.connection.settings.partition).to.equal('hapi-test-other');

                    server.stop(function () {

                        done();
                    });
                });
            });
        });
    });

    describe('Load', { parallel: false }, function () {

        it('measures loop delay', function (done) {

            var server = new Hapi.Server(0, { load: { sampleInterval: 4 } });
            var handler = function (request, reply) {

                var start = Date.now();
                while (Date.now() - start < 5) { }
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

        it('rejects request due to high rss load', function (done) {

            var server = new Hapi.Server(0, { load: { sampleInterval: 5, maxRssBytes: 1 } });
            var handler = function (request, reply) {

                var start = Date.now();
                while (Date.now() - start < 10) { }
                reply('ok');
            };

            var logged = null;
            server.once('log', function (event, tags) {

                logged = (tags.hapi && tags.load && event.data);
            });

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start(function (err) {

                server.inject('/', function (res) {

                    expect(res.statusCode).to.equal(200);

                    setImmediate(function () {

                        server.inject('/', function (res) {

                            expect(res.statusCode).to.equal(503);
                            expect(logged.rss > 10000).to.equal(true);
                            server.stop();
                            done();
                        });
                    });
                });
            });
        });
    });

    it('reuses the same cache segment', function (done) {

        var server = new Hapi.Server({ cache: { engine: require('catbox-memory'), shared: true } });
        expect(function () {

            var a1 = server.cache('a', { expiresIn: 1000 });
            var a2 = server.cache('a', { expiresIn: 1000 });
        }).to.not.throw();
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

    it('defaults to 0.0.0.0 or :: when no host is provided', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            var expectedBoundAddress = '0.0.0.0';
            if (Net.isIPv6(server.listener.address().address)) {
                expectedBoundAddress = '::';
            }

            expect(server.info.host).to.equal(expectedBoundAddress);
            done();
        });
    });

    it('does not throw an error when host and port are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('localhost', 8888);
        };
        expect(fn).to.not.throw();
        done();
    });

    it('does not throw an error when host and port are provided and port is a string', function (done) {

        var fn = function () {

            var server = new Hapi.Server('localhost', '8888');
        };
        expect(fn).to.not.throw();
        done();
    });

    it('does not throw an error when port is a string', function (done) {

        var fn = function () {

            var server = new Hapi.Server('8888');
        };
        expect(fn).to.not.throw();
        done();
    });

    it('does throw an error when two ports and one is a string is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('8888', 8900);
        };
        expect(fn).to.throw();
        done();
    });

    it('does throw an error when two hosts are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('localhost', '127.0.0.1');
        };
        expect(fn).to.throw();
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

            var server = new Hapi.Server({ cache: require('catbox-memory'), something: false });
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

    it('creates a server listening on a unix domain socket', { skip: process.platform === 'win32' }, function (done) {

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

    it('creates an https server when passed tls options', function (done) {

        var server = new Hapi.Server({ tls: tlsOptions });
        expect(server.listener instanceof Https.Server).to.equal(true);
        done();
    });

    it('removes duplicate labels', function (done) {

        var server = new Hapi.Server({ labels: ['a', 'b', 'a', 'c', 'b'] });
        expect(server.settings.labels).to.deep.equal(['a', 'b', 'c']);
        done();
    });

    it('sets info.uri with default localhost when no hostname', { parallel: false }, function (done) {

        var orig = Os.hostname;
        Os.hostname = function () {

            Os.hostname = orig;
            return '';
        };

        var server = new Hapi.Server(80);
        expect(server.info.uri).to.equal('http://localhost:80');
        done();
    });

    describe('#start', function () {

        it('does not throw an error', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0);
                server.start();
                server.stop();
            };
            expect(fn).to.not.throw();
            done();
        });

        it('calls the callback when provided', function (done) {

            var server = new Hapi.Server(0);
            server.start(function () {

                var expectedBoundAddress = '0.0.0.0';
                if (Net.isIPv6(server.listener.address().address)) {
                    expectedBoundAddress = '::';
                }

                expect(server.info.host).to.equal(expectedBoundAddress);
                expect(server.info.port).to.not.equal(0);
                server.stop();
                done();
            });
        });

        it('calls the callback when provided with tls', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0, { tls: tlsOptions });
            server.start(function () {

                expect(server.info.host).to.equal('0.0.0.0');
                expect(server.info.port).to.not.equal(0);
                server.stop();
                done();
            });
        });

        it('sets info with defaults no hostname or address', { parallel: false }, function (done) {

            var hostname = Os.hostname;
            Os.hostname = function () {

                Os.hostname = hostname;
                return '';
            };

            var server = new Hapi.Server(0);
            expect(server._host).to.equal('');

            var address = server.listener.address;
            server.listener.address = function () {

                server.listener.address = address;
                var add = address.call(this);
                add.address = '';
                return add;
            };

            server.start(function () {

                expect(server.info.host).to.equal('0.0.0.0');
                expect(server.info.uri).to.equal('http://localhost:' + server.info.port);
                server.stop();
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
            expect(fn).to.not.throw();
        });

        it('ignores repeated calls when the server is not started', function (done) {

            var fn = function () {

                var server = new Hapi.Server(0);
                server.stop();
            };
            expect(fn).to.not.throw();
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
            expect(fn).to.not.throw();
        });
    });

    describe('#route', function () {

        it('throws an error when a route is passed in that is missing a path', function (done) {

            var fn = function () {

                var route = {};
                var server = new Hapi.Server();
                server.route(route);
            };
            expect(fn).to.throw();
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
            expect(fn).to.throw();
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
            expect(fn).to.throw();
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
            expect(fn).to.throw();
            done();
        });

        it('does not throw an error when routes differ in case and case is sensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: true } });
                server.route({ path: '/test/{p}/End', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.not.throw();
            done();
        });

        it('throws an error when routes differ in case and case is insensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: false } });
                server.route({ path: '/test/{p}/End', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw();
            done();
        });

        it('throws an error when route params differ in case and case is sensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: true } });
                server.route({ path: '/test/{P}/end', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw();
            done();
        });

        it('does not lowercase params when case is insensitive', function (done) {

            var server = new Hapi.Server({ router: { isCaseSensitive: false } });
            server.route({
                path: '/test/{userId}/end', method: 'put', handler: function (request) {

                    expect(request.params.userId).to.exist();
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

        it('combines global and vhost routes', function (done) {

            var server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            var routes = server.table();

            expect(routes.length).to.equal(4);
            done();
        });

        it('combines global and vhost routes and filters based on host', function (done) {

            var server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            var routes = server.table('one.example.com');

            expect(routes.length).to.equal(3);
            done();
        });

        it('accepts a list of hosts', function (done) {

            var server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            var routes = server.table(['one.example.com', 'two.example.com']);

            expect(routes.length).to.equal(4);
            done();
        });

        it('ignores unknown host', function (done) {

            var server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            var routes = server.table('three.example.com');

            expect(routes.length).to.equal(2);
            done();
        });
    });

    describe('#log', function () {

        it('emits a log event', function (done) {

            var server = new Hapi.Server();

            var count = 0;
            server.once('log', function (event) {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.pack.events.once('log', function (event) {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.log('1', 'log event 1', Date.now());

            server.once('log', function (event) {

                ++count;
                expect(event.data).to.equal('log event 2');
            });

            server.log(['2'], 'log event 2', new Date(Date.now()));

            expect(count).to.equal(3);
            done();
        });

        it('emits a log event and print to console', { parallel: false }, function (done) {

            var server = new Hapi.Server();

            server.once('log', function (event) {

                expect(event.data).to.equal('log event 1');
            });

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('hapi, internal, implementation, error');

                done();
            };

            server.log(['hapi', 'internal', 'implementation', 'error'], 'log event 1');
        });
    });

    describe('#handler', function () {

        var handler = function (route, options) {

            return function (request, reply) {

                reply(options.message);
            };
        };

        it('adds handler', function (done) {

            var fn = function () {

                var server = new Hapi.Server();

                server.handler('test', handler);
                expect(server.pack._core._handlers.test).to.equal(handler);
            };

            expect(fn).to.not.throw();
            done();
        });

        it('call new handler', function (done) {

            var fn = function () {

                var server = new Hapi.Server();

                server.handler('test', handler);
                server.route({
                    method: 'GET',
                    path: '/',
                    handler: {
                        test: {
                            message: 'success'
                        }
                    }
                });
                server.inject('/', function (res) {
                    expect(res.payload).to.equal('success');
                    done();
                });
            };

            expect(fn).to.not.throw();
        });

        it('errors on duplicate handler', function (done) {

            var fn = function () {

                var server = new Hapi.Server();

                server.handler('proxy', handler);
            };

            expect(fn).to.throw();
            done();
        });

        it('errors on unknown handler', function (done) {

            var fn = function () {

                var server = new Hapi.Server();

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: {
                        test: {}
                    }
                });
            };

            expect(fn).to.throw();
            done();
        });

        it('errors on non-string name', function (done) {

            var fn = function () {

                var server = new Hapi.Server();

                server.handler();
            };

            expect(fn).to.throw();
            done();
        });

        it('errors on non-function handler', function (done) {

            var fn = function () {

                var server = new Hapi.Server();

                server.handler('foo', 'bar');
            };

            expect(fn).to.throw();
            done();
        });
    });

    describe('#inject', function () {

        it('keeps the options.credentials object untouched', function (done) {

            var handler = function (request, reply) { return reply(); };

            var server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            var options = {
                url: '/',
                credentials: { foo: 'bar' }
            };

            server.inject(options, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(options.credentials).to.exist();
                done();
            });
        });
    });


    describe('Timeouts', { parallel: false }, function () {

        var slowHandler = function (request, reply) {

            setTimeout(function () {

                reply('Slow');
            }, 30);
        };

        var respondingHandler = function (request, reply) {

            var s = new Stream.PassThrough();
            reply(s);

            for (var i = 10000; i > 0; --i) {
                s.write(i.toString());
            }

            setTimeout(function () {

                s.emit('end');
            }, 40);
        };

        var fastHandler = function (request, reply) {

            reply('Fast');
        };

        var streamHandler = function (request, reply) {

            var TestStream = function () {

                Stream.Readable.call(this);
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                var self = this;

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                setTimeout(function () {

                    self.push('Hello');
                }, 30);

                setTimeout(function () {

                    self.push(null);
                }, 60);
            };

            reply(new TestStream());
        };

        it('returns server error message when server taking too long', function (done) {

            var timeoutHandler = function (request, reply) { };

            var server = new Hapi.Server({ timeout: { server: 50 } });
            server.route({ method: 'GET', path: '/timeout', config: { handler: timeoutHandler } });

            var timer = new Hoek.Bench();

            server.inject('/timeout', function (res) {

                expect(res.statusCode).to.equal(503);
                expect(timer.elapsed()).to.be.at.least(45);
                done();
            });
        });

        it('returns server error message when server timeout happens during request execution (and handler yields)', function (done) {

            var serverShort = new Hapi.Server({ timeout: { server: 2 } });
            serverShort.route({ method: 'GET', path: '/', config: { handler: slowHandler } });

            serverShort.inject('/', function (res) {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('returns server error message when server timeout is short and already occurs when request executes', function (done) {

            var serverExt = new Hapi.Server({ timeout: { server: 2 } });
            serverExt.route({ method: 'GET', path: '/', config: { handler: function () { } } });
            serverExt.ext('onRequest', function (request, next) {

                setTimeout(next, 10);
            });

            serverExt.inject('/', function (res) {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('handles server handler timeout with onPreResponse ext', function (done) {

            var handler = function (request, reply) {

                setTimeout(reply, 20);
            };

            var serverExt = new Hapi.Server({ timeout: { server: 10 } });
            serverExt.route({ method: 'GET', path: '/', config: { handler: handler } });
            serverExt.ext('onPreResponse', function (request, next) {

                next();
            });

            serverExt.inject('/', function (res) {

                expect(res.statusCode).to.equal(503);
                done();
            });
        });

        it('does not return an error response when server is slow but faster than timeout', function (done) {

            var server = new Hapi.Server({ timeout: { server: 50 } });
            server.route({ method: 'GET', path: '/slow', config: { handler: slowHandler } });

            var timer = new Hoek.Bench();
            server.inject('/slow', function (res) {

                expect(timer.elapsed()).to.be.at.least(20);
                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('does not return an error when server is responding when the timeout occurs', function (done) {

            var timer = new Hoek.Bench();

            var server = new Hapi.Server(0, { timeout: { server: 50 } });
            server.route({ method: 'GET', path: '/responding', config: { handler: respondingHandler } });
            server.start(function () {

                var options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/responding',
                    method: 'GET'
                };

                var req = Http.request(options, function (res) {

                    expect(timer.elapsed()).to.be.at.least(70);
                    expect(res.statusCode).to.equal(200);
                    done();
                });

                req.write('\n');
            });
        });

        it('does not return an error response when server is slower than timeout but response has started', function (done) {

            var server = new Hapi.Server(0, { timeout: { server: 50 } });
            server.route({ method: 'GET', path: '/stream', config: { handler: streamHandler } });
            server.start(function () {

                var options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/stream',
                    method: 'GET'
                };

                var req = Http.request(options, function (res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
                req.end();
            });
        });

        it('does not return an error response when server takes less than timeout to respond', function (done) {

            var server = new Hapi.Server({ timeout: { server: 50 } });
            server.route({ method: 'GET', path: '/fast', config: { handler: fastHandler } });

            server.inject('/fast', function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });

        it('returned when both client and server timeouts are the same and the client times out', function (done) {

            var timeoutHandler = function (request, reply) { };

            var server = new Hapi.Server(0, { timeout: { server: 50, client: 50 } });
            server.route({ method: 'POST', path: '/timeout', config: { handler: timeoutHandler } });

            server.start(function () {

                var timer = new Hoek.Bench();
                var options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/timeout',
                    method: 'POST'
                };

                var req = Http.request(options, function (res) {

                    expect([503, 408]).to.contain(res.statusCode);
                    expect(timer.elapsed()).to.be.at.least(45);
                    done();
                });

                req.on('error', function (err) {

                });

                req.write('\n');
                setTimeout(function () {

                    req.end();
                }, 100);
            });
        });

        it('initial long running requests don\'t prevent server timeouts from occuring on future requests', function (done) {

            var handler = function (request, reply) {

                setTimeout(function () {

                    reply('ok');
                }, 70);
            };

            var server = new Hapi.Server(0, { timeout: { server: 50, client: 50 } });
            server.route({ method: 'POST', path: '/', config: { handler: handler } });

            server.start(function () {

                var timer = new Hoek.Bench();
                var options = {
                    hostname: '127.0.0.1',
                    port: server.info.port,
                    path: '/',
                    method: 'POST'
                };

                var req1 = Http.request(options, function (res1) {

                    expect([503, 408]).to.contain(res1.statusCode);
                    expect(timer.elapsed()).to.be.at.least(45);

                    var req2 = Http.request(options, function (res2) {

                        expect(res2.statusCode).to.equal(503);
                        done();
                    });

                    req2.on('error', function (err) {

                    });

                    req2.end();
                });

                req1.on('error', function (err) {

                });

                req1.write('\n');
                setTimeout(function () {

                    req1.end();
                }, 100);
            });
        });

        it('closes connection on socket timeout', function (done) {

            var server = new Hapi.Server(0, { timeout: { client: 45, socket: 50 } });
            server.route({
                method: 'GET', path: '/', config: {
                    handler: function (request, reply) {

                        setTimeout(function () {

                            reply('too late');
                        }, 70);
                    }
                }
            });

            server.start(function () {

                Wreck.request('GET', 'http://localhost:' + server.info.port + '/', {}, function (err, res) {

                    server.stop();
                    expect(err).to.exist();
                    expect(err.message).to.equal('Client request error: socket hang up');
                    done();
                });
            });
        });

        it('disables node socket timeout', function (done) {

            var server = new Hapi.Server(0, { timeout: { socket: false } });
            server.route({
                method: 'GET', path: '/', config: {
                    handler: function (request, reply) {

                        reply();
                    }
                }
            });

            server.start(function () {

                var timeout;
                var orig = Net.Socket.prototype.setTimeout;
                Net.Socket.prototype.setTimeout = function () {

                    timeout = 'gotcha';
                    Net.Socket.prototype.setTimeout = orig;
                    return orig.apply(this, arguments);
                };

                Wreck.request('GET', 'http://localhost:' + server.info.port + '/', {}, function (err, res) {

                    server.stop();
                    expect(err).to.not.exist();
                    expect(timeout).to.equal('gotcha');
                    done();
                });
            });
        });

        it('allows setting a server timeout without socket timeout', function (done) {

            expect(function () {

                var server = new Hapi.Server({ timeout: { server: 50, socket: false } });
            }).to.not.throw();
            done();
        });
    });

    describe('#location', function () {

        it('returns back the same absolute location', function (done) {

            var server = new Hapi.Server({ location: 'http://example.net' });
            expect(server.location('http://example.com/test')).to.equal('http://example.com/test');
            done();
        });

        it('returns back the an absolute location using server config', function (done) {

            var server = new Hapi.Server({ location: 'http://example.net' });
            expect(server.location('/test')).to.equal('http://example.net/test');
            done();
        });

        it('returns back the an absolute location using request host', function (done) {

            var server = new Hapi.Server();
            expect(server.location('/test', { info: { host: 'example.edu' } })).to.equal('http://example.edu/test');
            done();
        });

        it('returns back the an absolute location using server info', function (done) {

            var server = new Hapi.Server();
            expect(server.location('/test')).to.equal('http://0.0.0.0:80/test');
            done();
        });
    });

    describe('#render', function () {

        it('renders view', function (done) {

            var server = new Hapi.Server();
            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.render('test', { title: 'test', message: 'Hapi' }, function (err, rendered, config) {

                expect(rendered).to.exist();
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('renders view (options)', function (done) {

            var server = new Hapi.Server();
            server.views({
                engines: { html: require('handlebars') }
            });

            server.render('test', { title: 'test', message: 'Hapi' }, { path: __dirname + '/templates' }, function (err, rendered, config) {

                expect(rendered).to.exist();
                expect(rendered).to.contain('Hapi');
                done();
            });
        });
    });
});
