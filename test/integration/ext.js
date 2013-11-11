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

            server.route({ method: 'GET', path: '/', handler: function () { this.reply('ok'); } });

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

            server.ext('onRequest', function (request, next) {

                return next(request.generateView('test', { message: 'hola!' }));
            });

            server.route({ method: 'GET', path: '/', handler: function () { this.reply('ok'); } });

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

                return next(request.response().variety === 'text' ? Hapi.error.badRequest('boom') : null);
            });

            server.route({ method: 'GET', path: '/text', handler: function () { this.reply('ok'); } });
            server.route({ method: 'GET', path: '/obj', handler: function () { this.reply({ status: 'ok' }); } });

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

                return next(request.response().response.code);
            });

            server.inject({ method: 'GET', url: '/missing' }, function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal(404);
                done();
            });
        });
    });

    describe('#ext', function () {

        it('supports adding an array of ext methods', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreHandler', [
                function (request, next) {

                    request.x = '1';
                    next();
                },
                function (request, next) {

                    request.x += '2';
                    next();
                }
            ]);

            server.route({ method: 'GET', path: '/', handler: function () { this.reply(this.x); } });

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('12');
                done();
            });
        });
    });
});
