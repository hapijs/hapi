// Load modules

var Chai = require('chai');
var Net = require('net');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Server', function () {

    var _server = new Hapi.Server(0);

    it('won\t stop until all connections are closed', function (done) {

        _server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.connect(_server.settings.port, _server.settings.host, function () {
                socket2.connect(_server.settings.port, _server.settings.host, function () {

                    expect(_server.listener.connections).to.be.greaterThan(0);

                    _server.stop(function () {

                        expect(_server.listener.connections).to.equal(0);
                        done();
                    });

                    socket1.end();
                    socket2.end();
                });
            });
        });
    });
});