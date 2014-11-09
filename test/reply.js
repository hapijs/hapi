// Load modules

var Code = require('code');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Reply', function () {

    it('throws when reply called twice', function (done) {

        var server = new Hapi.Server({ debug: false });
        server.connection();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); reply('not ok'); } });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('proxies from handler', function (done) {

        var upstream = new Hapi.Server();
        upstream.connection();
        upstream.route({ method: 'GET', path: '/item', handler: function (request, reply) { return reply({ a: 1 }); } });
        upstream.start(function () {

            var server = new Hapi.Server();
            server.connection();
            server.route({ method: 'GET', path: '/handler', handler: function (request, reply) { return reply.proxy({ uri: 'http://localhost:' + upstream.info.port + '/item' }); } });

            server.inject('/handler', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('"a":1');
                done();
            });
        });
    });

    it('redirects from handler', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply.redirect('/elsewhere'); } });
        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('/elsewhere');
            done();
        });
    });

    describe('hold()', function () {

        it('undo scheduled next tick in reply interface', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var handler = function (request, reply) {

                return reply('123').hold().send();
            };

            server.route({ method: 'GET', path: '/domain', handler: handler });

            server.inject('/domain', function (res) {

                expect(res.result).to.equal('123');
                done();
            });
        });

        it('sends reply after timed handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var handler = function (request, reply) {

                var response = reply('123').hold();
                setTimeout(function () {
                    response.send();
                }, 10);
            };

            server.route({ method: 'GET', path: '/domain', handler: handler });

            server.inject('/domain', function (res) {

                expect(res.result).to.equal('123');
                done();
            });
        });
    });
});
