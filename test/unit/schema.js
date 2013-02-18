// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');
var Schema = require('../../lib/schema');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;

var S = Hapi.types.String,
    N = Hapi.types.Number,
    O = Hapi.types.Object,
    B = Hapi.types.Boolean;


describe('Schema', function () {

    describe('#server', function () {

        it('fails when unknown properties exist', function (done) {

            var settings = { unknown: true };

            Schema.server(settings, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('fails when unknown properties exist', function (done) {

            var server = new Hapi.Server();
            server.settings.unknown = true;

            Schema.server(server.settings, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('succeeds with default settings returned from server', function (done) {

            var server = new Hapi.Server();

            Schema.server(server.settings, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('succeeds with only a couple of settings provided', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ cache: 'memory' });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('#route', function () {

        it('fails when unknown properties exist', function (done) {

            var settings = { method: 'GET', path: '/', handler: function() {}, unknown: true };

            Schema.route(settings, {}, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('fails when a required property is missing', function (done) {

            var settings = { method: 'GET' };

            Schema.route(settings, {}, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('fails when config payload has invalid value', function (done) {

            var settings = { method: 'GET', path: '/', handler: function () { } };
            var config = { payload: 'something' };

            Schema.route(settings, config, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('succeeds when required fields are present', function (done) {

            var settings = { method: 'GET', path: '/', handler: function() {} };

            Schema.route(settings, {}, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });
    });
});