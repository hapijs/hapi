// Load modules

var Code = require('code');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Route', function () {

    it('throws an error when a route is missing a path', function (done) {

        expect(function () {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', handler: function () { } });
        }).to.throw('Route missing path');
        done();
    });

    it('throws an error when a route is missing a method', function (done) {

        expect(function () {

            var server = new Hapi.Server();
            server.connection();
            server.route({ path: '/test', handler: function () { } });
        }).to.throw(/method is required/);
        done();
    });

    it('throws an error when a route is missing a handler', function (done) {

        expect(function () {

            var server = new Hapi.Server();
            server.connection();
            server.route({ path: '/test', method: 'put' });
        }).to.throw('Missing or undefined handler: put /test');
        done();
    });

    it('throws when handler is missing in config', function (done) {

        var server = new Hapi.Server();
        server.connection();
        expect(function () {
            server.route({ method: 'GET', path: '/', config: {} });
        }).to.throw('Missing or undefined handler: GET /');
        done();
    });

    it('throws when path has trailing slash and server set to strip', function (done) {

        var server = new Hapi.Server();
        server.connection({ router: { stripTrailingSlash: true } });
        expect(function () {

            server.route({ method: 'GET', path: '/test/', handler: function () { } });
        }).to.throw('Path cannot end with a trailing slash when connection configured to strip: GET /test/');
        done();
    });

    it('allows / when path has trailing slash and server set to strip', function (done) {

        var server = new Hapi.Server();
        server.connection({ router: { stripTrailingSlash: true } });
        expect(function () {

            server.route({ method: 'GET', path: '/', handler: function () { } });
        }).to.not.throw();
        done();
    });

    it('sets route plugins and app settings', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', config: { handler: function (request, reply) { return reply(request.route.settings.app.x + request.route.settings.plugins.x.y); }, app: { x: 'o' }, plugins: { x: { y: 'k' } } } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('throws when validation is set without payload parsing', function (done) {

        var server = new Hapi.Server();
        server.connection();
        expect(function () {

            server.route({ method: 'POST', path: '/', handler: function () { }, config: { validate: { payload: {} }, payload: { parse: false } } });
        }).to.throw('Route payload must be set to \'parse\' when payload validation enabled: POST /');
        done();
    });

    it('shallow copies route config bind', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var context = { key: 'is ' };

        var count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(this.key + (this === context)); }, config: { bind: context } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('shallow copies route config bind (server.bind())', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var context = { key: 'is ' };

        var count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        server.bind(context);
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(this.key + (this === context)); } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('shallow copies route config bind (connection defaults)', function (done) {

        var server = new Hapi.Server();
        var context = { key: 'is ' };

        var count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        server.connection({ routes: { bind: context } });
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('' + this.key + (this === context)); } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('shallow copies route config bind (server defaults)', function (done) {

        var context = { key: 'is ' };

        var count = 0;
        Object.defineProperty(context, 'test', {
            enumerable: true,
            configurable: true,
            get: function () {

                ++count;
            }
        });

        var server = new Hapi.Server({ connections: { routes: { bind: context } } });
        server.connection();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(this.key + (this === context)); } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
            expect(count).to.equal(0);
            done();
        });
    });

    it('overrides server relativeTo', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var handler = function (request, reply) {

            return reply.file('../package.json');
        };

        server.route({ method: 'GET', path: '/file', handler: handler, config: { files: { relativeTo: __dirname } } });

        server.inject('/file', function (res) {

            expect(res.payload).to.contain('hapi');
            done();
        });
    });

    it('throws when server timeout is more then socket timeout', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.connection({ routes: { timeout: { server: 60000, socket: 12000 } } });
        }).to.throw('Server timeout must be shorter than socket timeout: /{p*}');
        done();
    });

    it('throws when server timeout is more then socket timeout (node default)', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.connection({ routes: { timeout: { server: 6000000 } } });
        }).to.throw('Server timeout must be shorter than socket timeout: /{p*}');
        done();
    });

    it('ignores large server timeout when socket timeout disabled', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.connection({ routes: { timeout: { server: 6000000, socket: false } } });
        }).to.not.throw();
        done();
    });
});
