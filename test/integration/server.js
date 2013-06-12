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

    it('calls start twice', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            server.start(function () {

                server.stop(function () {

                    done();
                });
            });
        });
    });

    it('won\'t stop until all connections are closed', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.connect(server.info.port, '127.0.0.1', function () {

                socket2.connect(server.info.port, '127.0.0.1', function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);

                        server.stop(function () {

                            server.listener.getConnections(function (err, count) {

                                expect(count).to.equal(0);
                                done();
                            });
                        });

                        socket1.end();
                        socket2.end();
                    });
                });
            });
        });
    });

    it('won\'t destroy connections until after the timeout', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket2.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket1.connect(server.info.port, server.settings.host, function () {

                socket2.connect(server.info.port, server.settings.host, function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);
                        var timer = new Hapi.utils.Timer();

                        server.stop({ timeout: 20 }, function () {

                            expect(timer.elapsed()).to.be.at.least(19);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('won\'t destroy connections if they close by themselves', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {

            var socket1 = new Net.Socket();
            var socket2 = new Net.Socket();

            socket1.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket2.once('error', function (err) {

                expect(err.errno).to.equal('ECONNRESET');
            });

            socket1.connect(server.info.port, server.settings.host, function () {

                socket2.connect(server.info.port, server.settings.host, function () {

                    server.listener.getConnections(function (err, count) {

                        expect(count).to.be.greaterThan(0);
                        var timer = new Hapi.utils.Timer();

                        server.stop(function () {

                            server.listener.getConnections(function (err, count) {

                                expect(count).to.equal(0);
                                expect(timer.elapsed()).to.be.at.least(10);
                                done();
                            });
                        });

                        setTimeout(function () {

                            socket1.end();
                            socket2.end();
                        }, 10);
                    });
                });
            });
        });
    });
    
    it('removes connection event listeners after it stops', function (done) {

        var server = Hapi.createServer(0);
        server.start(function () {
            
            server.stop(function () {
                
                server.start(function () {
                    
                    server.stop(function () {
                        
                        expect(server.listeners('connection').length).to.be.eql(0);
                        done();
                    });
                });
            });
        });
    });
});
