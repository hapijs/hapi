'use strict';

// Load modules

const Path = require('path');

const Code = require('code');
const Hapi = require('..');
const Inert = require('inert');
const Joi = require('joi');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Route', () => {

    it('registers with config function', async () => {

        const server = Hapi.server();
        server.bind({ a: 1 });
        server.app.b = 2;
        server.route({
            method: 'GET',
            path: '/',
            config: function (srv) {

                const a = this.a;

                return {
                    handler: () => (a + srv.app.b)
                };
            }
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(3);
    });

    it('throws an error when a route is missing a path', async () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ method: 'GET', handler: () => null });
        }).to.throw('Route missing path');
    });

    it('throws an error when a route is missing a method', async () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ path: '/', handler: () => null });
        }).to.throw(/"method" is required/);
    });

    it('throws an error when a route has a malformed method name', async () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ method: '"GET"', path: '/', handler: () => null });
        }).to.throw(/Invalid route options/);
    });

    it('throws an error when a route uses the HEAD method', async () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ method: 'HEAD', path: '/', handler: () => null });
        }).to.throw(/Method name not allowed/);
    });

    it('throws an error when a route is missing a handler', async () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ path: '/test', method: 'put' });
        }).to.throw('Missing or undefined handler: put /test');
    });

    it('throws when handler is missing in config', async () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'GET', path: '/', config: {} });
        }).to.throw('Missing or undefined handler: GET /');
    });

    it('throws when path has trailing slash and server set to strip', async () => {

        const server = Hapi.server({ router: { stripTrailingSlash: true } });
        expect(() => {

            server.route({ method: 'GET', path: '/test/', handler: () => null });
        }).to.throw('Path cannot end with a trailing slash when configured to strip: GET /test/');
    });

    it('allows / when path has trailing slash and server set to strip', async () => {

        const server = Hapi.server({ router: { stripTrailingSlash: true } });
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: () => null });
        }).to.not.throw();
    });

    it('sets route plugins and app settings', async () => {

        const handler = (request) => (request.route.settings.app.x + request.route.settings.plugins.x.y);
        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', config: { handler, app: { x: 'o' }, plugins: { x: { y: 'k' } } } });
        const res = await server.inject('/');
        expect(res.result).to.equal('ok');
    });

    it('throws when validation is set without payload parsing', async () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'POST', path: '/', handler: () => null, config: { validate: { payload: {} }, payload: { parse: false } } });
        }).to.throw('Route payload must be set to \'parse\' when payload validation enabled: POST /');
    });

    it('throws when validation is set without path parameters', async () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'POST', path: '/', handler: () => null, config: { validate: { params: {} } } });
        }).to.throw('Cannot set path parameters validations without path parameters: POST /');
    });

    it('ignores payload parsing errors', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            handler: () => 'ok',
            config: {
                payload: {
                    parse: true,
                    failAction: 'ignore'
                }
            }
        });

        const res = await server.inject({ method: 'POST', url: '/', payload: '{a:"abc"}' });
        expect(res.statusCode).to.equal(200);
    });

    it('logs payload parsing errors', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            handler: () => 'ok',
            config: {
                payload: {
                    parse: true,
                    failAction: 'log'
                }
            }
        });

        let logged;
        server.events.on({ name: 'request', channels: 'internal' }, (request, event, tags) => {

            if (tags.payload && tags.error) {
                logged = event;
            }
        });

        const res = await server.inject({ method: 'POST', url: '/', payload: '{a:"abc"}' });
        expect(res.statusCode).to.equal(200);
        expect(logged).to.be.an.object();
        expect(logged.error).to.be.an.error('Invalid request payload JSON format');
        expect(logged.error.data).to.be.an.error(SyntaxError, /^Unexpected token a/);
    });

    it('returns payload parsing errors', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            handler: () => 'ok',
            config: {
                payload: {
                    parse: true,
                    failAction: 'error'
                }
            }
        });

        const res = await server.inject({ method: 'POST', url: '/', payload: '{a:"abc"}' });
        expect(res.statusCode).to.equal(400);
        expect(res.result.message).to.equal('Invalid request payload JSON format');
    });

    it('replaces payload parsing errors with custom handler', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            handler: () => 'ok',
            config: {
                payload: {
                    parse: true,
                    failAction: function (request, h, error) {

                        return h.response('This is a custom error').code(418).takeover();
                    }
                }
            }
        });

        const res = await server.inject({ method: 'POST', url: '/', payload: '{a:"abc"}' });
        expect(res.statusCode).to.equal(418);
        expect(res.result).to.equal('This is a custom error');
    });

    it('throws when validation is set on GET', async () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: () => null, config: { validate: { payload: {} } } });
        }).to.throw('Cannot validate HEAD or GET requests: GET /');
    });

    it('throws when payload parsing is set on GET', async () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: () => null, config: { payload: { parse: true } } });
        }).to.throw('Cannot set payload settings on HEAD or GET request: GET /');
    });

    it('ignores validation on * route when request is GET', async () => {

        const server = Hapi.server();
        server.route({ method: '*', path: '/', handler: () => null, config: { validate: { payload: { a: Joi.required() } } } });
        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
    });

    it('ignores default validation on GET', async () => {

        const server = Hapi.server({ routes: { validate: { payload: { a: Joi.required() } } } });
        server.route({ method: 'GET', path: '/', handler: () => null });
        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
    });

    it('shallow copies route config bind', async () => {

        const server = Hapi.server();
        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request) {

            return this.key + (this === context);
        };

        server.route({ method: 'GET', path: '/', handler, config: { bind: context } });
        const res = await server.inject('/');
        expect(res.result).to.equal('is true');
        expect(count).to.equal(0);
    });

    it('shallow copies route config bind (server.bind())', async () => {

        const server = Hapi.server();
        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request) {

            return this.key + (this === context);
        };

        server.bind(context);
        server.route({ method: 'GET', path: '/', handler });
        const res = await server.inject('/');
        expect(res.result).to.equal('is true');
        expect(count).to.equal(0);
    });

    it('shallow copies route config bind (connection defaults)', async () => {

        const context = { key: 'is ' };
        const server = Hapi.server({ routes: { bind: context } });

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request) {

            return this.key + (this === context);
        };

        server.route({ method: 'GET', path: '/', handler });
        const res = await server.inject('/');
        expect(res.result).to.equal('is true');
        expect(count).to.equal(0);
    });

    it('shallow copies route config bind (server defaults)', async () => {

        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request) {

            return this.key + (this === context);
        };

        const server = Hapi.server({ routes: { bind: context } });
        server.route({ method: 'GET', path: '/', handler });
        const res = await server.inject('/');
        expect(res.result).to.equal('is true');
        expect(count).to.equal(0);
    });

    it('overrides server relativeTo', async () => {

        const server = Hapi.server();
        await server.register(Inert);
        const handler = (request, h) => h.file('./package.json');
        server.route({ method: 'GET', path: '/file', handler, config: { files: { relativeTo: Path.join(__dirname, '../') } } });

        const res = await server.inject('/file');
        expect(res.payload).to.contain('hapi');
    });

    it('throws when server timeout is more then socket timeout', async () => {

        expect(() => {

            Hapi.server({ routes: { timeout: { server: 60000, socket: 12000 } } });
        }).to.throw('Server timeout must be shorter than socket timeout: _special /{p*}');
    });

    it('throws when server timeout is more then socket timeout (node default)', async () => {

        expect(() => {

            Hapi.server({ routes: { timeout: { server: 6000000 } } });
        }).to.throw('Server timeout must be shorter than socket timeout: _special /{p*}');
    });

    it('ignores large server timeout when socket timeout disabled', async () => {

        expect(() => {

            Hapi.server({ routes: { timeout: { server: 6000000, socket: false } } });
        }).to.not.throw();
    });

    describe('extensions', () => {

        it('combine connection extensions (route last)', async () => {

            const server = Hapi.server();
            const onRequest = (request, h) => {

                request.app.x = '1';
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const preAuth = (request, h) => {

                request.app.x += '2';
                return h.continue;
            };

            server.ext('onPreAuth', preAuth);

            const postAuth = (request, h) => {

                request.app.x += '3';
                return h.continue;
            };

            server.ext('onPostAuth', postAuth);

            const preHandler = (request, h) => {

                request.app.x += '4';
                return h.continue;
            };

            server.ext('onPreHandler', preHandler);

            const postHandler = (request, h) => {

                request.response.source += '5';
                return h.continue;
            };

            server.ext('onPostHandler', postHandler);

            const preResponse = (request, h) => {

                request.response.source += '6';
                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.app.x
            });

            const res = await server.inject('/');
            expect(res.result).to.equal('123456');
        });

        it('combine connection extensions (route first)', async () => {

            const server = Hapi.server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.app.x
            });

            const onRequest = (request, h) => {

                request.app.x = '1';
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const preAuth = (request, h) => {

                request.app.x += '2';
                return h.continue;
            };

            server.ext('onPreAuth', preAuth);

            const postAuth = (request, h) => {

                request.app.x += '3';
                return h.continue;
            };

            server.ext('onPostAuth', postAuth);

            const preHandler = (request, h) => {

                request.app.x += '4';
                return h.continue;
            };

            server.ext('onPreHandler', preHandler);

            const postHandler = (request, h) => {

                request.response.source += '5';
                return h.continue;
            };

            server.ext('onPostHandler', postHandler);

            const preResponse = (request, h) => {

                request.response.source += '6';
                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res = await server.inject('/');
            expect(res.result).to.equal('123456');
        });

        it('combine connection extensions (route middle)', async () => {

            const server = Hapi.server();

            const onRequest = (request, h) => {

                request.app.x = '1';
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const preAuth = (request, h) => {

                request.app.x += '2';
                return h.continue;
            };

            server.ext('onPreAuth', preAuth);

            const postAuth = (request, h) => {

                request.app.x += '3';
                return h.continue;
            };

            server.ext('onPostAuth', postAuth);

            server.route({
                method: 'GET',
                path: '/',
                handler: (request) => request.app.x
            });

            const preHandler = (request, h) => {

                request.app.x += '4';
                return h.continue;
            };

            server.ext('onPreHandler', preHandler);

            const postHandler = (request, h) => {

                request.response.source += '5';
                return h.continue;
            };

            server.ext('onPostHandler', postHandler);

            const preResponse = (request, h) => {

                request.response.source += '6';
                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res = await server.inject('/');
            expect(res.result).to.equal('123456');
        });

        it('combine connection extensions (mixed sources)', async () => {

            const server = Hapi.server();

            const preAuth1 = (request, h) => {

                request.app.x = '1';
                return h.continue;
            };

            server.ext('onPreAuth', preAuth1);

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    ext: {
                        onPreAuth: {
                            method: (request, h) => {

                                request.app.x += '2';
                                return h.continue;
                            }
                        }
                    },
                    handler: (request) => request.app.x
                }
            });

            const preAuth3 = (request, h) => {

                request.app.x += '3';
                return h.continue;
            };

            server.ext('onPreAuth', preAuth3);

            server.route({
                method: 'GET',
                path: '/a',
                handler: (request) => request.app.x
            });

            const res1 = await server.inject('/');
            expect(res1.result).to.equal('123');

            const res2 = await server.inject('/a');
            expect(res2.result).to.equal('13');
        });

        it('skips inner extensions when not found', async () => {

            const server = Hapi.server();

            let state = '';

            const onRequest = (request, h) => {

                state += 1;
                return h.continue;
            };

            server.ext('onRequest', onRequest);

            const preAuth = (request) => {

                state += 2;
                return 'ok';
            };

            server.ext('onPreAuth', preAuth);

            const preResponse = (request, h) => {

                state += 3;
                return h.continue;
            };

            server.ext('onPreResponse', preResponse);

            const res = await server.inject('/');
            expect(res.statusCode).to.equal(404);
            expect(state).to.equal('13');
        });
    });

    describe('drain()', () => {

        it('drains the request payload on 404', async () => {

            const server = Hapi.server();
            const res = await server.inject({ method: 'POST', url: '/nope', payload: 'something' });
            expect(res.statusCode).to.equal(404);
            expect(res.raw.req._readableState.ended).to.be.true();
        });
    });
});
