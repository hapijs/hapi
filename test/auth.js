// Load modules

var Lab = require('lab');
var Boom = require('boom');
var Hapi = require('..');
var Hoek = require('hoek');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Auth', function () {

    it('requires and authenticates a request', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(401);

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('authenticates using multiple strategies', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('first', 'custom', { users: { steve: 'skip' } });
        server.auth.strategy('second', 'custom', { users: { steve: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.strategy); },
                auth: {
                    strategies: ['first', 'second']
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('second');
            done();
        });
    });

    it('authenticates using credentials object', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });

        var doubleHandler = function (request, reply) {

            var options = { url: '/2', credentials: request.auth.credentials };
            server.inject(options, function (res) {

                reply(res.result);
            });
        };

        server.route({ method: 'GET', path: '/1', handler: doubleHandler });
        server.route({ method: 'GET', path: '/2', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject({ url: '/1', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('authenticates a request with custom auth settings', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    strategy: 'default'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('authenticates a request with auth strategy name config', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: 'default'
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('enables individual route authentications', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: {} } });
        server.route({
            method: 'GET',
            path: '/1',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: true
            }
        });
        server.route({
            method: 'GET',
            path: '/2',
            config: {
                handler: function (request, reply) { reply('ok'); }
            }
        });

        server.inject('/1', function (res) {

            expect(res.statusCode).to.equal(401);

            server.inject({ url: '/1', headers: { authorization: 'Custom steve' } }, function (res) {

                expect(res.statusCode).to.equal(200);

                server.inject('/2', function (res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });
    });

    it('tries to authenticate a request', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', 'try', { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.isAuthenticated); } });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal(false);

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(true);
                done();
            });
        });
    });

    it('errors on invalid authenticate callback missing both error and credentials', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject({ url: '/', headers: { authorization: 'Custom' } }, function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('errors with log option', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.on('request', function (request, event, tags) {

            if (tags.auth) {
                done();
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom john' } }, function (res) {

            expect(res.statusCode).to.equal(401);
        });
    });

    it('returns a non Error error response', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { message: 'in a bottle' } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject({ url: '/', headers: { authorization: 'Custom message' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('in a bottle');
            done();
        });
    });

    it('ignores a non Error error response when set to try ', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', 'try', { users: { message: 'in a bottle' } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

        server.inject({ url: '/', headers: { authorization: 'Custom message' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('matches scope', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a'] } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    scope: 'a'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('matches array scope', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a', 'b'] } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    scope: ['a', 'c']
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('errors on missing scope', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a'] } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    scope: 'b'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('errors on missing scope property', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    scope: 'b'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('errors on missing scope using arrays', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { scope: ['a', 'b'] } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    scope: ['c', 'd']
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('matches tos', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { tos: '1.0.0' } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    tos: '1.x.x'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('errors on incorrect tos', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { tos: '1.0.0' } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    tos: '2.x.x'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('errors on missing tos', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    tos: '2.x.x'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('matches user entity', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    entity: 'user'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('errors on missing user entity', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { client: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    entity: 'user'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom client' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('matches app entity', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { client: {} } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    entity: 'app'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom client' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('errors on missing app entity', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: { user: 'steve' } } });
        server.route({
            method: 'GET',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    entity: 'app'
                }
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('authenticates request payload', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { validPayload: { payload: null } } });
        server.route({
            method: 'POST',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    payload: 'required'
                }
            }
        });

        server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom validPayload' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('skips request payload by default', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { skip: {} } });
        server.route({
            method: 'POST',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); }
            }
        });

        server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom skip' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('skips request payload when unauthenticated', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { skip: { } } });
        server.route({
            method: 'POST',
            path: '/',
            config: {
                handler: function (request, reply) { reply(); },
                auth: {
                    mode: 'try',
                    payload: 'required'
                }
            }
        });

        server.inject({ method: 'POST', url: '/' }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('skips optional payload', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { optionalPayload: { payload: false } } });
        server.route({
            method: 'POST',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    payload: 'optional'
                }
            }
        });

        server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('errors on missing payload auth when required', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { optionalPayload: { payload: false } } });
        server.route({
            method: 'POST',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    payload: 'required'
                }
            }
        });

        server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom optionalPayload' } }, function (res) {

            expect(res.statusCode).to.equal(401);
            done();
        });
    });

    it('errors on invalid request payload', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { invalidPayload: { payload: Boom.unauthorized('Payload is invalid') } } });
        server.route({
            method: 'POST',
            path: '/',
            config: {
                handler: function (request, reply) { reply(request.auth.credentials.user); },
                auth: {
                    payload: 'required'
                }
            }
        });

        server.inject({ method: 'POST', url: '/', headers: { authorization: 'Custom invalidPayload' } }, function (res) {

            expect(res.statusCode).to.equal(401);
            done();
        });
    });

    it('defaults cache to private if request authenticated', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: { steve: {} } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok').ttl(1000); } });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.headers['cache-control']).to.equal('max-age=1, must-revalidate, private');
            done();
        });
    });

    it('logs error code when authenticate returns a non-error error', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('test', function (server, options) {

            return {
                authenticate: function (request, reply) {

                    reply('Redirecting ...').redirect('/test');
                }
            };
        });

        server.auth.strategy('test', 'test', true, {});

        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('test'); } });

        var result = undefined;
        server.on('request', function (request, event, tags) {

            if (tags.unauthenticated) {
                result = event.data;
            }
        });

        server.inject('/', function (res) {

            expect(result).to.equal(302);
            done();
        });
    });

    it('fails when options default to null', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true);
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('throws when strategy missing scheme', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.auth.strategy('none');
        }).to.throw('Authentication strategy none missing scheme');
        done();
    });

    it('setups route with optional authentication', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', { users: { steve: {} } });

        var handler = function (request, reply) {

            reply(!!request.auth.credentials);
        };
        server.route({ method: 'GET', path: '/', config: { handler: handler, auth: { mode: 'optional' } } });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('false');

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.equal('true');
                done();
            });
        });
    });
});


internals.implementation = function (server, options) {

    var settings = Hoek.clone(options);

    var scheme = {
        authenticate: function (request, reply) {

            var req = request.raw.req;
            var authorization = req.headers.authorization;
            if (!authorization) {
                return reply(Boom.unauthorized(null, 'Custom'));
            }

            var parts = authorization.split(/\s+/);
            if (parts.length !== 2) {
                return reply();
            }

            var username = parts[1];
            var credentials = settings.users[username];

            if (!credentials) {
                return reply(Boom.unauthorized('Missing credentials', 'Custom'), { log: { tags: ['auth', 'custom'], data: 'oops' } });
            }

            if (credentials === 'skip') {
                return reply(Boom.unauthorized(null, 'Custom'));
            }

            if (typeof credentials === 'string') {
                return reply(credentials);
            }

            return reply(null, { credentials: credentials });
        },
        payload: function (request, next) {

            return next(request.auth.credentials.payload);
        },
        response: function (request, next) {

            return next();
        }
    };

    return scheme;
};


