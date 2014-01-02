// Load modules

var Lab = require('lab');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Ext', function () {

    describe('#onRequest', function (done) {

        it('replies with custom response', function (done) {

            var server = new Hapi.Server();
            server.ext('onRequest', function (request, next) {

                return next(Hapi.error.badRequest('boom'));
            });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result.message).to.equal('boom');
                done();
            });
        });

        it('replies with error using reply(null, result)', function (done) {

            var server = new Hapi.Server();
            server.ext('onRequest', function (request, next) {

                return next(null, Hapi.error.badRequest('boom'));
            });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result.message).to.equal('boom');
                done();
            });
        });

        it('replies with a view', function (done) {

            var server = new Hapi.Server({
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/../unit/templates/valid'
                }
            });

            server.ext('onRequest', function (request, reply) {

                return reply.view('test', { message: 'hola!' });
            });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('<div>\n    <h1>hola!</h1>\n</div>\n');
                done();
            });
        });
    });

    describe('#onPreResponse', function (done) {

        it('replies with custom response', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreResponse', function (request, next) {

                return next(typeof request.response.source === 'string' ? Hapi.error.badRequest('boom') : undefined);
            });

            server.route({ method: 'GET', path: '/text', handler: function (request, reply) { reply('ok'); } });
            server.route({ method: 'GET', path: '/obj', handler: function (request, reply) { reply({ status: 'ok' }); } });

            server.inject({ method: 'GET', url: '/text' }, function (res) {

                expect(res.result.message).to.equal('boom');
                server.inject({ method: 'GET', url: '/obj' }, function (res) {

                    expect(res.result.status).to.equal('ok');
                    done();
                });
            });
        });

        it('intercepts 404 responses', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreResponse', function (request, next) {

                return next(null, request.response.output.statusCode);
            });

            server.inject({ method: 'GET', url: '/missing' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(404);
                done();
            });
        });

        it('intercepts 404 when using directory and file missing', function (done) {

            var server = new Hapi.Server();

            server.ext('onPreResponse', function (request, next) {

                var response = request.response;
                return next({ isBoom: response.isBoom });
            });

            server.route({ method: 'GET', path: "/{path*}", handler: { directory: { path: './somewhere', listing: false, index: true } } });

            server.inject({ method: 'GET', url: '/missing' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result.isBoom).to.equal(true);
                done();
            });
        });
    });

    describe('#ext', function () {

        it('supports adding an array of ext methods', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreHandler', [
                function (request, next) {

                    request.app.x = '1';
                    next();
                },
                function (request, next) {

                    request.app.x += '2';
                    next();
                }
            ]);

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.app.x); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('12');
                done();
            });
        });

        it('sets bind via options', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreHandler', function (request, next) {

                request.app.x = this.y;
                next();
            }, { bind: { y: 42 } });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.app.x); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal(42);
                done();
            });
        });
    });

    describe('#runProtected', function () {

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
    });
});
