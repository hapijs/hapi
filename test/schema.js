// Load modules

var Lab = require('lab');
var Hapi = require('..');
var Schema = require('../lib/schema');
var Joi = require('joi');

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

            var settings = { unknown: true, something: {} };

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

                var server = new Hapi.Server({ cache: 'catbox-memory' });
            };

            expect(fn).to.not.throw(Error);
            done();
        });

        it('succeeds with extension cache', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ cache: { engine: {}, partition: 'gilden-yak' } });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('#routeOptions', function () {

        it('fails when unknown properties exist', function (done) {

            var options = { method: 'GET', path: '/', handler: function () { }, unknown: true };
            expect(Schema.routeOptions(options)).to.exist;
            done();
        });

        it('fails when a required property is missing', function (done) {

            var options = { method: 'GET' };
            expect(Schema.routeOptions(options)).to.exist;
            done();
        });

        it('succeeds when required fields are present', function (done) {

            var options = { method: 'GET', path: '/', handler: function () { } };
            expect(Schema.routeOptions(options)).to.not.exist;
            done();
        });

        it('succeeds when route config has a description', function (done) {

            var options = { method: 'GET', path: '/', handler: function () { }, config: { description: 'here is my description' } };

            expect(Schema.routeOptions(options)).to.not.exist;
            done();
        });
    });

    describe('#routeConfig', function () {

        it('fails when config payload has invalid value', function (done) {

            var config = { payload: 'something' };
            expect(Schema.routeConfig(config)).to.exist;
            done();
        });

        it('succeeds when route config has a description', function (done) {

            var config = { description: 'here is my description' };
            expect(Schema.routeConfig(config)).to.not.exist;
            done();
        });

        it('succeeds validating cache config', function (done) {
            
            var config = { handler: internals.item, cache: { expiresIn: 20000 } };
            expect(Schema.routeConfig(config)).to.not.exist;
            done();
        });

        it('errors when handler does not meet schema criteria', function(done) {

            var schema = { msg: Joi.string() };
            var theHandler = function (route, options) {

                return function(request, response) {

                    reply('successful reply: ' + options.msg);
                }
            };

            var server = new Hapi.Server();


            var fn = function () {

               server.handler('testhandler', theHandler, schema);
               server.route({
                   method: 'GET',
                   path: '/test',
                   handler: { testhandler: { msg: 1001 } }
               });
            };

            expect(fn).to.throw(Error);
            done();
        });
    });


    describe('#addHandlerSchema', function() {

        it('it successfully added a schema to handler schemas', function(done) {

            var schema = { test: Joi.string() };

            var fn = function () {

                var server = new Hapi.Server();
                server.handlerSchema('test', schema);
            }

            expect(fn).to.not.throw(Error);
            done();
        });

        it('rejects schema with non string name', function(done) {

            var schema = { test: Joi.string() };

            var fn = function () {

                var server = new Hapi.Server();
                server.handlerSchema(1001, schema);
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('rejects schema with non objecet schemas', function(done) {

            var schema = 1001;

            var fn = function() {

                var server = new Hapi.Server();
                server.handlerSchema('testschema', schema);
            };

            expect(fn).to.throw(Error);
            done();
        });
    });
<<<<<<< HEAD
});
=======

    describe('#view', function () {

        it('fails on invalid config', function (done) {

            var config = {};
            expect(Schema.view(config)).to.exist;
            done();
        });
    });
});
>>>>>>> upstream/master
