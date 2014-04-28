// Load modules

var Lab = require('lab');
var Hapi = require('..');
var Schema = require('../lib/schema');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Schema', function () {

    describe('#server', function () {

        it('fails when unknown properties exist', function (done) {

            var settings = { unknown: true, something: {} };

            expect(function () {

                Schema.assert('server', settings);
            }).to.throw('Invalid server options');
            done();
        });

        it('fails when unknown properties exist', function (done) {

            var server = new Hapi.Server();
            server.settings.unknown = true;

            expect(function () {

                Schema.assert('server', server.settings);
            }).to.throw('Invalid server options');
            done();
        });

        it('fails when unknown child properties exist', function (done) {

            var server = new Hapi.Server();
            server.settings.router = { unknown: true };

            expect(function () {

                Schema.assert('server', server.settings);
            }).to.throw('Invalid server options');
            done();
        });

        it('succeeds with default settings returned from server', function (done) {

            var server = new Hapi.Server();

            expect(function () {

                Schema.assert('server', server.settings);
            }).to.not.throw();
            done();
        });

        it('succeeds with only a couple of settings provided', function (done) {

            expect(function () {

                var server = new Hapi.Server({ cache: 'catbox-memory' });
            }).to.not.throw();
            done();
        });

        it('succeeds with extension cache', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ cache: { engine: {}, partition: 'gilden-yak' } });
            };

            expect(fn).to.not.throw();
            done();
        });
    });

    describe('#route', function () {

        it('fails when unknown properties exist', function (done) {

            var options = { method: 'GET', path: '/', handler: function () { }, unknown: true };
            expect(function () {

                Schema.assert('route', options, '/');
            }).to.throw('Invalid route options (/)');
            done();
        });

        it('fails when a required property is missing', function (done) {

            var options = { method: 'GET' };
            expect(function () {

                Schema.assert('route', options, '/');
            }).to.throw('Invalid route options (/)');
            done();
        });

        it('succeeds when required fields are present', function (done) {

            var options = { method: 'GET', path: '/', handler: function () { } };
            expect(function () {

                Schema.assert('route', options, '/');
            }).to.not.throw();
            done();
        });

        it('succeeds when route config has a description', function (done) {

            var options = { method: 'GET', path: '/', handler: function () { }, config: { description: 'here is my description' } };

            expect(function () {

                Schema.assert('route', options, '/');
            }).to.not.throw();
            done();
        });
    });

    describe('#routeConfig', function () {

        it('fails when config payload has invalid value', function (done) {

            var config = { payload: 'something' };
            expect(function () {

                Schema.assert('routeConfig', config, '/');
            }).to.throw('Invalid routeConfig options (/)');
            done();
        });

        it('succeeds when route config has a description', function (done) {

            var config = { description: 'here is my description' };
            expect(function () {

                Schema.assert('routeConfig', config, '/');
            }).to.not.throw();
            done();
        });

        it('succeeds validating cache config', function (done) {
            var config = { handler: internals.item, cache: { expiresIn: 20000 } };
            expect(function () {

                Schema.assert('routeConfig', config, '/');
            }).to.not.throw();
            done();
        });
    });

    describe('#view', function () {

        it('fails on invalid config', function (done) {

            var config = {};
            expect(Schema.view(config)).to.exist;
            done();
        });
        
        it('succeeds with minimal config', function(done) {
            var config = {
                module: "baz",
                path: "foo",
                defaultExtension: "bar"
            };
            expect(Schema.view(config)).to.not.exist;
            done();
        });
    });
});