'use strict';

// Load modules

const Path = require('path');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Inert = require('inert');
const Joi = require('joi');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Route', () => {

    it('throws an error when a route is missing a path', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', handler: function () { } });
        }).to.throw('Route missing path');
        done();
    });

    it('throws an error when a route is made without a connection', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.route({ method: 'GET', path: '/dork', handler: function () { } });
        }).to.throw('Cannot add a route without any connections');
        done();
    });

    it('throws an error when a route is missing a method', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ path: '/', handler: function () { } });
        }).to.throw(/"method" is required/);
        done();
    });

    it('throws an error when a route has a malformed method name', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: '"GET"', path: '/', handler: function () { } });
        }).to.throw(/Invalid route options/);
        done();
    });

    it('throws an error when a route uses the HEAD method', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ method: 'HEAD', path: '/', handler: function () { } });
        }).to.throw(/Method name not allowed/);
        done();
    });

    it('throws an error when a route is missing a handler', (done) => {

        expect(() => {

            const server = new Hapi.Server();
            server.connection();
            server.route({ path: '/test', method: 'put' });
        }).to.throw('Missing or undefined handler: put /test');
        done();
    });

    it('throws when handler is missing in config', (done) => {

        const server = new Hapi.Server();
        server.connection();
        expect(() => {

            server.route({ method: 'GET', path: '/', config: {} });
        }).to.throw('Missing or undefined handler: GET /');
        done();
    });

    it('throws when path has trailing slash and server set to strip', (done) => {

        const server = new Hapi.Server();
        server.connection({ router: { stripTrailingSlash: true } });
        expect(() => {

            server.route({ method: 'GET', path: '/test/', handler: function () { } });
        }).to.throw('Path cannot end with a trailing slash when connection configured to strip: GET /test/');
        done();
    });

    it('allows / when path has trailing slash and server set to strip', (done) => {

        const server = new Hapi.Server();
        server.connection({ router: { stripTrailingSlash: true } });
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: function () { } });
        }).to.not.throw();
        done();
    });

    it('sets route plugins and app settings', (done) => {

        const handler = function (request, reply) {

            return reply(request.route.settings.app.x + request.route.settings.plugins.x.y);
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', config: { handler: handler, app: { x: 'o' }, plugins: { x: { y: 'k' } } } });
        server.inject('/', (res) => {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('throws when validation is set without payload parsing', (done) => {

        const server = new Hapi.Server();
        server.connection();
        expect(() => {

            server.route({ method: 'POST', path: '/', handler: function () { }, config: { validate: { payload: {} }, payload: { parse: false } } });
        }).to.throw('Route payload must be set to \'parse\' when payload validation enabled: POST /');
        done();
    });

    it('throws when validation is set on GET', (done) => {

        const server = new Hapi.Server();
        server.connection();
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: function () { }, config: { validate: { payload: {} } } });
        }).to.throw('Cannot validate HEAD or GET requests: GET /');
        done();
    });

    it('throws when payload parsing is set on GET', (done) => {

        const server = new Hapi.Server();
        server.connection();
        expect(() => {

            server.route({ method: 'GET', path: '/', handler: function () { }, config: { payload: { parse: true } } });
        }).to.throw('Cannot set payload settings on HEAD or GET request: GET /');
        done();
    });

    it('ignores validation on * route when request is GET', (done) => {

        const handler = function (request, reply) {

            return reply();
        };

        const server = new Hapi.Server();
        server.connection();
        server.route({ method: '*', path: '/', handler: handler, config: { validate: { payload: { a: Joi.required() } } } });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('ignores default validation on GET', (done) => {

        const handler = function (request, reply) {

            return reply();
        };

        const server = new Hapi.Server();
        server.connection({ routes: { validate: { payload: { a: Joi.required() } } } });
        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('shallow copies route config bind', (done) => {

        const server = new Hapi.Server();
        server.connection();
        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request, reply) {

            return reply(this.key + (this === context));
        };

        server.route({ method: 'GET', path: '/', handler: handler, config: { bind: context } });
        server.inject('/', (res) => {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('shallow copies route config bind (server.bind())', (done) => {

        const server = new Hapi.Server();
        server.connection();
        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request, reply) {

            return reply(this.key + (this === context));
        };

        server.bind(context);
        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('shallow copies route config bind (connection defaults)', (done) => {

        const server = new Hapi.Server();
        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request, reply) {

            return reply(this.key + (this === context));
        };

        server.connection({ routes: { bind: context } });
        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('shallow copies route config bind (server defaults)', (done) => {

        const context = { key: 'is ' };

        let count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        const handler = function (request, reply) {

            return reply(this.key + (this === context));
        };

        const server = new Hapi.Server({ connections: { routes: { bind: context } } });
        server.connection();
        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('overrides server relativeTo', (done) => {

        const server = new Hapi.Server();
        server.register(Inert, Hoek.ignore);
        server.connection();
        const handler = function (request, reply) {

            return reply.file('./package.json');
        };

        server.route({ method: 'GET', path: '/file', handler: handler, config: { files: { relativeTo: Path.join(__dirname, '../') } } });

        server.inject('/file', (res) => {

            expect(res.payload).to.contain('hapi');
            done();
        });
    });

    it('throws when server timeout is more then socket timeout', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.connection({ routes: { timeout: { server: 60000, socket: 12000 } } });
        }).to.throw('Server timeout must be shorter than socket timeout: _special /{p*}');
        done();
    });

    it('throws when server timeout is more then socket timeout (node default)', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.connection({ routes: { timeout: { server: 6000000 } } });
        }).to.throw('Server timeout must be shorter than socket timeout: _special /{p*}');
        done();
    });

    it('ignores large server timeout when socket timeout disabled', (done) => {

        const server = new Hapi.Server();
        expect(() => {

            server.connection({ routes: { timeout: { server: 6000000, socket: false } } });
        }).to.not.throw();
        done();
    });

    describe('extensions', () => {

        it('combine connection extensions (route last)', (done) => {

            const server = new Hapi.Server();
            server.connection();
            const onRequest = function (request, reply) {

                request.app.x = '1';
                return reply.continue();
            };

            server.ext('onRequest', onRequest);

            const preAuth = function (request, reply) {

                request.app.x += '2';
                return reply.continue();
            };

            server.ext('onPreAuth', preAuth);

            const postAuth = function (request, reply) {

                request.app.x += '3';
                return reply.continue();
            };

            server.ext('onPostAuth', postAuth);

            const preHandler = function (request, reply) {

                request.app.x += '4';
                return reply.continue();
            };

            server.ext('onPreHandler', preHandler);

            const postHandler = function (request, reply) {

                request.response.source += '5';
                return reply.continue();
            };

            server.ext('onPostHandler', postHandler);

            const preResponse = function (request, reply) {

                request.response.source += '6';
                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.app.x);
                }
            });

            server.inject('/', (res) => {

                expect(res.result).to.equal('123456');
                done();
            });
        });

        it('combine connection extensions (route first)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.app.x);
                }
            });

            const onRequest = function (request, reply) {

                request.app.x = '1';
                return reply.continue();
            };

            server.ext('onRequest', onRequest);

            const preAuth = function (request, reply) {

                request.app.x += '2';
                return reply.continue();
            };

            server.ext('onPreAuth', preAuth);

            const postAuth = function (request, reply) {

                request.app.x += '3';
                return reply.continue();
            };

            server.ext('onPostAuth', postAuth);

            const preHandler = function (request, reply) {

                request.app.x += '4';
                return reply.continue();
            };

            server.ext('onPreHandler', preHandler);

            const postHandler = function (request, reply) {

                request.response.source += '5';
                return reply.continue();
            };

            server.ext('onPostHandler', postHandler);

            const preResponse = function (request, reply) {

                request.response.source += '6';
                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.inject('/', (res) => {

                expect(res.result).to.equal('123456');
                done();
            });
        });

        it('combine connection extensions (route middle)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const onRequest = function (request, reply) {

                request.app.x = '1';
                return reply.continue();
            };

            server.ext('onRequest', onRequest);

            const preAuth = function (request, reply) {

                request.app.x += '2';
                return reply.continue();
            };

            server.ext('onPreAuth', preAuth);

            const postAuth = function (request, reply) {

                request.app.x += '3';
                return reply.continue();
            };

            server.ext('onPostAuth', postAuth);

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    return reply(request.app.x);
                }
            });

            const preHandler = function (request, reply) {

                request.app.x += '4';
                return reply.continue();
            };

            server.ext('onPreHandler', preHandler);

            const postHandler = function (request, reply) {

                request.response.source += '5';
                return reply.continue();
            };

            server.ext('onPostHandler', postHandler);

            const preResponse = function (request, reply) {

                request.response.source += '6';
                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.inject('/', (res) => {

                expect(res.result).to.equal('123456');
                done();
            });
        });

        it('combine connection extensions (mixed sources)', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const preAuth1 = function (request, reply) {

                request.app.x = '1';
                return reply.continue();
            };

            server.ext('onPreAuth', preAuth1);

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    ext: {
                        onPreAuth: {
                            method: function (request, reply) {

                                request.app.x += '2';
                                return reply.continue();
                            }
                        }
                    },
                    handler: function (request, reply) {

                        return reply(request.app.x);
                    }
                }
            });

            const preAuth3 = function (request, reply) {

                request.app.x += '3';
                return reply.continue();
            };

            server.ext('onPreAuth', preAuth3);

            server.route({
                method: 'GET',
                path: '/a',
                config: {
                    handler: function (request, reply) {

                        return reply(request.app.x);
                    }
                }
            });

            server.inject('/', (res1) => {

                expect(res1.result).to.equal('123');

                server.inject('/a', (res2) => {

                    expect(res2.result).to.equal('13');
                    done();
                });
            });
        });

        it('skips inner extensions when not found', (done) => {

            const server = new Hapi.Server();
            server.connection();

            let state = '';

            const onRequest = function (request, reply) {

                state += 1;
                return reply.continue();
            };

            server.ext('onRequest', onRequest);

            const preAuth = function (request, reply) {

                state += 2;
                return reply('ok');
            };

            server.ext('onPreAuth', preAuth);

            const preResponse = function (request, reply) {

                state += 3;
                return reply.continue();
            };

            server.ext('onPreResponse', preResponse);

            server.inject('/', (res) => {

                expect(res.statusCode).to.equal(404);
                expect(state).to.equal('13');
                done();
            });
        });
    });
});
