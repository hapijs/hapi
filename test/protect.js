'use strict';

// Load modules

const Events = require('events');
const Domain = require('domain');
const Code = require('code');
const Hapi = require('..');
const Hoek = require('hoek');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Protect', function () {

    it('does not handle errors when useDomains is false', function (done) {

        const server = new Hapi.Server({ useDomains: false, debug: false });
        server.connection();

        const handler = function (request, reply) {

            process.nextTick(function () {

                throw new Error('no domain');
            });
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        const domain = Domain.createDomain();
        domain.once('error', function (err) {

            expect(err.message).to.equal('no domain');
            done();
        });

        domain.run(function () {

            server.inject('/', function (res) { });
        });
    });

    it('catches error when handler throws after reply() is called', function (done) {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const handler = function (request, reply) {

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

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const handler = function (request, reply) {

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

        const Client = function () {

            Events.EventEmitter.call(this);
        };

        Hoek.inherits(Client, Events.EventEmitter);

        const test = function (srv, options, next) {

            srv.ext('onPreStart', function (plugin, afterNext) {

                const client = new Client();                      // Created in the global domain
                plugin.bind({ client: client });
                afterNext();
            });

            srv.route({
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
        };

        test.attributes = {
            name: 'test'
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();
        server.register(test, function (err) {

            expect(err).to.not.exist();

            server.initialize(function (err) {

                expect(err).to.not.exist();
                server.inject('/', function (res) {

                    done();
                });
            });
        });
    });

    it('logs to console after request completed', function (done) {

        const handler = function (request, reply) {

            reply('ok');
            setTimeout(function () {

                throw new Error('After done');
            }, 10);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();

        server.on('log', function (event, tags) {

            expect(tags.implementation).to.exist();
            done();
        });

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
        });
    });
});
