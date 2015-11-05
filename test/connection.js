'use strict';

// Load modules

const ChildProcess = require('child_process');
const Fs = require('fs');
const Http = require('http');
const Https = require('https');
const Net = require('net');
const Os = require('os');
const Path = require('path');
const Boom = require('boom');
const Code = require('code');
const Handlebars = require('handlebars');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Lab = require('lab');
const Vision = require('vision');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Connection', () => {

    it('allows null port and host', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.connection({ host: null, port: null });
        }).to.not.throw();
        done();
    });

    it('removes duplicate labels', (done) => {

        const server = new Hapi.Server();
        server.connection({ labels: ['a', 'b', 'a', 'c', 'b'] });
        expect(server.connections[0].settings.labels).to.deep.equal(['a', 'b', 'c']);
        done();
    });

    it('throws when disabling autoListen and providing a port', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.connection({ port: 80, autoListen: false });
        }).to.throw('Cannot specify port when autoListen is false');
        done();
    });

    it('throws when disabling autoListen and providing special host', (done) => {

        const server = new Hapi.Server();
        const port = Path.join(__dirname, 'hapi-server.socket');
        expect(() => {

            server.connection({ port: port, autoListen: false });
        }).to.throw('Cannot specify port when autoListen is false');
        done();
    });

    it('defaults address to 0.0.0.0 or :: when no host is provided', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.start((err) => {

            expect(err).to.not.exist();

            let expectedBoundAddress = '0.0.0.0';
            if (Net.isIPv6(server.listener.address().address)) {
                expectedBoundAddress = '::';
            }

            expect(server.info.address).to.equal(expectedBoundAddress);
            server.stop(done);
        });
    });

    it('uses address when present instead of host', (done) => {

        const server = new Hapi.Server();
        server.connection({ host: 'no.such.domain.hapi', address: 'localhost' });
        server.start((err) => {

            expect(err).to.not.exist();
            expect(server.info.host).to.equal('no.such.domain.hapi');
            expect(server.info.address).to.equal('127.0.0.1');
            server.stop(done);
        });
    });

    it('uses uri when present instead of host and port', (done) => {

        const server = new Hapi.Server();
        server.connection({ host: 'no.such.domain.hapi', address: 'localhost', uri: 'http://uri.example.com:8080' });
        expect(server.info.uri).to.equal('http://uri.example.com:8080');
        server.start((err) => {

            expect(err).to.not.exist();
            expect(server.info.host).to.equal('no.such.domain.hapi');
            expect(server.info.address).to.equal('127.0.0.1');
            expect(server.info.uri).to.equal('http://uri.example.com:8080');
            server.stop(done);
        });
    });

    it('throws on uri ending with /', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.connection({ uri: 'http://uri.example.com:8080/' });
        }).to.throw(/Invalid connection options/);
        done();
    });

    it('creates a server listening on a unix domain socket', { skip: process.platform === 'win32' }, (done) => {

        const port = Path.join(__dirname, 'hapi-server.socket');
        const server = new Hapi.Server();
        server.connection({ port: port });

        expect(server.connections[0].type).to.equal('socket');

        server.start((err) => {

            expect(err).to.not.exist();
            const absSocketPath = Path.resolve(port);
            expect(server.info.port).to.equal(absSocketPath);
            server.stop((err) => {

                expect(err).to.not.exist();

                if (Fs.existsSync(port)) {
                    Fs.unlinkSync(port);
                }
                done();
            });
        });
    });

    it('creates a server listening on a windows named pipe', (done) => {

        const port = '\\\\.\\pipe\\6653e55f-26ec-4268-a4f2-882f4089315c';
        const server = new Hapi.Server();
        server.connection({ port: port });

        expect(server.connections[0].type).to.equal('socket');

        server.start((err) => {

            expect(server.info.port).to.equal(port);
            server.stop(done);
        });
    });

    it('creates an https server when passed tls options', (done) => {

        const tlsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        const server = new Hapi.Server();
        server.connection({ tls: tlsOptions });
        expect(server.listener instanceof Https.Server).to.equal(true);
        done();
    });

    it('uses a provided listener', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const listener = Http.createServer();
        const server = new Hapi.Server();
        server.connection({ listener: listener });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.start((err) => {

            expect(err).to.not.exist();
            Wreck.get('http://localhost:' + server.info.port + '/', {}, (err, res, body) => {

                expect(err).to.not.exist();
                expect(body.toString()).to.equal('ok');
                server.stop(done);
            });
        });
    });

    it('uses a provided listener (TLS)', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const listener = Http.createServer();
        const server = new Hapi.Server();
        server.connection({ listener: listener, tls: true });
        server.route({ method: 'GET', path: '/', handler: handler });

        server.start((err) => {

            expect(err).to.not.exist();
            expect(server.info.protocol).to.equal('https');
            server.stop(done);
        });
    });

    it('uses a provided listener with manual listen', (done) => {

        const handler = function (request, reply) {

            return reply('ok');
        };

        const listener = Http.createServer();
        const server = new Hapi.Server();
        server.connection({ listener: listener, autoListen: false });
        server.route({ method: 'GET', path: '/', handler: handler });

        listener.listen(0, 'localhost', () => {

            server.start((err) => {

                expect(err).to.not.exist();
                Wreck.get('http://localhost:' + server.info.port + '/', {}, (err, res, body) => {

                    expect(err).to.not.exist();
                    expect(body.toString()).to.equal('ok');
                    server.stop(done);
                });
            });
        });
    });

    it('sets info.uri with default localhost when no hostname', { parallel: false }, (done) => {

        const orig = Os.hostname;
        Os.hostname = function () {

            Os.hostname = orig;
            return '';
        };

        const server = new Hapi.Server();
        server.connection({ port: 80 });
        expect(server.info.uri).to.equal('http://localhost:80');
        done();
    });

    it('sets info.uri without port when 0', (done) => {

        const server = new Hapi.Server();
        server.connection({ host: 'example.com' });
        expect(server.info.uri).to.equal('http://example.com');
        done();
    });

    it('closes connection on socket timeout', { parallel: false }, (done) => {

        const server = new Hapi.Server();
        server.connection({ routes: { timeout: { socket: 50 }, payload: { timeout: 45 } } });
        server.route({
            method: 'GET', path: '/', config: {
                handler: function (request, reply) {

                    setTimeout(() => {

                        return reply('too late');
                    }, 70);
                }
            }
        });

        server.start((err) => {

            expect(err).to.not.exist();
            Wreck.request('GET', 'http://localhost:' + server.info.port + '/', {}, (err, res) => {

                expect(err).to.exist();
                expect(err.message).to.equal('Client request error: socket hang up');
                server.stop(done);
            });
        });
    });

    it('disables node socket timeout', { parallel: false }, (done) => {

        const handler = function (request, reply) {

            return reply();
        };

        const server = new Hapi.Server();
        server.connection({ routes: { timeout: { socket: false } } });
        server.route({ method: 'GET', path: '/', config: { handler: handler } });

        server.start((err) => {

            expect(err).to.not.exist();

            let timeout;
            const orig = Net.Socket.prototype.setTimeout;
            Net.Socket.prototype.setTimeout = function () {

                timeout = 'gotcha';
                Net.Socket.prototype.setTimeout = orig;
                return orig.apply(this, arguments);
            };

            Wreck.request('GET', 'http://localhost:' + server.info.port + '/', {}, (err, res) => {

                Wreck.read(res, {}, (err, payload) => {

                    expect(err).to.not.exist();
                    expect(timeout).to.equal('gotcha');
                    server.stop(done);
                });
            });
        });
    });

    describe('_start()', () => {

        it('starts connection', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.start((err) => {

                expect(err).to.not.exist();
                let expectedBoundAddress = '0.0.0.0';
                if (Net.isIPv6(server.listener.address().address)) {
                    expectedBoundAddress = '::';
                }

                expect(server.info.host).to.equal(Os.hostname());
                expect(server.info.address).to.equal(expectedBoundAddress);
                expect(server.info.port).to.be.a.number().and.above(1);
                server.stop(done);
            });
        });

        it('starts connection (tls)', (done) => {

            const tlsOptions = {
                key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
            };

            const server = new Hapi.Server();
            server.connection({ host: '0.0.0.0', port: 0, tls: tlsOptions });
            server.start((err) => {

                expect(err).to.not.exist();
                expect(server.info.host).to.equal('0.0.0.0');
                expect(server.info.port).to.not.equal(0);
                server.stop(done);
            });
        });

        it('sets info with defaults when missing hostname and address', { parallel: false }, (done) => {

            const hostname = Os.hostname;
            Os.hostname = function () {

                Os.hostname = hostname;
                return '';
            };

            const server = new Hapi.Server();
            server.connection({ port: '8000' });
            expect(server.info.host).to.equal('localhost');
            expect(server.info.uri).to.equal('http://localhost:8000');
            done();
        });

        it('ignored repeated calls', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.start((err) => {

                expect(err).to.not.exist();
                server.start((err) => {

                    expect(err).to.not.exist();
                    server.stop((err) => {

                        expect(err).to.not.exist();
                        done();
                    });
                });
            });
        });

        it('will return an error if the port is already in use', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.start((err) => {

                expect(err).to.not.exist();
                server.connection({ port: server.info.port });
                server.start((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.match(/EADDRINUSE/);
                    server.stop(done);
                });
            });
        });
    });

    describe('_stop()', () => {

        it('waits to stop until all connections are closed', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.start((err) => {

                expect(err).to.not.exist();
                const socket1 = new Net.Socket();
                const socket2 = new Net.Socket();
                socket1.on('error', () => { });
                socket2.on('error', () => { });

                socket1.connect(server.info.port, '127.0.0.1', () => {

                    socket2.connect(server.info.port, '127.0.0.1', () => {

                        server.listener.getConnections((err, count1) => {

                            expect(count1).to.be.greaterThan(0);

                            server.stop((err) => {

                                expect(err).to.not.exist();

                                server.listener.getConnections((err, count2) => {

                                    expect(count2).to.equal(0);
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

        it('waits to destroy connections until after the timeout', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.start((err) => {

                expect(err).to.not.exist();

                const socket1 = new Net.Socket();
                const socket2 = new Net.Socket();

                socket1.once('error', (err) => {

                    expect(err.errno).to.equal('ECONNRESET');
                });

                socket2.once('error', (err) => {

                    expect(err.errno).to.equal('ECONNRESET');
                });

                socket1.connect(server.info.port, server.connections[0].settings.host, () => {

                    socket2.connect(server.info.port, server.connections[0].settings.host, () => {

                        server.listener.getConnections((err, count) => {

                            expect(count).to.be.greaterThan(0);
                            const timer = new Hoek.Bench();

                            server.stop({ timeout: 20 }, (err) => {

                                expect(err).to.not.exist();
                                expect(timer.elapsed()).to.be.at.least(19);
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('waits to destroy connections if they close by themselves', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.start((err) => {

                expect(err).to.not.exist();

                const socket1 = new Net.Socket();
                const socket2 = new Net.Socket();

                socket1.once('error', (err) => {

                    expect(err.errno).to.equal('ECONNRESET');
                });

                socket2.once('error', (err) => {

                    expect(err.errno).to.equal('ECONNRESET');
                });

                socket1.connect(server.info.port, server.connections[0].settings.host, () => {

                    socket2.connect(server.info.port, server.connections[0].settings.host, () => {

                        server.listener.getConnections((err, count1) => {

                            expect(count1).to.be.greaterThan(0);
                            const timer = new Hoek.Bench();

                            server.stop((err) => {

                                expect(err).to.not.exist();

                                server.listener.getConnections((err, count2) => {

                                    expect(count2).to.equal(0);
                                    expect(timer.elapsed()).to.be.at.least(9);
                                    done();
                                });
                            });

                            setTimeout(() => {

                                socket1.end();
                                socket2.end();
                            }, 10);
                        });
                    });
                });
            });
        });

        it('refuses to handle new incoming requests', (done) => {

            const handler = (request, reply) => {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                const agent = new Http.Agent({ keepAlive: true, maxSockets: 1 });
                let err2;

                Wreck.get('http://localhost:' + server.info.port + '/', { agent: agent }, (err1, res, body) => {

                    server.stop((err3) => {

                        expect(err3).to.not.exist();
                        expect(err1).to.not.exist();
                        expect(body.toString()).to.equal('ok');
                        expect(server.connections[0]._started).to.equal(false);
                        expect(err2).to.exist();
                        done();
                    });
                });

                Wreck.get('http://localhost:' + server.info.port + '/', { agent: agent }, (err, res, body) => {

                    err2 = err;
                });
            });
        });

        it('removes connection event listeners after it stops', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const initial = server.listener.listeners('connection').length;
            server.start((err) => {

                expect(err).to.not.exist();

                expect(server.listener.listeners('connection').length).to.be.greaterThan(initial);

                server.stop((err) => {

                    expect(err).to.not.exist();

                    server.start((err) => {

                        expect(err).to.not.exist();

                        server.stop((err) => {

                            expect(err).to.not.exist();
                            expect(server.listener.listeners('connection').length).to.equal(initial);
                            done();
                        });
                    });
                });
            });
        });

        it('ignores repeated calls', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.stop((err) => {

                server.stop(done);
            });
        });
    });

    describe('_dispatch()', () => {

        it('rejects request due to high rss load', { parallel: false }, (done) => {

            const server = new Hapi.Server({ load: { sampleInterval: 5 } });
            server.connection({ load: { maxRssBytes: 1 } });

            const handler = function (request, reply) {

                const start = Date.now();
                while (Date.now() - start < 10) { }
                return reply('ok');
            };

            let logged = null;
            server.once('log', (event, tags) => {

                logged = (event.internal && tags.load && event.data);
            });

            server.route({ method: 'GET', path: '/', handler: handler });
            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res1) => {

                    expect(res1.statusCode).to.equal(200);

                    setImmediate(() => {

                        server.inject('/', (res2) => {

                            expect(res2.statusCode).to.equal(503);
                            expect(logged.rss > 10000).to.equal(true);
                            server.stop(done);
                        });
                    });
                });
            });
        });
    });

    describe('inject()', () => {

        it('keeps the options.credentials object untouched', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                credentials: { foo: 'bar' }
            };

            server.connections[0].inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(options.credentials).to.exist();
                done();
            });
        });

        it('sets credentials (with host header)', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                credentials: { foo: 'bar' },
                headers: {
                    host: 'something'
                }
            };

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(options.credentials).to.exist();
                done();
            });
        });

        it('sets credentials (with authority)', (done) => {

            const handler = function (request, reply) {

                return reply(request.headers.host);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                credentials: { foo: 'bar' },
                authority: 'something'
            };

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('something');
                expect(options.credentials).to.exist();
                done();
            });
        });

        it('sets authority', (done) => {

            const handler = function (request, reply) {

                return reply(request.headers.host);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                authority: 'something'
            };

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('something');
                done();
            });
        });

        it('passes the options.artifacts object', (done) => {

            const handler = function (request, reply) {

                return reply(request.auth.artifacts);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                credentials: { foo: 'bar' },
                artifacts: { bar: 'baz' }
            };

            server.connections[0].inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result.bar).to.equal('baz');
                expect(options.artifacts).to.exist();
                done();
            });
        });

        it('sets app settings', (done) => {

            const handler = function (request, reply) {

                return reply(request.app.x);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                authority: 'x',             // For coverage
                app: {
                    x: 123
                }
            };

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(123);
                done();
            });
        });

        it('sets plugins settings', (done) => {

            const handler = function (request, reply) {

                return reply(request.plugins.x.y);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            const options = {
                url: '/',
                authority: 'x',             // For coverage
                plugins: {
                    x: {
                        y: 123
                    }
                }
            };

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(123);
                done();
            });
        });

        it('returns the request object', (done) => {

            const handler = function (request, reply) {

                request.app.key = 'value';
                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.request.app.key).to.equal('value');
                done();
            });
        });

        it('can set a client remoteAddress', (done) => {

            const handler = function (request, reply) {

                return reply(request.info.remoteAddress);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject({ url: '/', remoteAddress: '1.2.3.4' }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.equal('1.2.3.4');
                done();
            });
        });

        it('sets a default remoteAddress of 127.0.0.1', (done) => {

            const handler = function (request, reply) {

                return reply(request.info.remoteAddress);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', config: { handler: handler } });

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.equal('127.0.0.1');
                done();
            });
        });

        it('sets correct host header', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'example.com', port: 2080 });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    reply(request.headers.host);
                }
            });

            server.inject('/', (res) => {

                expect(res.result).to.equal('example.com:2080');
                done();
            });
        });
    });

    describe('table()', () => {

        it('returns an array of the current routes', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const routes = server.table()[0].table;

            expect(routes.length).to.equal(2);
            expect(routes[0].path).to.equal('/test/');
            done();
        });

        it('returns the labels for the connections', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['test'] });

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const connection = server.table()[0];

            expect(connection.labels).to.only.include(['test']);
            done();
        });

        it('returns an array of the current routes (connection)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const routes = server.connections[0].table();

            expect(routes.length).to.equal(2);
            expect(routes[0].path).to.equal('/test/');
            done();
        });

        it('combines global and vhost routes', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const routes = server.table()[0].table;

            expect(routes.length).to.equal(4);
            done();
        });

        it('combines global and vhost routes and filters based on host', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const routes = server.table('one.example.com')[0].table;

            expect(routes.length).to.equal(3);
            done();
        });

        it('accepts a list of hosts', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const routes = server.table(['one.example.com', 'two.example.com'])[0].table;

            expect(routes.length).to.equal(4);
            done();
        });

        it('ignores unknown host', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            const routes = server.table('three.example.com')[0].table;

            expect(routes.length).to.equal(2);
            done();
        });
    });

    describe('ext()', () => {

        it('supports adding an array of methods', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.ext('onPreHandler', [
                function (request, reply) {

                    request.app.x = '1';
                    return reply.continue();
                },
                function (request, reply) {

                    request.app.x += '2';
                    return reply.continue();
                }
            ]);

            const handler = function (request, reply) {

                return reply(request.app.x);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal('12');
                done();
            });
        });

        it('sets bind via options', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const preHandler = function (request, reply) {

                request.app.x = this.y;
                return reply.continue();
            };

            server.ext('onPreHandler', preHandler, { bind: { y: 42 } });

            const handler = function (request, reply) {

                return reply(request.app.x);
            };

            server.route({ method: 'GET', path: '/', handler: handler });

            server.inject('/', (res) => {

                expect(res.result).to.equal(42);
                done();
            });
        });

        it('uses server views for ext added via server', (done) => {

            const server = new Hapi.Server();
            server.register(Vision, Hoek.ignore);
            server.connection();

            server.views({
                engines: { html: Handlebars },
                path: __dirname + '/templates'
            });

            const preHandler = function (request, reply) {

                return reply.view('test');
            };

            server.ext('onPreHandler', preHandler);

            const test = function (plugin, options, next) {

                plugin.views({
                    engines: { html: Handlebars },
                    path: './no_such_directory_found'
                });

                plugin.route({ path: '/view', method: 'GET', handler: function (request, reply) { } });
                return next();
            };

            test.attributes = {
                name: 'test'
            };

            server.register(test, (err) => {

                server.inject('/view', (res) => {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('supports reply decorators on empty result', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const onRequest = function (request, reply) {

                return reply().redirect('/elsewhere');
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(302);
                expect(res.headers.location).to.equal('/elsewhere');
                done();
            });
        });

        it('supports direct reply decorators', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const onRequest = function (request, reply) {

                return reply.redirect('/elsewhere');
            };

            server.ext('onRequest', onRequest);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(302);
                expect(res.headers.location).to.equal('/elsewhere');
                done();
            });
        });

        describe('onRequest', (done) => {

            it('replies with custom response', (done) => {

                const server = new Hapi.Server();
                server.connection();
                const onRequest = function (request, reply) {

                    return reply(Boom.badRequest('boom'));
                };

                server.ext('onRequest', onRequest);

                server.inject('/', (res) => {

                    expect(res.statusCode).to.equal(400);
                    expect(res.result.message).to.equal('boom');
                    done();
                });
            });

            it('replies with error using reply(null, result)', (done) => {

                const server = new Hapi.Server();
                server.connection();
                const onRequest = function (request, reply) {

                    return reply(null, Boom.badRequest('boom'));
                };

                server.ext('onRequest', onRequest);


                const handler = function (request, reply) {

                    return reply('ok');
                };

                server.route({ method: 'GET', path: '/', handler: handler });

                server.inject('/', (res) => {

                    expect(res.result.message).to.equal('boom');
                    done();
                });
            });

            it('replies with a view', (done) => {

                const server = new Hapi.Server();
                server.register(Vision, Hoek.ignore);
                server.connection();

                server.views({
                    engines: { 'html': Handlebars },
                    path: __dirname + '/templates'
                });

                const onRequest = function (request, reply) {

                    return reply.view('test', { message: 'hola!' });
                };

                server.ext('onRequest', onRequest);

                const handler = function (request, reply) {

                    return reply('ok');
                };

                server.route({ method: 'GET', path: '/', handler: handler });

                server.inject('/', (res) => {

                    expect(res.result).to.match(/<div>\r?\n    <h1>hola!<\/h1>\r?\n<\/div>\r?\n/);
                    done();
                });
            });
        });

        describe('onPreResponse', (done) => {

            it('replies with custom response', (done) => {

                const server = new Hapi.Server();
                server.connection();

                const preRequest = function (request, reply) {

                    if (typeof request.response.source === 'string') {
                        return reply(Boom.badRequest('boom'));
                    }

                    return reply.continue();
                };

                server.ext('onPreResponse', preRequest);

                server.route({
                    method: 'GET',
                    path: '/text',
                    handler: function (request, reply) {

                        return reply('ok');
                    }
                });

                server.route({
                    method: 'GET',
                    path: '/obj',
                    handler: function (request, reply) {

                        return reply({ status: 'ok' });
                    }
                });

                server.inject({ method: 'GET', url: '/text' }, (res1) => {

                    expect(res1.result.message).to.equal('boom');
                    server.inject({ method: 'GET', url: '/obj' }, (res2) => {

                        expect(res2.result.status).to.equal('ok');
                        done();
                    });
                });
            });

            it('intercepts 404 responses', (done) => {

                const server = new Hapi.Server();
                server.connection();

                const preResponse = function (request, reply) {

                    return reply(null, request.response.output.statusCode);
                };

                server.ext('onPreResponse', preResponse);

                server.inject({ method: 'GET', url: '/missing' }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal(404);
                    done();
                });
            });

            it('intercepts 404 when using directory handler and file is missing', (done) => {

                const server = new Hapi.Server();
                server.register(Inert, Hoek.ignore);
                server.connection();

                const preResponse = function (request, reply) {

                    const response = request.response;
                    return reply({ isBoom: response.isBoom });
                };

                server.ext('onPreResponse', preResponse);

                server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './somewhere', listing: false, index: true } } });

                server.inject('/missing', (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result.isBoom).to.equal(true);
                    done();
                });
            });

            it('intercepts 404 when using file handler and file is missing', (done) => {

                const server = new Hapi.Server();
                server.register(Inert, Hoek.ignore);
                server.connection();

                const preResponse = function (request, reply) {

                    const response = request.response;
                    return reply({ isBoom: response.isBoom });
                };

                server.ext('onPreResponse', preResponse);

                server.route({ method: 'GET', path: '/{path*}', handler: { file: './somewhere/something.txt' } });

                server.inject('/missing', (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result.isBoom).to.equal(true);
                    done();
                });
            });

            it('cleans unused file stream when response is overridden', { skip: process.platform === 'win32' }, (done) => {

                const server = new Hapi.Server();
                server.register(Inert, Hoek.ignore);
                server.connection();

                const preResponse = function (request, reply) {

                    return reply({ something: 'else' });
                };

                server.ext('onPreResponse', preResponse);

                server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './' } } });

                server.inject('/package.json', (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result.something).to.equal('else');

                    const cmd = ChildProcess.spawn('lsof', ['-p', process.pid]);
                    let lsof = '';
                    cmd.stdout.on('data', (buffer) => {

                        lsof += buffer.toString();
                    });

                    cmd.stdout.on('end', () => {

                        let count = 0;
                        const lines = lsof.split('\n');
                        for (let i = 0; i < lines.length; ++i) {
                            count += !!lines[i].match(/package.json/);
                        }

                        expect(count).to.equal(0);
                        done();
                    });

                    cmd.stdin.end();
                });
            });

            it('executes multiple extensions', (done) => {

                const server = new Hapi.Server();
                server.connection();

                const preResponse1 = function (request, reply) {

                    request.response.source = request.response.source + '1';
                    return reply.continue();
                };

                server.ext('onPreResponse', preResponse1);

                const preResponse2 = function (request, reply) {

                    request.response.source = request.response.source + '2';
                    return reply.continue();
                };

                server.ext('onPreResponse', preResponse2);

                const handler = function (request, reply) {

                    return reply('0');
                };

                server.route({ method: 'GET', path: '/', handler: handler });

                server.inject({ method: 'GET', url: '/' }, (res) => {

                    expect(res.result).to.equal('012');
                    done();
                });
            });
        });
    });

    describe('route()', () => {

        it('emits route event', (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: 'a' });
            server.on('route', (route, connection, srv) => {

                expect(route.path).to.equal('/');
                expect(connection.settings.labels).to.deep.equal(['a']);
                expect(srv).to.equal(server);
                done();
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply();
                }
            });
        });

        it('overrides the default notFound handler', (done) => {

            const handler = function (request, reply) {

                return reply('found');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: '*', path: '/{p*}', handler: handler });
            server.inject({ method: 'GET', url: '/page' }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('found');
                done();
            });
        });

        it('responds to HEAD requests for a GET route', (done) => {

            const handler = function (request, reply) {

                return reply('ok').etag('test').code(205);
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/', handler: handler });
            server.inject({ method: 'HEAD', url: '/' }, (res) => {

                expect(res.statusCode).to.equal(205);
                expect(res.headers['content-type']).to.contain('text/html');
                expect(res.headers['content-length']).to.not.exist();
                expect(res.headers.etag).to.equal('"test"');
                expect(res.result).to.not.exist();
                done();
            });
        });

        it('returns 404 on HEAD requests for non-GET routes', (done) => {

            const handler = function (request, reply) {

                return reply('ok');
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'POST', path: '/', handler: handler });
            server.inject({ method: 'HEAD', url: '/' }, (res1) => {

                expect(res1.statusCode).to.equal(404);
                expect(res1.result).to.not.exist();

                server.inject({ method: 'HEAD', url: '/not-there' }, (res2) => {

                    expect(res2.statusCode).to.equal(404);
                    expect(res2.result).to.not.exist();
                    done();
                });
            });
        });

        it('allows methods array', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const handler = function (request, reply) {

                return reply(request.route.method);
            };

            const config = { method: ['GET', 'PUT', 'POST', 'DELETE'], path: '/', handler: handler };
            server.route(config);
            server.inject({ method: 'HEAD', url: '/' }, (res1) => {

                expect(res1.statusCode).to.equal(200);

                server.inject({ method: 'GET', url: '/' }, (res2) => {

                    expect(res2.statusCode).to.equal(200);
                    expect(res2.payload).to.equal('get');

                    server.inject({ method: 'PUT', url: '/' }, (res3) => {

                        expect(res3.statusCode).to.equal(200);
                        expect(res3.payload).to.equal('put');

                        server.inject({ method: 'POST', url: '/' }, (res4) => {

                            expect(res4.statusCode).to.equal(200);
                            expect(res4.payload).to.equal('post');

                            server.inject({ method: 'DELETE', url: '/' }, (res5) => {

                                expect(res5.statusCode).to.equal(200);
                                expect(res5.payload).to.equal('delete');
                                expect(config.method).to.deep.equal(['GET', 'PUT', 'POST', 'DELETE']);
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('adds routes using single and array methods', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route([
                {
                    method: 'GET',
                    path: '/api/products',
                    handler: handler
                },
                {
                    method: 'GET',
                    path: '/api/products/{id}',
                    handler: handler
                },
                {
                    method: 'POST',
                    path: '/api/products',
                    handler: handler
                },
                {
                    method: ['PUT', 'PATCH'],
                    path: '/api/products/{id}',
                    handler: handler
                },
                {
                    method: 'DELETE',
                    path: '/api/products/{id}',
                    handler: handler
                }
            ]);

            const table = server.table()[0].table;
            const paths = table.map((route) => {

                const obj = {
                    method: route.method,
                    path: route.path
                };
                return obj;
            });

            expect(table).to.have.length(6);
            expect(paths).to.only.deep.include([
                { method: 'get', path: '/api/products' },
                { method: 'get', path: '/api/products/{id}' },
                { method: 'post', path: '/api/products' },
                { method: 'put', path: '/api/products/{id}' },
                { method: 'patch', path: '/api/products/{id}' },
                { method: 'delete', path: '/api/products/{id}' }
            ]);
            done();
        });

        it('throws on methods array with id', (done) => {

            const server = new Hapi.Server();
            server.connection();

            expect(() => {

                server.route({
                    method: ['GET', 'PUT', 'POST', 'DELETE'],
                    path: '/',
                    config: {
                        id: 'abc',
                        handler: function (request, reply) {

                            return reply(request.route.method);
                        }
                    }
                });
            }).to.throw('Route id abc for path / conflicts with existing path /');
            done();
        });
    });

    describe('_defaultRoutes()', () => {

        it('returns 404 when making a request to a route that does not exist', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.inject({ method: 'GET', url: '/nope' }, (res) => {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('returns 400 on bad request', (done) => {

            const handler = function (request, reply) {

                return reply();
            };

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/a/{p}', handler: handler });
            server.inject('/a/%', (res) => {

                expect(res.statusCode).to.equal(400);
                done();
            });
        });
    });
});
