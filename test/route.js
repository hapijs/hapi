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
        server.route({ method: 'GET', path: '/', config: { handler: function (request, reply) { return reply(request.route.app.x + request.route.plugins.x.y); }, app: { x: 'o' }, plugins: { x: { y: 'k' } } } });
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
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(this.key + (this === context)); }, config: { bind: context } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
            done();
        });
    });

    it('shallow copies route config app', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var app = { key: 'is ' };
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(request.route.app.key + (request.route.app === app)); }, config: { app: app } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
            done();
        });
    });

    it('shallow copies route config plugins', function (done) {

        var server = new Hapi.Server();
        server.connection();
        var plugins = { key: 'is ' };
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(request.route.plugins.key + (request.route.plugins === plugins)); }, config: { plugins: plugins } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('is true');
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
});
