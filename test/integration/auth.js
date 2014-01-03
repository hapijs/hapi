// Load modules

var Lab = require('lab');
var Boom = require('boom');
var Hoek = require('hoek');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Auth', function () {

    var users = {
        steve: {
            user: 'steve',
            scope: ['a'],
            tos: '1.0.0'
        },
        message: 'in a bottle'
    };

    it('requires and authenticates a request', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: users });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(401);

            server.inject({ url: '/', headers: { authorization: 'Custom steve' } }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('authenticates using credentials object', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: users });

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
        server.auth.strategy('default', 'custom', true, { users: users });
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
        server.auth.strategy('default', 'custom', { users: users });
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
        server.auth.strategy('default', 'custom', { users: users });
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
        server.auth.strategy('default', 'custom', 'try', { users: users });
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
        server.auth.strategy('default', 'custom', true, { users: users });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.inject({ url: '/', headers: { authorization: 'Custom' } }, function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('errors with log option', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: users });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.auth.credentials.user); } });

        server.on('request', function (request, event, tags) {

            if (tags.auth) {
                done();
            }
        });

        server.inject({ url: '/', headers: { authorization: 'Custom john' } }, function (res) {

            expect(res.statusCode).to.equal(500);
        });
    });

    it('returns a non Error error response', function (done) {

        var server = new Hapi.Server();
        server.auth.scheme('custom', internals.implementation);
        server.auth.strategy('default', 'custom', true, { users: users });
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
        server.auth.strategy('default', 'custom', 'try', { users: users });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

        server.inject({ url: '/', headers: { authorization: 'Custom message' } }, function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('ok');
            done();
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
                return reply(Boom.internal('Missing'), { log: { tags: ['auth', 'custom'], data: 'oops' } });
            }

            if (typeof credentials === 'string') {
                return reply(credentials);
            }

            return reply(null, { credentials: credentials });
        }
    };

    return scheme;
};


