// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Ext', function () {

    describe('onRequest', function (done) {

        it('replies with custom response', function (done) {

            var server = new Hapi.Server();
            server.ext('onRequest', function (request, next) {

                return next(Hapi.error.badRequest('boom'));
            });

            server.route({ method: 'GET', path: '/', handler: function () { this.reply('ok'); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result.message).to.equal('boom');
                done();
            });
        });
    });
});
