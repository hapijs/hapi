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


describe('Protect', () => {

    it('does not handle errors when useDomains is false', (done) => {

        const server = new Hapi.Server({ useDomains: false, debug: false });
        server.connection();

        const handler = function (request, reply) {

            process.nextTick(() => {

                throw new Error('no domain');
            });
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        const domain = Domain.createDomain();
        domain.once('error', (err) => {

            expect(err.message).to.equal('no domain');
            done();
        });

        domain.run(() => {

            server.inject('/', (res) => { });
        });
    });

    it('catches error when handler throws after reply() is called', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const handler = function (request, reply) {

            reply('ok');
            process.nextTick(() => {

                throw new Error('should not leave domain');
            });
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('catches error when handler throws twice after reply() is called', (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const handler = function (request, reply) {

            reply('ok');

            process.nextTick(() => {

                throw new Error('should not leave domain 1');
            });

            process.nextTick(() => {

                throw new Error('should not leave domain 2');
            });
        };

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('catches errors thrown during request handling in non-request domain', (done) => {

        const Client = function () {

            Events.EventEmitter.call(this);
        };

        Hoek.inherits(Client, Events.EventEmitter);

        const test = function (srv, options, next) {

            const preStart = function (plugin, afterNext) {

                const client = new Client();                      // Created in the global domain
                plugin.bind({ client: client });
                afterNext();
            };

            srv.ext('onPreStart', preStart);

            srv.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    this.client.on('event', request.domain.bind(() => {

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
        server.register(test, (err) => {

            expect(err).to.not.exist();

            server.initialize((err) => {

                expect(err).to.not.exist();
                server.inject('/', (res) => {

                    done();
                });
            });
        });
    });

    it('logs to console after request completed', (done) => {

        const handler = function (request, reply) {

            reply('ok');
            setTimeout(() => {

                throw new Error('After done');
            }, 10);
        };

        const server = new Hapi.Server({ debug: false });
        server.connection();

        server.on('log', (event, tags) => {

            expect(tags.implementation).to.exist();
            done();
        });

        server.route({ method: 'GET', path: '/', handler: handler });
        server.inject('/', (res) => {

            expect(res.statusCode).to.equal(200);
        });
    });
});
