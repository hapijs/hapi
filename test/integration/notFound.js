// Load modules

var Lab = require('lab');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('NotFound', function () {

    describe('using default settings', function () {

        var server = new Hapi.Server(0);

        it('returns 404 when making a request to a route that doesn\'t exist', function (done) {

            server.inject({ method: 'GET', url: '/nope' }, function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });
    });

    describe('using notFound routes', function () {

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/exists/not', handler: 'notFound' });
        server.route({ method: 'GET', path: '/exists/{p*}', handler: function (request) { request.reply('OK'); } });

        it('returns 404 when making a request to a notFound route', function (done) {

            server.inject({ method: 'GET', url: '/exists/not' }, function (res) {

                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('returns 200 when making a request to an existing route', function (done) {

            server.inject({ method: 'GET', url: '/exists/ok' }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    describe('can override the server notFound route', function () {

        var server = new Hapi.Server(0);
        server.route({ method: 'GET', path: '/exists/{p*}', handler: function (request) { request.reply('OK'); } });
        server.route({ method: '*', path: '/{p*}', handler: function (request) {

            request.reply(Hapi.error.notFound('These these are not the pages you are looking for.'));
        }});

        it('returns custom response when requesting a route that doesn\'t exist', function (done) {

            server.inject({ method: 'GET', url: '/page' }, function (res) {

                expect(res.statusCode).to.equal(404);
                expect(res.result.message).to.equal('These these are not the pages you are looking for.');
                done();
            });
        });

        it('returns 200 when making a request to an existing route', function (done) {

            server.inject({ method: 'GET', url: '/exists/ok' }, function (res) {

                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });
});