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


describe('Router', function () {

    var server = new Hapi.Server();
    server.route({ method: 'GET', path: '/', vhost: 'special.example.com', handler: function () { this.reply('special'); } });
    server.route({ method: 'GET', path: '/', vhost: ['special1.example.com', 'special2.example.com', 'special3.example.com'], handler: function () { this.reply('special array'); } });
    server.route({ method: 'GET', path: '/', handler: function () { this.reply('plain'); } });
    server.route({ method: 'GET', path: '/common', handler: function () { this.reply('common'); } });

    it('matches vhost route', function (done) {

        server.inject({ method: 'GET', url: '/', headers: { host: 'special.example.com' } }, function (res) {

            expect(res.result).to.equal('special');
            done();
        });
    });

    it('matches vhost route for route with array of vhosts', function (done) {

        server.inject({ method: 'GET', url: '/', headers: { host: 'special2.example.com' } }, function (res) {

            expect(res.result).to.equal('special array');
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

    it('doesn\'t allow duplicate routes with the same vhost', function (done) {

        var fn = function () {

            server.route({ method: 'GET', path: '/', vhost: 'special1.example.com', handler: function () { this.reply('special'); } });
        };

        expect(fn).to.throw(Error);
        done();
    });

    it('does allow duplicate routes with a different vhost', function (done) {

        var fn = function () {

            server.route({ method: 'GET', path: '/', vhost: 'new.example.com', handler: function () { this.reply('special'); } });
        };

        expect(fn).to.not.throw(Error);
        done();
    });
});
