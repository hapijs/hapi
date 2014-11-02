// Load modules

var Net = require('net');
var Fs = require('fs');
var Http = require('http');
var Https = require('https');
var Stream = require('stream');
var Os = require('os');
var Path = require('path');
var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');
var Wreck = require('wreck');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Realm', function () {

    describe('configure()', function () {

        it('throws on invalid config', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ something: false });
            }).to.throw(/Invalid connection options/);
            done();
        });

        it('shallow clones app config', function (done) {

            var item = {};
            var server = new Hapi.Server();
            server.connection({ app: item });
            expect(server.connections[0].settings.app).to.equal(item);
            done();
        });

        it('shallow clones plugins config', function (done) {

            var item = {};
            var server = new Hapi.Server();
            server.connection({ plugins: item });
            expect(server.connections[0].settings.plugins).to.equal(item);
            done();
        });

        it('removes duplicate labels', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a', 'b', 'a', 'c', 'b'] });
            expect(server.connections[0].settings.labels).to.deep.equal(['a', 'b', 'c']);
            done();
        });

        it('validates server timeout is less then socket timeout', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ timeout: { server: 60000, socket: 120000 } });
            }).to.not.throw();
            done();
        });

        it('validates server timeout is less then socket timeout (node default)', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.connection({ timeout: { server: 60000, socket: false } });
            }).to.not.throw();
            done();
        });
    });
});
