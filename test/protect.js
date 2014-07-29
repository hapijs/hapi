// Load modules

var Events = require('events');
var Lab = require('lab');
var Hapi = require('..');
var Hoek = require('hoek');


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

                    var client = new Client();                      // Created in the global domain
                    plugin.bind({ client: client });
                    afterNext();
                });

                plugin.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        this.client.on('event', request.domain.bind(function () {

                            throw new Error('boom');                // Caught by the global domain by default, not request domain
                        }));

                        this.client.emit('event');
                    }
                });

                return next();
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

    it('logs to console after request completed', function (done) {

        var handler = function (request, reply) {

            reply('ok');
            setTimeout(function () {

                throw new Error('After done');
            }, 10);
        };

        var server = new Hapi.Server({ debug: false });

        server.on('log', function (event, tags) {

            expect(tags.implementation).to.exist;
            done();
        });

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
        });
    });
});
