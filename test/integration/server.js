// Load modules

var Chai = require('chai');
var Net = require('net');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Server', function () {

    var _server = new Hapi.Server(0);

    it('won\t stop until all connections are closed', function (done) {

        _server.start(function () {

            var socket = new Net.Socket();
            socket.connect(_server.settings.port, '127.0.0.1', function () {

                expect(_server.listener.connections).to.equal(1);

                _server.stop(function () {

                    expect(_server.listener.connections).to.equal(0);
                    done();
                });

                socket.end();
            });
        });
    });
});