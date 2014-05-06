// Load modules

var Events = require('events');
var Lab = require('lab');
var Hapi = require('..');
var Hoek = require('hoek');
var Nipple = require('nipple');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Protect', function () {

    it('catches error when handler throws after reply() is called', function (done) {

        var server = new Hapi.Server({ debug: false });

        var handler = function (request, reply) {

            reply('ok');
            process.nextTick(function () {

                throw new Error('should not leave domain');
            });
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });


    it('does not propagate the domain outside of request lifetime', function (done) {

        // The server must be run without the test domain to demonstrate the issue.
        // In isolation this is unnecessary but multiple tests somehow leave the domain
        // state in a somehow broken state.
        while (process.domain) {
            process.domain.exit();
        }

        var server = new Hapi.Server(0);
        var executed = false;

        var handler = function (request, reply) {

            expect(process.domain).to.equal(request.domain);
            expect(request.raw.req.socket.domain).to.equal(null);

            if (!executed) {
                executed = true;
                Nipple.request('GET', 'http://localhost:' + server.info.port + '/', {}, function (err, res) {
                    expect(res.statusCode).to.equal(200);
                    reply('ok');
                });
            } else {
                reply('ok');
            }
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.start(function() {

            require('domain').log = true;
            Nipple.request('GET', 'http://localhost:' + server.info.port + '/', {}, function (err, res) {

                server.stop();
                expect(res.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('catches error when handler throws twice after reply() is called', function (done) {

        var server = new Hapi.Server({ debug: false });

        var handler = function (request, reply) {

            reply('ok');

            process.nextTick(function () {

                throw new Error('should not leave domain 1');
            });

            process.nextTick(function () {

                throw new Error('should not leave domain 2');
            });
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('catches errors thrown during request handling in non-request domain', function (done) {

        var Client = function () {

            Events.EventEmitter.call(this);
        };

        Hoek.inherits(Client, Events.EventEmitter);

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                plugin.after(function (plugin, afterNext) {

                    var client = new Client();                      // Created in the server domain
                    plugin.bind({ client: client });
                    afterNext();
                });

                plugin.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        this.client.on('event', request.domain.bind(function () {

                            throw new Error('boom');                // Caught by the server domain by default, not request domain
                        }));

                        this.client.emit('event');
                    }
                });

                next();
            }
        };

        var server = new Hapi.Server(0, { debug: false });
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;

            server.start(function () {

                server.inject('/', function (res) {

                    done();
                });
            });
        });
    });
});
