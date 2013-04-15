// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Schema = require('../../lib/schema');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;

var S = Hapi.types.String,
    N = Hapi.types.Number,
    O = Hapi.types.Object,
    B = Hapi.types.Boolean;


describe('Schema', function () {

    describe('#server', function () {

        it('fails when unknown properties exist', function (done) {

            var settings = { unknown: true, something: { } };

            expect(Schema.server(settings)).to.exist;
            done();
        });

        it('fails when unknown properties exist', function (done) {

            var server = new Hapi.Server();
            server.settings.unknown = true;

            expect(Schema.server(server.settings)).to.exist;
            done();
        });

        it('fails when unknown child properties exist', function (done) {

            var server = new Hapi.Server();
            server.settings.router = { unknown: true };

            expect(Schema.server(server.settings)).to.exist;
            done();
        });

        it('succeeds with default settings returned from server', function (done) {

            var server = new Hapi.Server();

            expect(Schema.server(server.settings)).to.not.exist;
            done();
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

            expect(Schema.route(settings, {})).to.exist;
            done();
        });

        it('fails when a required property is missing', function (done) {

            var settings = { method: 'GET' };

            expect(Schema.route(settings, null)).to.exist;
            done();
        });

        it('fails when config payload has invalid value', function (done) {

            var settings = { method: 'GET', path: '/', handler: function () { } };
            var config = { payload: 'something' };

            expect(Schema.route(settings, config)).to.exist;
            done();
        });

        it('succeeds when required fields are present', function (done) {

            var settings = { method: 'GET', path: '/', handler: function() {} };

            expect(Schema.route(settings, {})).to.not.exist;
            done();
        });

        it('succeeds when route config has a description', function (done) {

            var settings = { method: 'GET', path: '/', handler: function() {}, config: { description: 'here is my description' } };

            expect(Schema.route(settings, {})).to.not.exist;
            done();
        });

        it('succeeds when route config has tags', function (done) {

            var settings = { method: 'GET', path: '/', handler: function() {}, config: { tags: ['tag1', 'tag2'] } };

            expect(Schema.route(settings, {})).to.not.exist;
            done();
        });

        it('succeeds when route config has notes', function (done) {

            var settings = { method: 'GET', path: '/', handler: function() {}, config: { notes: 'here is a note' } };

            expect(Schema.route(settings, {})).to.not.exist;
            done();
        });
    });
});