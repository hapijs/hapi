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


describe('Plugin', function () {

    describe('handler()', function () {

        it('errors on duplicate handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.handler('proxy', function () { });
            }).to.throw('Handler name already exists: proxy');
            done();
        });

        it('errors on unknown handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.route({ method: 'GET', path: '/', handler: { test: {} } });
            }).to.throw('Unknown handler: test');
            done();
        });

        it('errors on non-string name', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.handler();
            }).to.throw('Invalid handler name');
            done();
        });

        it('errors on non-function handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.handler('foo', 'bar');
            }).to.throw('Handler must be a function: foo');
            done();
        });
    });
});
