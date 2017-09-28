'use strict';

// Load modules

const ChildProcess = require('child_process');
const Fs = require('fs');
const Http = require('http');
const Https = require('https');
const Net = require('net');
const Os = require('os');
const Path = require('path');
const TLS = require('tls');

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

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Server', () => {

    it('sets connections defaults', async () => {

        const server = new Hapi.Server({ app: { message: 'test defaults' } });
        expect(server.settings.app.message).to.equal('test defaults');
    });

    it('overrides mime settings', async () => {

        const options = {
            mime: {
                override: {
                    'node/module': {
                        source: 'steve',
                        compressible: false,
                        extensions: ['node', 'module', 'npm'],
                        type: 'node/module'
                    }
                }
            }
        };

        const server = new Hapi.Server(options);
        expect(server.mime.path('file.npm').type).to.equal('node/module');
        expect(server.mime.path('file.npm').source).to.equal('steve');
    });

    it('allows null port and host', async () => {

        expect(() => {

            new Hapi.Server({ host: null, port: null });
        }).to.not.throw();
    });

    it('does not throw when given a default authentication strategy', async () => {

        expect(() => {

            new Hapi.Server({ routes: { auth: 'test' } });
        }).not.to.throw();
    });

    it('throws when disabling autoListen and providing a port', async () => {

        expect(() => {

            new Hapi.Server({ port: 80, autoListen: false });
        }).to.throw('Cannot specify port when autoListen is false');
    });

    it('throws when disabling autoListen and providing special host', async () => {

        const port = Path.join(__dirname, 'hapi-server.socket');
        expect(() => {

            new Hapi.Server({ port, autoListen: false });
        }).to.throw('Cannot specify port when autoListen is false');
    });

    it('defaults address to 0.0.0.0 or :: when no host is provided', async () => {

        const server = new Hapi.Server();
        await server.start();

        let expectedBoundAddress = '0.0.0.0';
        if (Net.isIPv6(server.listener.address().address)) {
            expectedBoundAddress = '::';
        }

        expect(server.info.address).to.equal(expectedBoundAddress);
        await server.stop();
    });

    it('uses address when present instead of host', async () => {

        const server = new Hapi.Server({ host: 'no.such.domain.hapi', address: 'localhost' });
        await server.start();
        expect(server.info.host).to.equal('no.such.domain.hapi');
        expect(server.info.address).to.equal('127.0.0.1');
        await server.stop();
    });

    it('uses uri when present instead of host and port', async () => {

        const server = new Hapi.Server({ host: 'no.such.domain.hapi', address: 'localhost', uri: 'http://uri.example.com:8080' });
        expect(server.info.uri).to.equal('http://uri.example.com:8080');
        await server.start();
        expect(server.info.host).to.equal('no.such.domain.hapi');
        expect(server.info.address).to.equal('127.0.0.1');
        expect(server.info.uri).to.equal('http://uri.example.com:8080');
        await server.stop();
    });

    it('throws on uri ending with /', async () => {

        expect(() => {

            new Hapi.Server({ uri: 'http://uri.example.com:8080/' });
        }).to.throw(/Invalid server options/);
    });

    it('creates a server listening on a unix domain socket', { skip: process.platform === 'win32' }, async () => {

        const port = Path.join(__dirname, 'hapi-server.socket');
        const server = new Hapi.Server({ port });

        expect(server.type).to.equal('socket');

        await server.start();
        const absSocketPath = Path.resolve(port);
        expect(server.info.port).to.equal(absSocketPath);
        await server.stop();

        if (Fs.existsSync(port)) {
            Fs.unlinkSync(port);
        }
    });

    it('creates a server listening on a windows named pipe', async () => {

        const port = '\\\\.\\pipe\\6653e55f-26ec-4268-a4f2-882f4089315c';
        const server = new Hapi.Server({ port });

        expect(server.type).to.equal('socket');

        await server.start();
        expect(server.info.port).to.equal(port);
        await server.stop();
    });

    it('creates an https server when passed tls options', async () => {

        const tlsOptions = {
            key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
            cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
        };

        const server = new Hapi.Server({ tls: tlsOptions });
        expect(server.listener instanceof Https.Server).to.equal(true);
    });

    it('uses a provided listener', async () => {

        const listener = Http.createServer();
        const server = new Hapi.Server({ listener });
        server.route({ method: 'GET', path: '/', handler: () => 'ok' });

        await server.start();
        const { payload } = await Wreck.get('http://localhost:' + server.info.port + '/');
        expect(payload.toString()).to.equal('ok');
        await server.stop();
    });

    it('uses a provided listener (TLS)', async () => {

        const listener = Http.createServer();
        const server = new Hapi.Server({ listener, tls: true });
        server.route({ method: 'GET', path: '/', handler: () => 'ok' });

        await server.start();
        expect(server.info.protocol).to.equal('https');
        await server.stop();
    });

    it('uses a provided listener with manual listen', async () => {

        const listener = Http.createServer();
        const server = new Hapi.Server({ listener, autoListen: false });
        server.route({ method: 'GET', path: '/', handler: () => 'ok' });

        const listen = () => {

            return new Promise((resolve) => listener.listen(0, 'localhost', resolve));
        };

        await listen();
        await server.start();
        const { payload } = await Wreck.get('http://localhost:' + server.info.port + '/');
        expect(payload.toString()).to.equal('ok');
        await server.stop();
    });

    it('sets info.uri with default localhost when no hostname', async () => {

        const orig = Os.hostname;
        Os.hostname = function () {

            Os.hostname = orig;
            return '';
        };

        const server = new Hapi.Server({ port: 80 });
        expect(server.info.uri).to.equal('http://localhost:80');
    });

    it('sets info.uri without port when 0', async () => {

        const server = new Hapi.Server({ host: 'example.com' });
        expect(server.info.uri).to.equal('http://example.com');
    });

    it('closes connection on socket timeout', async () => {

        const server = new Hapi.Server({ routes: { timeout: { socket: 50 }, payload: { timeout: 45 } } });
        server.route({
            method: 'GET', path: '/', config: {
                handler: async (request) => {

                    await internals.wai(70);
                    return 'too late';
                }
            }
        });

        await server.start();
        try {
            await Wreck.request('GET', 'http://localhost:' + server.info.port + '/');
        }
        catch (err) {
            expect(err.message).to.equal('Client request error: socket hang up');
        }

        await server.stop();
    });

    it('disables node socket timeout', { parallel: false }, async () => {

        const server = new Hapi.Server({ routes: { timeout: { socket: false } } });
        server.route({ method: 'GET', path: '/', handler: () => null });

        await server.start();

        let timeout;
        const orig = Net.Socket.prototype.setTimeout;
        Net.Socket.prototype.setTimeout = function () {

            timeout = 'gotcha';
            Net.Socket.prototype.setTimeout = orig;
            return orig.apply(this, arguments);
        };

        const res = await Wreck.request('GET', 'http://localhost:' + server.info.port + '/');
        await Wreck.read(res);
        expect(timeout).to.equal('gotcha');
        await server.stop();
    });

    it('throws on invalid config', async () => {

        expect(() => {

            new Hapi.Server({ something: false });
        }).to.throw(/Invalid server options/);
    });

    it('combines configuration from server and defaults (cors)', async () => {

        const server = new Hapi.Server({ routes: { cors: { origin: ['example.com'] } } });
        expect(server.settings.routes.cors.origin).to.equal(['example.com']);
    });

    it('combines configuration from server and defaults (security)', async () => {

        const server = new Hapi.Server({ routes: { security: { hsts: 2, xss: false } } });
        expect(server.settings.routes.security.hsts).to.equal(2);
        expect(server.settings.routes.security.xss).to.be.false();
        expect(server.settings.routes.security.xframe).to.equal('deny');
    });

    describe('start()', () => {

        it('starts and stops', async () => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            await server.start();
            expect(server._started).to.equal(true);

            await server.stop();
            expect(server._started).to.equal(false);
            expect(started).to.equal(1);
            expect(stopped).to.equal(1);
        });

        it('initializes, starts, and stops', async () => {

            const server = new Hapi.Server();

            let started = 0;
            let stopped = 0;

            server.events.on('start', () => {

                ++started;
            });

            server.events.on('stop', () => {

                ++stopped;
            });

            await server.initialize();
            await server.start();
            expect(server._started).to.equal(true);

            await server.stop();
            expect(server._started).to.equal(false);
            expect(started).to.equal(1);
            expect(stopped).to.equal(1);
        });

        it('does not re-initialize the server', async () => {

            const server = new Hapi.Server();
            await server.initialize();
            await server.initialize();
        });

        it('returns connection start error', async () => {

            const server1 = new Hapi.Server();
            await server1.start();
            const port = server1.info.port;

            const server2 = new Hapi.Server({ port });
            await expect(server2.start()).to.reject(/EADDRINUSE/);

            await server1.stop();
        });

        it('returns onPostStart error', async () => {

            const server = new Hapi.Server();

            const postStart = function (srv) {

                throw new Error('boom');
            };

            server.ext('onPostStart', postStart);

            await expect(server.start()).to.reject('boom');
        });

        it('errors on bad cache start', async () => {

            const cache = {
                engine: {
                    start: function (callback) {

                        return callback(new Error('oops'));
                    },
                    stop: function () { }
                }
            };

            const server = new Hapi.Server({ cache });
            await expect(server.start()).to.reject('oops');
        });

        it('fails to start server when registration incomplete', async () => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            server.register(plugin);
            await expect(server.start()).to.reject('Cannot start server before plugins finished registration');
        });

        it('fails to initialize server when not stopped', async () => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            await server.start();
            await expect(server.initialize()).to.reject('Cannot initialize server while it is in started phase');
        });

        it('fails to start server when starting', async () => {

            const plugin = function () { };
            plugin.attributes = { name: 'plugin' };

            const server = new Hapi.Server();
            const starting = server.start();
            await expect(server.start()).to.reject('Cannot start server while it is in initializing phase');
            await starting;
            await server.stop();
        });
    });

    describe('stop()', () => {

        it('stops the cache', async () => {

            const server = new Hapi.Server();
            const cache = server.cache({ segment: 'test', expiresIn: 1000 });
            await server.initialize();

            await cache.set('a', 'going in', 0);
            const { value: value1 } = await cache.get('a');
            expect(value1).to.equal('going in');
            await server.stop();
            await expect(cache.get('a')).to.reject();
        });

        it('returns an extension error (onPreStop)', async () => {

            const server = new Hapi.Server();
            const preStop = function (srv) {

                throw new Error('failed cleanup');
            };

            server.ext('onPreStop', preStop);

            await server.start();
            await expect(server.stop()).to.reject('failed cleanup');
        });

        it('returns an extension error (onPostStop)', async () => {

            const server = new Hapi.Server();

            const postStop = function (srv) {

                throw new Error('failed cleanup');
            };

            server.ext('onPostStop', postStop);

            await server.start();
            await expect(server.stop()).to.reject('failed cleanup');
        });

        it('errors when stopping a stopping server', async () => {

            const server = new Hapi.Server();

            const stopping = server.stop();
            await expect(server.stop()).to.reject('Cannot stop server while in stopping phase');
            await stopping;
        });
    });

    describe('_init()', () => {

        it('clears connections on close (HTTP)', async () => {

            const server = new Hapi.Server();

            let count = 0;
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    ++count;
                    return reply.abandon;
                }
            });

            await server.start();
            const promise = Wreck.request('GET', `http://localhost:${server.info.port}/`, { rejectUnauthorized: false });

            await Hoek.wait(50);
            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(1);
            expect(Object.keys(server._sockets).length).to.equal(1);
            expect(count).to.equal(1);

            promise.req.abort();
            await expect(promise).to.reject();

            const count2 = await internals.countConnections(server);
            expect(count2).to.equal(0);
            expect(Object.keys(server._sockets).length).to.equal(0);
            expect(count).to.equal(1);
            await server.stop();
        });

        it('clears connections on close (HTTPS)', async () => {

            const tlsOptions = {
                key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
            };

            const server = new Hapi.Server({ tls: tlsOptions });

            let count = 0;
            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    ++count;
                    return reply.abandon;
                }
            });

            await server.start();
            const promise = Wreck.request('GET', `https://localhost:${server.info.port}/`, { rejectUnauthorized: false });

            await Hoek.wait(50);
            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(1);
            expect(Object.keys(server._sockets).length).to.equal(1);
            expect(count).to.equal(1);

            promise.req.abort();
            await expect(promise).to.reject();

            const count2 = await internals.countConnections(server);
            expect(count2).to.equal(0);
            expect(Object.keys(server._sockets).length).to.equal(0);
            expect(count).to.equal(1);
            await server.stop();
        });
    });

    describe('_start()', () => {

        it('starts connection', async () => {

            const server = new Hapi.Server();
            await server.start();
            let expectedBoundAddress = '0.0.0.0';
            if (Net.isIPv6(server.listener.address().address)) {
                expectedBoundAddress = '::';
            }

            expect(server.info.host).to.equal(Os.hostname());
            expect(server.info.address).to.equal(expectedBoundAddress);
            expect(server.info.port).to.be.a.number().and.above(1);
            await server.stop();
        });

        it('starts connection (tls)', async () => {

            const tlsOptions = {
                key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
            };

            const server = new Hapi.Server({ host: '0.0.0.0', port: 0, tls: tlsOptions });
            await server.start();
            expect(server.info.host).to.equal('0.0.0.0');
            expect(server.info.port).to.not.equal(0);
            await server.stop();
        });

        it('sets info with defaults when missing hostname and address', { parallel: false }, async () => {

            const hostname = Os.hostname;
            Os.hostname = function () {

                Os.hostname = hostname;
                return '';
            };

            const server = new Hapi.Server({ port: '8000' });
            expect(server.info.host).to.equal('localhost');
            expect(server.info.uri).to.equal('http://localhost:8000');
        });

        it('ignored repeated calls', async () => {

            const server = new Hapi.Server();
            await server.start();
            await server.start();
            await server.stop();
        });
    });

    describe('_stop()', () => {

        it('waits to stop until all connections are closed (HTTP)', async () => {

            const server = new Hapi.Server();
            await server.start();

            const socket1 = await internals.socket(server);
            const socket2 = await internals.socket(server);

            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(2);
            expect(Object.keys(server._sockets).length).to.equal(2);

            const stop = server.stop();
            socket1.end();
            socket2.end();

            await stop;
            await Hoek.wait(10);

            const count2 = await internals.countConnections(server);
            expect(count2).to.equal(0);
            expect(Object.keys(server._sockets).length).to.equal(0);
        });

        it('waits to stop until all connections are closed (HTTPS)', async () => {

            const tlsOptions = {
                key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
            };

            const server = new Hapi.Server({ tls: tlsOptions });
            await server.start();

            const socket1 = await internals.socket(server, 'tls');
            const socket2 = await internals.socket(server, 'tls');

            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(2);
            expect(Object.keys(server._sockets).length).to.equal(2);

            const stop = server.stop();
            socket1.end();
            socket2.end();

            await stop;
            await Hoek.wait(10);

            const count2 = await internals.countConnections(server);
            expect(count2).to.equal(0);
            expect(Object.keys(server._sockets).length).to.equal(0);
        });

        it('immediately destroys unhandled connections', async () => {

            const server = new Hapi.Server();
            await server.start();

            await internals.socket(server);
            await internals.socket(server);

            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(2);

            const timer = new Hoek.Bench();
            await server.stop({ timeout: 20 });
            expect(timer.elapsed()).to.be.at.most(20);
        });

        it('waits to destroy handled connections until after the timeout', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, reply) => reply.abandon });
            await server.start();

            const socket = await internals.socket(server);
            socket.write('GET / HTTP/1.0\nHost: test\n\n');
            await Hoek.wait(10);

            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(1);

            const timer = new Hoek.Bench();
            await server.stop({ timeout: 20 });
            expect(timer.elapsed()).to.be.at.least(19);
        });

        it('waits to destroy connections if they close by themselves', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request, reply) => reply.abandon });
            await server.start();

            const socket = await internals.socket(server);
            socket.write('GET / HTTP/1.0\nHost: test\n\n');
            await Hoek.wait(10);

            const count1 = await internals.countConnections(server);
            expect(count1).to.equal(1);

            setTimeout(() => socket.end(), 10);

            const timer = new Hoek.Bench();
            await server.stop({ timeout: 200 });
            expect(timer.elapsed()).to.be.below(20);
        });

        it('immediately destroys idle keep-alive connections', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            await server.start();

            const socket = await internals.socket(server);
            socket.write('GET / HTTP/1.1\nHost: test\nConnection: Keep-Alive\n\n\n');
            await new Promise((resolve) => socket.on('data', resolve));

            const count = await internals.countConnections(server);
            expect(count).to.equal(1);

            const timer = new Hoek.Bench();
            await server.stop({ timeout: 20 });
            expect(timer.elapsed()).to.be.at.most(20);
        });

        it('refuses to handle new incoming requests on persistent connections', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });
            await server.start();

            const agent = new Http.Agent({ keepAlive: true, maxSockets: 1 });
            const first = Wreck.get('http://localhost:' + server.info.port + '/', { agent });
            const second = Wreck.get('http://localhost:' + server.info.port + '/', { agent });

            const { res, payload } = await first;
            const stop = server.stop();

            await expect(second).to.reject();
            await stop;

            expect(res.headers.connection).to.equal('keep-alive');
            expect(payload.toString()).to.equal('ok');
            expect(server._started).to.equal(false);
        });

        it('finishes in-progress requests and ends connection', async () => {

            let stop;
            const handler = async (request) => {

                stop = server.stop({ timeout: 200 });
                await Hoek.wait(0);
                return 'ok';
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const agent = new Http.Agent({ keepAlive: true, maxSockets: 1 });

            const first = Wreck.get('http://localhost:' + server.info.port + '/', { agent });
            const second = Wreck.get('http://localhost:' + server.info.port + '/404', { agent });

            const { res, payload } = await first;
            expect(res.headers.connection).to.equal('close');
            expect(payload.toString()).to.equal('ok');

            await expect(second).to.reject();
            await expect(stop).to.not.reject();
        });

        it('does not close longpoll HTTPS requests before response (if within timeout)', async () => {

            const tlsOptions = {
                key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0UqyXDCqWDKpoNQQK/fdr0OkG4gW6DUafxdufH9GmkX/zoKz\ng/SFLrPipzSGINKWtyMvo7mPjXqqVgE10LDI3VFV8IR6fnART+AF8CW5HMBPGt/s\nfQW4W4puvBHkBxWSW1EvbecgNEIS9hTGvHXkFzm4xJ2e9DHp2xoVAjREC73B7JbF\nhc5ZGGchKw+CFmAiNysU0DmBgQcac0eg2pWoT+YGmTeQj6sRXO67n2xy/hA1DuN6\nA4WBK3wM3O4BnTG0dNbWUEbe7yAbV5gEyq57GhJIeYxRvveVDaX90LoAqM4cUH06\n6rciON0UbDHV2LP/JaH5jzBjUyCnKLLo5snlbwIDAQABAoIBAQDJm7YC3pJJUcxb\nc8x8PlHbUkJUjxzZ5MW4Zb71yLkfRYzsxrTcyQA+g+QzA4KtPY8XrZpnkgm51M8e\n+B16AcIMiBxMC6HgCF503i16LyyJiKrrDYfGy2rTK6AOJQHO3TXWJ3eT3BAGpxuS\n12K2Cq6EvQLCy79iJm7Ks+5G6EggMZPfCVdEhffRm2Epl4T7LpIAqWiUDcDfS05n\nNNfAGxxvALPn+D+kzcSF6hpmCVrFVTf9ouhvnr+0DpIIVPwSK/REAF3Ux5SQvFuL\njPmh3bGwfRtcC5d21QNrHdoBVSN2UBLmbHUpBUcOBI8FyivAWJhRfKnhTvXMFG8L\nwaXB51IZAoGBAP/E3uz6zCyN7l2j09wmbyNOi1AKvr1WSmuBJveITouwblnRSdvc\nsYm4YYE0Vb94AG4n7JIfZLKtTN0xvnCo8tYjrdwMJyGfEfMGCQQ9MpOBXAkVVZvP\ne2k4zHNNsfvSc38UNSt7K0HkVuH5BkRBQeskcsyMeu0qK4wQwdtiCoBDAoGBANF7\nFMppYxSW4ir7Jvkh0P8bP/Z7AtaSmkX7iMmUYT+gMFB5EKqFTQjNQgSJxS/uHVDE\nSC5co8WGHnRk7YH2Pp+Ty1fHfXNWyoOOzNEWvg6CFeMHW2o+/qZd4Z5Fep6qCLaa\nFvzWWC2S5YslEaaP8DQ74aAX4o+/TECrxi0z2lllAoGAdRB6qCSyRsI/k4Rkd6Lv\nw00z3lLMsoRIU6QtXaZ5rN335Awyrfr5F3vYxPZbOOOH7uM/GDJeOJmxUJxv+cia\nPQDflpPJZU4VPRJKFjKcb38JzO6C3Gm+po5kpXGuQQA19LgfDeO2DNaiHZOJFrx3\nm1R3Zr/1k491lwokcHETNVkCgYBPLjrZl6Q/8BhlLrG4kbOx+dbfj/euq5NsyHsX\n1uI7bo1Una5TBjfsD8nYdUr3pwWltcui2pl83Ak+7bdo3G8nWnIOJ/WfVzsNJzj7\n/6CvUzR6sBk5u739nJbfgFutBZBtlSkDQPHrqA7j3Ysibl3ZIJlULjMRKrnj6Ans\npCDwkQKBgQCM7gu3p7veYwCZaxqDMz5/GGFUB1My7sK0hcT7/oH61yw3O8pOekee\nuctI1R3NOudn1cs5TAy/aypgLDYTUGQTiBRILeMiZnOrvQQB9cEf7TFgDoRNCcDs\nV/ZWiegVB/WY7H0BkCekuq5bHwjgtJTpvHGqQ9YD7RhE8RSYOhdQ/Q==\n-----END RSA PRIVATE KEY-----\n',
                cert: '-----BEGIN CERTIFICATE-----\nMIIDBjCCAe4CCQDvLNml6smHlTANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0\ncyBQdHkgTHRkMB4XDTE0MDEyNTIxMjIxOFoXDTE1MDEyNTIxMjIxOFowRTELMAkG\nA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0\nIFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB\nANFKslwwqlgyqaDUECv33a9DpBuIFug1Gn8Xbnx/RppF/86Cs4P0hS6z4qc0hiDS\nlrcjL6O5j416qlYBNdCwyN1RVfCEen5wEU/gBfAluRzATxrf7H0FuFuKbrwR5AcV\nkltRL23nIDRCEvYUxrx15Bc5uMSdnvQx6dsaFQI0RAu9weyWxYXOWRhnISsPghZg\nIjcrFNA5gYEHGnNHoNqVqE/mBpk3kI+rEVzuu59scv4QNQ7jegOFgSt8DNzuAZ0x\ntHTW1lBG3u8gG1eYBMquexoSSHmMUb73lQ2l/dC6AKjOHFB9Ouq3IjjdFGwx1diz\n/yWh+Y8wY1Mgpyiy6ObJ5W8CAwEAATANBgkqhkiG9w0BAQUFAAOCAQEAoSc6Skb4\ng1e0ZqPKXBV2qbx7hlqIyYpubCl1rDiEdVzqYYZEwmst36fJRRrVaFuAM/1DYAmT\nWMhU+yTfA+vCS4tql9b9zUhPw/IDHpBDWyR01spoZFBF/hE1MGNpCSXXsAbmCiVf\naxrIgR2DNketbDxkQx671KwF1+1JOMo9ffXp+OhuRo5NaGIxhTsZ+f/MA4y084Aj\nDI39av50sTRTWWShlN+J7PtdQVA5SZD97oYbeUeL7gI18kAJww9eUdmT0nEjcwKs\nxsQT1fyKbo7AlZBY4KSlUMuGnn0VnAsB9b+LxtXlDfnjyM8bVQx1uAfRo0DO8p/5\n3J5DTjAU55deBQ==\n-----END CERTIFICATE-----\n'
            };

            const server = new Hapi.Server({ tls: tlsOptions });

            let stop;
            const handler = async (request) => {

                stop = server.stop({ timeout: 200 });
                await Hoek.wait(150);
                return 'ok';
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const agent = new Https.Agent({ keepAlive: true, maxSockets: 1, rejectUnauthorized: false });
            const { res, payload } = await Wreck.get('https://localhost:' + server.info.port + '/', { agent });
            expect(res.headers.connection).to.equal('close');
            expect(payload.toString()).to.equal('ok');

            await stop;
        });

        it('removes connection event listeners after it stops', async () => {

            const server = new Hapi.Server();
            const initial = server.listener.listeners('connection').length;
            await server.start();

            expect(server.listener.listeners('connection').length).to.be.greaterThan(initial);

            await server.stop();
            await server.start();
            await server.stop();

            expect(server.listener.listeners('connection').length).to.equal(initial);
        });

        it('ignores repeated calls', async () => {

            const server = new Hapi.Server();
            await server.stop();
            await server.stop();
        });
    });

    describe('_dispatch()', () => {

        it('rejects request due to high rss load', { parallel: false }, async () => {

            const server = new Hapi.Server({ load: { sampleInterval: 5, maxRssBytes: 1 } });

            const handler = (request) => {

                const start = Date.now();
                while (Date.now() - start < 10) { }
                return 'ok';
            };

            const log = server.events.once('log');

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            const res1 = await server.inject('/');
            expect(res1.statusCode).to.equal(200);

            await Hoek.wait(0);
            const res2 = await server.inject('/');
            expect(res2.statusCode).to.equal(503);

            const [event, tags] = await log;
            expect(event.internal).to.be.true();
            expect(event.data.rss > 10000).to.equal(true);
            expect(tags.load).to.be.true();

            await server.stop();
        });
    });

    describe('inject()', () => {

        it('keeps the options.credentials object untouched', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const options = {
                url: '/',
                credentials: { foo: 'bar' }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(options.credentials).to.exist();
        });

        it('sets credentials (with host header)', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => null });

            const options = {
                url: '/',
                credentials: { foo: 'bar' },
                headers: {
                    host: 'something'
                }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(options.credentials).to.exist();
        });

        it('sets credentials (with authority)', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.headers.host });

            const options = {
                url: '/',
                credentials: { foo: 'bar' },
                authority: 'something'
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('something');
            expect(options.credentials).to.exist();
        });

        it('sets authority', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.headers.host });

            const options = {
                url: '/',
                authority: 'something'
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('something');
        });

        it('passes the options.artifacts object', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.auth.artifacts });

            const options = {
                url: '/',
                credentials: { foo: 'bar' },
                artifacts: { bar: 'baz' }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result.bar).to.equal('baz');
            expect(options.artifacts).to.exist();
        });

        it('sets app settings', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.app.x });

            const options = {
                url: '/',
                authority: 'x',             // For coverage
                app: {
                    x: 123
                }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(123);
        });

        it('sets plugins settings', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.plugins.x.y });

            const options = {
                url: '/',
                authority: 'x',             // For coverage
                plugins: {
                    x: {
                        y: 123
                    }
                }
            };

            const res = await server.inject(options);
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(123);
        });

        it('returns the request object', async () => {

            const handler = (request) => {

                request.app.key = 'value';
                return null;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.request.app.key).to.equal('value');
        });

        it('can set a client remoteAddress', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.info.remoteAddress });

            const res = await server.inject({ url: '/', remoteAddress: '1.2.3.4' });
            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('1.2.3.4');
        });

        it('sets a default remoteAddress of 127.0.0.1', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: (request) => request.info.remoteAddress });

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('127.0.0.1');
        });

        it('sets correct host header', async () => {

            const server = new Hapi.Server({ host: 'example.com', port: 2080 });
            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.headers.host
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('example.com:2080');
        });
    });

    describe('table()', () => {

        it('returns an array of the current routes', async () => {

            const server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: () => null });
            server.route({ path: '/test/{p}/end', method: 'get', handler: () => null });

            const routes = server.table()[0].table;
            expect(routes.length).to.equal(2);
            expect(routes[0].path).to.equal('/test/');
        });

        it('combines global and vhost routes', async () => {

            const server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/{p}/end', method: 'get', handler: () => null });

            const routes = server.table()[0].table;
            expect(routes.length).to.equal(4);
        });

        it('combines global and vhost routes and filters based on host', async () => {

            const server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/{p}/end', method: 'get', handler: () => null });

            const routes = server.table('one.example.com')[0].table;
            expect(routes.length).to.equal(3);
        });

        it('accepts a list of hosts', async () => {

            const server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/{p}/end', method: 'get', handler: () => null });

            const routes = server.table(['one.example.com', 'two.example.com'])[0].table;
            expect(routes.length).to.equal(4);
        });

        it('ignores unknown host', async () => {

            const server = new Hapi.Server();

            server.route({ path: '/test/', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'one.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/', vhost: 'two.example.com', method: 'get', handler: () => null });
            server.route({ path: '/test/{p}/end', method: 'get', handler: () => null });

            const routes = server.table('three.example.com')[0].table;
            expect(routes.length).to.equal(2);
        });
    });

    describe('ext()', () => {

        it('supports adding an array of methods', async () => {

            const server = new Hapi.Server();
            server.ext('onPreHandler', [
                (request, reply) => {

                    request.app.x = '1';
                    return reply.continue;
                },
                (request, reply) => {

                    request.app.x += '2';
                    return reply.continue;
                }
            ]);

            server.route({ method: 'GET', path: '/', handler: (request) => request.app.x });

            const res = await server.inject('/');
            expect(res.result).to.equal('12');
        });

        it('sets bind via options', async () => {

            const server = new Hapi.Server();
            const preHandler = function (request, reply) {

                request.app.x = this.y;
                return reply.continue;
            };

            server.ext('onPreHandler', preHandler, { bind: { y: 42 } });

            server.route({ method: 'GET', path: '/', handler: (request) => request.app.x });

            const res = await server.inject('/');
            expect(res.result).to.equal(42);
        });

        it('uses server views for ext added via server', async () => {

            const server = new Hapi.Server();
            await server.register(Vision);

            server.views({
                engines: { html: Handlebars },
                path: __dirname + '/templates'
            });

            const preHandler = (request, reply) => {

                return reply.view('test').takeover();
            };

            server.ext('onPreHandler', preHandler);

            const test = function (plugin, options) {

                plugin.views({
                    engines: { html: Handlebars },
                    path: './no_such_directory_found'
                });

                plugin.route({ path: '/view', method: 'GET', handler: () => null });
            };

            test.attributes = {
                name: 'test'
            };

            await server.register(test);
            const res = await server.inject('/view');
            expect(res.statusCode).to.equal(200);
        });

        it('supports reply decorators on empty result', async () => {

            const server = new Hapi.Server();
            const onRequest = (request, reply) => {

                return reply().redirect('/elsewhere').takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('/elsewhere');
        });

        it('supports direct reply decorators', async () => {

            const server = new Hapi.Server();
            const onRequest = (request, reply) => {

                return reply.redirect('/elsewhere').takeover();
            };

            server.ext('onRequest', onRequest);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('/elsewhere');
        });

        it('skips extensions once takeover is called', async () => {

            const server = new Hapi.Server();

            const preResponse1 = (request, reply) => {

                return reply(1).takeover();
            };

            server.ext('onPreResponse', preResponse1);

            let called = false;
            const preResponse2 = (request) => {

                called = true;
                return 2;
            };

            server.ext('onPreResponse', preResponse2);

            server.route({ method: 'GET', path: '/', handler: () => 0 });

            const res = await server.inject({ method: 'GET', url: '/' });
            expect(res.result).to.equal(1);
            expect(called).to.be.false();
        });

        it('executes all extensions with return values', async () => {

            const server = new Hapi.Server();
            server.ext('onPreResponse', () => 1);

            let called = false;
            const preResponse2 = (request) => {

                called = true;
                return 2;
            };

            server.ext('onPreResponse', preResponse2);
            server.route({ method: 'GET', path: '/', handler: () => 0 });

            const res = await server.inject({ method: 'GET', url: '/' });
            expect(res.result).to.equal(2);
            expect(called).to.be.true();
        });

        describe('onRequest', async () => {

            it('replies with custom response', async () => {

                const server = new Hapi.Server();
                const onRequest = (request) => {

                    throw Boom.badRequest('boom');
                };

                server.ext('onRequest', onRequest);

                const res = await server.inject('/');
                expect(res.statusCode).to.equal(400);
                expect(res.result.message).to.equal('boom');
            });

            it('replies with a view', async () => {

                const server = new Hapi.Server();
                await server.register(Vision);

                server.views({
                    engines: { 'html': Handlebars },
                    path: __dirname + '/templates'
                });

                const onRequest = (request, reply) => {

                    return reply.view('test', { message: 'hola!' }).takeover();
                };

                server.ext('onRequest', onRequest);

                server.route({ method: 'GET', path: '/', handler: () => 'ok' });

                const res = await server.inject('/');
                expect(res.result).to.match(/<div>\r?\n    <h1>hola!<\/h1>\r?\n<\/div>\r?\n/);
            });
        });

        describe('onPreResponse', async () => {

            it('replies with custom response', async () => {

                const server = new Hapi.Server();

                const preRequest = (request, reply) => {

                    if (typeof request.response.source === 'string') {
                        throw Boom.badRequest('boom');
                    }

                    return reply.continue;
                };

                server.ext('onPreResponse', preRequest);

                server.route({
                    method: 'GET',
                    path: '/text',
                    handler: () => 'ok'
                });

                server.route({
                    method: 'GET',
                    path: '/obj',
                    handler: () => ({ status: 'ok' })
                });

                const res1 = await server.inject({ method: 'GET', url: '/text' });
                expect(res1.result.message).to.equal('boom');

                const res2 = await server.inject({ method: 'GET', url: '/obj' });
                expect(res2.result.status).to.equal('ok');
            });

            it('intercepts 404 responses', async () => {

                const server = new Hapi.Server();

                const preResponse = (request, reply) => {

                    return reply(request.response.output.statusCode).takeover();
                };

                server.ext('onPreResponse', preResponse);

                const res = await server.inject({ method: 'GET', url: '/missing' });
                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(404);
            });

            it('intercepts 404 when using directory handler and file is missing', async () => {

                const server = new Hapi.Server();
                await server.register(Inert);

                const preResponse = (request) => {

                    const response = request.response;
                    return { isBoom: response.isBoom };
                };

                server.ext('onPreResponse', preResponse);

                server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './somewhere', listing: false, index: true } } });

                const res = await server.inject('/missing');
                expect(res.statusCode).to.equal(200);
                expect(res.result.isBoom).to.equal(true);
            });

            it('intercepts 404 when using file handler and file is missing', async () => {

                const server = new Hapi.Server();
                await server.register(Inert);

                const preResponse = (request) => {

                    const response = request.response;
                    return { isBoom: response.isBoom };
                };

                server.ext('onPreResponse', preResponse);

                server.route({ method: 'GET', path: '/{path*}', handler: { file: './somewhere/something.txt' } });

                const res = await server.inject('/missing');
                expect(res.statusCode).to.equal(200);
                expect(res.result.isBoom).to.equal(true);
            });

            it('cleans unused file stream when response is overridden', { skip: process.platform === 'win32' }, async () => {

                const server = new Hapi.Server();
                await server.register(Inert);

                const preResponse = (request) => {

                    return { something: 'else' };
                };

                server.ext('onPreResponse', preResponse);

                server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './' } } });

                const res = await server.inject('/package.json');
                expect(res.statusCode).to.equal(200);
                expect(res.result.something).to.equal('else');

                await new Promise((resolve) => {

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
                        resolve();
                    });

                    cmd.stdin.end();
                });
            });

            it('executes multiple extensions', async () => {

                const server = new Hapi.Server();

                const preResponse1 = (request, reply) => {

                    request.response.source = request.response.source + '1';
                    return reply.continue;
                };

                server.ext('onPreResponse', preResponse1);

                const preResponse2 = (request, reply) => {

                    request.response.source = request.response.source + '2';
                    return reply.continue;
                };

                server.ext('onPreResponse', preResponse2);
                server.route({ method: 'GET', path: '/', handler: () => '0' });

                const res = await server.inject({ method: 'GET', url: '/' });
                expect(res.result).to.equal('012');
            });
        });
    });

    describe('route()', () => {

        it('emits route event', async () => {

            const server = new Hapi.Server();
            const log = server.events.once('route');

            server.route({
                method: 'GET',
                path: '/',
                handler: () => null
            });

            const [route, srv] = await log;
            expect(route.path).to.equal('/');
            expect(srv).to.shallow.equal(server);
        });

        it('overrides the default notFound handler', async () => {

            const server = new Hapi.Server();
            server.route({ method: '*', path: '/{p*}', handler: () => 'found' });
            const res = await server.inject({ method: 'GET', url: '/page' });
            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('found');
        });

        it('responds to HEAD requests for a GET route', async () => {

            const handler = (request, reply) => {

                return reply('ok').etag('test').code(205);
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler });
            const res1 = await server.inject({ method: 'GET', url: '/' });

            expect(res1.statusCode).to.equal(205);
            expect(res1.headers['content-type']).to.equal('text/html; charset=utf-8');
            expect(res1.headers['content-length']).to.equal(2);
            expect(res1.headers.etag).to.equal('"test"');
            expect(res1.result).to.equal('ok');

            const res2 = await server.inject({ method: 'HEAD', url: '/' });
            expect(res2.statusCode).to.equal(res1.statusCode);
            expect(res2.headers['content-type']).to.equal(res1.headers['content-type']);
            expect(res2.headers['content-length']).to.equal(res1.headers['content-length']);
            expect(res2.headers.etag).to.equal(res1.headers.etag);
            expect(res2.result).to.not.exist();
        });

        it('returns 404 on HEAD requests for non-GET routes', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'POST', path: '/', handler: () => 'ok' });

            const res1 = await server.inject({ method: 'HEAD', url: '/' });
            expect(res1.statusCode).to.equal(404);
            expect(res1.result).to.not.exist();

            const res2 = await server.inject({ method: 'HEAD', url: '/not-there' });

            expect(res2.statusCode).to.equal(404);
            expect(res2.result).to.not.exist();
        });

        it('returns 500 on HEAD requests for failed responses', async () => {

            const preResponse = (request, reply) => {

                request.response._processors.marshal = function (response, callback) {

                    process.nextTick(callback, new Error('boom!'));
                };

                return reply.continue;
            };

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/', handler: () => 'ok' });
            server.ext('onPreResponse', preResponse);

            const res1 = await server.inject({ method: 'GET', url: '/' });
            expect(res1.statusCode).to.equal(500);
            expect(res1.result).to.exist();

            const res2 = await server.inject({ method: 'HEAD', url: '/' });
            expect(res2.statusCode).to.equal(res1.statusCode);
            expect(res2.headers['content-type']).to.equal(res1.headers['content-type']);
            expect(res2.headers['content-length']).to.equal(res1.headers['content-length']);
            expect(res2.result).to.not.exist();
        });

        it('allows methods array', async () => {

            const server = new Hapi.Server();
            const config = { method: ['GET', 'PUT', 'POST', 'DELETE'], path: '/', handler: (request) => request.route.method };
            server.route(config);
            expect(config.method).to.equal(['GET', 'PUT', 'POST', 'DELETE']);                       // Ensure config is cloned

            const res1 = await server.inject({ method: 'HEAD', url: '/' });
            expect(res1.statusCode).to.equal(200);

            const res2 = await server.inject({ method: 'GET', url: '/' });
            expect(res2.statusCode).to.equal(200);
            expect(res2.payload).to.equal('get');

            const res3 = await server.inject({ method: 'PUT', url: '/' });
            expect(res3.statusCode).to.equal(200);
            expect(res3.payload).to.equal('put');

            const res4 = await server.inject({ method: 'POST', url: '/' });
            expect(res4.statusCode).to.equal(200);
            expect(res4.payload).to.equal('post');

            const res5 = await server.inject({ method: 'DELETE', url: '/' });
            expect(res5.statusCode).to.equal(200);
            expect(res5.payload).to.equal('delete');
        });

        it('adds routes using single and array methods', async () => {

            const server = new Hapi.Server();
            server.route([
                {
                    method: 'GET',
                    path: '/api/products',
                    handler: () => null
                },
                {
                    method: 'GET',
                    path: '/api/products/{id}',
                    handler: () => null
                },
                {
                    method: 'POST',
                    path: '/api/products',
                    handler: () => null
                },
                {
                    method: ['PUT', 'PATCH'],
                    path: '/api/products/{id}',
                    handler: () => null
                },
                {
                    method: 'DELETE',
                    path: '/api/products/{id}',
                    handler: () => null
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
            expect(paths).to.only.include([
                { method: 'get', path: '/api/products' },
                { method: 'get', path: '/api/products/{id}' },
                { method: 'post', path: '/api/products' },
                { method: 'put', path: '/api/products/{id}' },
                { method: 'patch', path: '/api/products/{id}' },
                { method: 'delete', path: '/api/products/{id}' }
            ]);
        });

        it('throws on methods array with id', async () => {

            const server = new Hapi.Server();

            expect(() => {

                server.route({
                    method: ['GET', 'PUT', 'POST', 'DELETE'],
                    path: '/',
                    config: {
                        id: 'abc',
                        handler: (request) => request.route.method
                    }
                });
            }).to.throw('Route id abc for path / conflicts with existing path /');
        });
    });

    describe('_defaultRoutes()', () => {

        it('returns 404 when making a request to a route that does not exist', async () => {

            const server = new Hapi.Server();
            const res = await server.inject({ method: 'GET', url: '/nope' });
            expect(res.statusCode).to.equal(404);
        });

        it('returns 400 on bad request', async () => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/a/{p}', handler: () => null });
            const res = await server.inject('/a/%');
            expect(res.statusCode).to.equal(400);
        });
    });

    describe('load', { parallel: false }, () => {

        it('measures loop delay', async () => {

            const server = new Hapi.Server({ load: { sampleInterval: 4 } });

            const handler = (request) => {

                const start = Date.now();
                while (Date.now() - start < 5) { }
                return 'ok';
            };

            server.route({ method: 'GET', path: '/', handler });
            await server.start();

            await server.inject('/');
            expect(server.load.eventLoopDelay).to.be.below(6);

            await Hoek.wait(0);

            await server.inject('/');
            expect(server.load.eventLoopDelay).to.be.above(0);

            await Hoek.wait(0);

            await server.inject('/');
            expect(server.load.eventLoopDelay).to.be.above(0);
            expect(server.load.heapUsed).to.be.above(1024 * 1024);
            expect(server.load.rss).to.be.above(1024 * 1024);
            await server.stop();
        });
    });
});


internals.countConnections = function (server) {

    return new Promise((resolve, reject) => {

        server.listener.getConnections((err, count) => {

            return (err ? reject(err) : resolve(count));
        });
    });
};


internals.socket = function (server, mode) {

    const socket = new Net.Socket();
    socket.on('error', Hoek.ignore);

    if (mode === 'tls') {
        socket.connect(server.info.port, '127.0.0.1');
        return new Promise((resolve) => TLS.connect({ socket, rejectUnauthorized: false }, () => resolve(socket)));
    }

    return new Promise((resolve) => socket.connect(server.info.port, '127.0.0.1', () => resolve(socket)));
};
