// Load modules

var Lab = require('lab');
var Net = require('net');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Server', function () {

    it('won\'t stop until all connections are closed', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.connect(server.settings.port, server.settings.host, function () {

                socket2.connect(server.settings.port, server.settings.host, function () {

                    expect(server.listener.connections).to.be.greaterThan(0);

                    server.stop(function () {

                        expect(server.listener.connections).to.equal(0);
                        done();
                    });

                    socket1.end();
                    socket2.end();
                });
            });
        });
    });
});
