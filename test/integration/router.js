// Load modules

var Chai = require('chai');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Router', function () {

    var server = new Hapi.Server();
    server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function () { this.reply('special'); } });
    server.route({ method: 'GET', path: '/', handler: function () { this.reply('plain'); } });
    server.route({ method: 'GET', path: '/common', handler: function () { this.reply('common'); } });

    it('matches vhost route', function (done) {

        server.inject({ method: 'GET', url: '/', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.result).to.equal('special');
            done();
        });
    });

    it('matches default host route', function (done) {

        server.inject({ method: 'GET', url: '/', headers: { host: 'example.com' } }, function (res) {

            expect(res.result).to.equal('plain');
            done();
        });
    });

    it('matches vhost to common route', function (done) {

        server.inject({ method: 'GET', url: '/common', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.result).to.equal('common');
            done();
        });
    });
});
