'use strict';

const Path = require('path');

const Code = require('@hapi/code');
const Hapi = require('..');
const Inert = require('@hapi/inert');
const Joi = require('joi');
const Lab = require('@hapi/lab');
const Subtext = require('@hapi/subtext');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Route', () => {

    it('registers with options function', async () => {

        const server = Hapi.server();
        server.bind({ a: 1 });
        server.app.b = 2;
        server.route({
            method: 'GET',
            path: '/',
            options: function (srv) {

                const a = this.a;

                return {
                    handler: () => a + srv.app.b
                };
            }
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(3);
    });

    it('registers with config', async () => {

        const server = Hapi.server();
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: () => 'ok'
            }
        });

        const res = await server.inject('/');
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('ok');
    });

    it('throws an error when a route is missing a path', () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ method: 'GET', handler: () => null });
        }).to.throw(/"path" is required/);
    });

    it('throws an error when a route is missing a method', () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ path: '/', handler: () => null });
        }).to.throw(/"method" is required/);
    });

    it('throws an error when a route has a malformed method name', () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ method: '"GET"', path: '/', handler: () => null });
        }).to.throw(/Invalid route options/);
    });

    it('throws an error when a route uses the HEAD method', () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ method: 'HEAD', path: '/', handler: () => null });
        }).to.throw('Cannot set HEAD route: /');
    });

    it('throws an error when a route is missing a handler', () => {

        expect(() => {

            const server = Hapi.server();
            server.route({ path: '/test', method: 'put' });
        }).to.throw('Missing or undefined handler: PUT /test');
    });

    it('throws when handler is missing in config', () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'GET', path: '/', options: {} });
        }).to.throw('Missing or undefined handler: GET /');
    });

    it('throws when path has trailing slash and server set to strip', () => {

        const server = Hapi.server({ router: { stripTrailingSlash: true } });
        expect(() => {

            server.route({ method: 'GET', path: '/test/', handler: () => null });
        }).to.throw('Path cannot end with a trailing slash when configured to strip: GET /test/');
    });

    it('allows / when path has trailing slash and server set to strip', () => {

        const server = Hapi.server({ router: { stripTrailingSlash: true } });
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: () => null });
        }).to.not.throw();
    });

    it('sets route plugins and app settings', async () => {

        const handler = (request) => (request.route.settings.app.x + request.route.settings.plugins.x.y);
        const server = Hapi.server();
        server.route({ method: 'GET', path: '/', options: { handler, app: { x: 'o' }, plugins: { x: { y: 'k' } } } });
        const res = await server.inject('/');
        expect(res.result).to.equal('ok');
    });

    it('throws when validation is set without payload parsing', () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'POST', path: '/', handler: () => null, options: { validate: { payload: {}, validator: Joi }, payload: { parse: false } } });
        }).to.throw('Route payload must be set to \'parse\' when payload validation enabled: POST /');
    });

    it('throws when validation is set without path parameters', () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'POST', path: '/', handler: () => null, options: { validate: { params: {} } } });
        }).to.throw('Cannot set path parameters validations without path parameters: POST /');
    });

    it('ignores payload when overridden', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            handler: (request) => request.payload
        });

        server.ext('onRequest', (request, h) => {

            request.payload = 'x';
            return h.continue;
        });

        const res = await server.inject({ method: 'POST', url: '/', payload: 'y' });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('x');
    });

    it('ignores payload parsing errors', async () => {

        const server = Hapi.server();
        server.route({
            method: 'POST',
            path: '/',
            handler: () => 'ok',
            options: {
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
            options: {
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
            options: {
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
            options: {
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

    it('throws when validation is set on GET', () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: () => null, options: { validate: { payload: {} } } });
        }).to.throw('Cannot validate HEAD or GET request payload: GET /');
    });

    it('throws when payload parsing is set on GET', () => {

        const server = Hapi.server();
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: () => null, options: { payload: { parse: true } } });
        }).to.throw('Cannot set payload settings on HEAD or GET request: GET /');
    });

    it('ignores validation on * route when request is GET', async () => {

        const server = Hapi.server();
        server.validator(Joi);
        server.route({ method: '*', path: '/', handler: () => null, options: { validate: { payload: { a: Joi.required() } } } });
        const res = await server.inject('/');
        expect(res.statusCode).to.equal(204);
    });

    it('ignores validation on * route when request is HEAD', async () => {

        const server = Hapi.server();
        server.validator(Joi);
        server.route({ method: '*', path: '/', handler: () => null, options: { validate: { payload: { a: Joi.required() } } } });
        const res = await server.inject({ url: '/', method: 'HEAD' });
        expect(res.statusCode).to.equal(204);
    });

    it('skips payload on * route when request is HEAD', async (flags) => {

        const orig = Subtext.parse;
        let called = false;
        Subtext.parse = () => {

            called = true;
        };

        flags.onCleanup = () => {

            Subtext.parse = orig;
        };

        const server = Hapi.server();
        server.route({ method: '*', path: '/', handler: () => null });
        const res = await server.inject({ url: '/', method: 'HEAD' });
        expect(res.statusCode).to.equal(204);
        expect(called).to.be.false();
    });

    it('throws error when the default routes payload validation is set without payload parsing', () => {

        expect(() => {

            Hapi.server({ routes: {  validate: { payload: {}, validator: Joi }, payload: { parse: false } } });
        }).to.throw('Route payload must be set to \'parse\' when payload validation enabled');
    });

    it('throws error when the default routes state validation is set without state parsing', () => {

        expect(() => {

            Hapi.server({ routes: {  validate: { state: {}, validator: Joi }, state: { parse: false } } });
        }).to.throw('Route state must be set to \'parse\' when state validation enabled');
    });

    it('ignores default validation on GET', async () => {

        const server = Hapi.server({ routes: { validate: { payload: { a: Joi.required() }, validator: Joi } } });
        server.route({ method: 'GET', path: '/', handler: () => null });
        const res = await server.inject('/');
        expect(res.statusCode).to.equal(204);
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

        server.route({ method: 'GET', path: '/', handler, options: { bind: context } });
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
        server.route({ method: 'GET', path: '/file', handler, options: { files: { relativeTo: Path.join(__dirname, '../') } } });

        const res = await server.inject('/file');
        expect(res.payload).to.contain('hapi');
    });

    it('allows payload timeout more then socket timeout', () => {

        expect(() => {

            Hapi.server({ routes: { payload: { timeout: 60000 }, timeout: { socket: 12000 } } });
        }).to.not.throw();
    });

    it('allows payload timeout more then socket timeout (node default)', () => {

        expect(() => {

            Hapi.server({ routes: { payload: { timeout: 6000000 } } });
        }).to.not.throw();
    });

    it('allows server timeout more then socket timeout', () => {

        expect(() => {

            Hapi.server({ routes: { timeout: { server: 60000, socket: 12000 } } });
        }).to.not.throw();
    });

    it('allows server timeout more then socket timeout (node default)', () => {

        expect(() => {

            Hapi.server({ routes: { timeout: { server: 6000000 } } });
        }).to.not.throw();
    });

    it('ignores large server timeout when socket timeout disabled', () => {

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
                options: {
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

    describe('rules', () => {

        it('compiles rules into config', async () => {

            const server = Hapi.server();
            server.validator(Joi);

            const processor = (rules) => {

                if (!rules) {
                    return null;
                }

                return { validate: { query: { x: rules.x } } };
            };

            server.rules(processor);

            server.route({ path: '/1', method: 'GET', handler: () => null, rules: { x: Joi.number().valid(1) } });
            server.route({ path: '/2', method: 'GET', handler: () => null, rules: { x: Joi.number().valid(2) } });
            server.route({ path: '/3', method: 'GET', handler: () => null });

            expect((await server.inject('/1?x=1')).statusCode).to.equal(204);
            expect((await server.inject('/1?x=2')).statusCode).to.equal(400);
            expect((await server.inject('/2?x=1')).statusCode).to.equal(400);
            expect((await server.inject('/2?x=2')).statusCode).to.equal(204);
            expect((await server.inject('/3?x=1')).statusCode).to.equal(204);
            expect((await server.inject('/3?x=2')).statusCode).to.equal(204);
        });

        it('compiles rules into config (route info)', async () => {

            const server = Hapi.server();

            const processor = (rules, { method, path }) => {

                return { app: { method, path, x: rules.x } };
            };

            server.rules(processor);

            server.route({ path: '/1', method: 'GET', handler: (request) => request.route.settings.app, rules: { x: 1 } });

            expect((await server.inject('/1')).result).to.equal({ x: 1, path: '/1', method: 'get' });
        });

        it('compiles rules into config (validate)', () => {

            const server = Hapi.server();
            server.validator(Joi);

            const processor = (rules) => {

                return { validate: { query: { x: rules.x } } };
            };

            server.rules(processor, { validate: { schema: { x: Joi.number().required() } } });

            server.route({ path: '/1', method: 'GET', handler: () => null, rules: { x: 1 } });
            expect(() => server.route({ path: '/2', method: 'GET', handler: () => null, rules: { x: 'y' } })).to.throw(/must be a number/);
        });

        it('compiles rules into config (validate + options)', () => {

            const server = Hapi.server();
            server.validator(Joi);

            const processor = (rules) => {

                return { validate: { query: { x: rules.x } } };
            };

            server.rules(processor, { validate: { schema: { x: Joi.number().required() }, options: { allowUnknown: false } } });

            server.route({ path: '/1', method: 'GET', handler: () => null, rules: { x: 1 } });
            expect(() => server.route({ path: '/2', method: 'GET', handler: () => null, rules: { x: 1, y: 2 } })).to.throw(/is not allowed/);
        });

        it('cascades rules into configs', async () => {

            const handler = (request) => {

                return request.route.settings.app.x + ':' + Object.keys(request.route.settings.app).join('').slice(0, -1);
            };

            const p1 = {
                name: 'p1',
                register: async (srv) => {

                    const processor = (rules) => {

                        return { app: { x: '1+' + rules.x, 1: true } };
                    };

                    srv.rules(processor);
                    await srv.register(p3);
                    srv.route({ path: '/1', method: 'GET', handler, rules: { x: 1 } });
                }
            };

            const p2 = {
                name: 'p2',
                register: (srv) => {

                    const processor = (rules) => {

                        return { app: { x: '2+' + rules.x, 2: true } };
                    };

                    srv.rules(processor);
                    srv.route({ path: '/2', method: 'GET', handler, rules: { x: 2 } });
                }
            };

            const p3 = {
                name: 'p3',
                register: async (srv) => {

                    const processor = (rules) => {

                        return { app: { x: '3+' + rules.x, 3: true } };
                    };

                    srv.rules(processor);
                    await srv.register(p4);
                    srv.route({ path: '/3', method: 'GET', handler, rules: { x: 3 } });
                }
            };

            const p4 = {
                name: 'p4',
                register: async (srv) => {

                    await srv.register(p5);
                    srv.route({ path: '/4', method: 'GET', handler, rules: { x: 4 } });
                }
            };

            const p5 = {
                name: 'p5',
                register: (srv) => {

                    const processor = (rules) => {

                        return { app: { x: '5+' + rules.x, 5: true } };
                    };

                    srv.rules(processor);
                    srv.route({ path: '/5', method: 'GET', handler, rules: { x: 5 } });
                    srv.route({ path: '/6', method: 'GET', handler, rules: { x: 6 }, config: { app: { x: '7' } } });
                }
            };

            const server = Hapi.server();

            const processor0 = (rules) => {

                return { app: { x: '0+' + rules.x, 0: true } };
            };

            server.rules(processor0);
            await server.register([p1, p2]);

            server.route({ path: '/0', method: 'GET', handler, rules: { x: 0 } });

            expect((await server.inject('/0')).result).to.equal('0+0:0');
            expect((await server.inject('/1')).result).to.equal('1+1:01');
            expect((await server.inject('/2')).result).to.equal('2+2:02');
            expect((await server.inject('/3')).result).to.equal('3+3:013');
            expect((await server.inject('/4')).result).to.equal('3+4:013');
            expect((await server.inject('/5')).result).to.equal('5+5:0135');
            expect((await server.inject('/6')).result).to.equal('7:0135');
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
