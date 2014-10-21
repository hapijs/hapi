// Load modules

var Events = require('events');
var Domain = require('domain');
var ChildProcess = require('child_process');
var Code = require('code');
var Ext = require('../lib/ext');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Ext', function () {

    it('skips when no exts added', function (done) {

        var ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse']);
        expect(ext._events.onRequest).to.equal(null);
        done();
    });

    describe('#onRequest', function (done) {

        it('replies with custom response', function (done) {

            var server = new Hapi.Server();
            server.ext('onRequest', function (request, next) {

                return next(Hapi.error.badRequest('boom'));
            });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

            server.inject('/', function (res) {

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

            server.inject('/', function (res) {

                expect(res.result.message).to.equal('boom');
                done();
            });
        });

        it('replies with a view', function (done) {

            var server = new Hapi.Server();
            server.views({
                engines: { 'html': require('handlebars') },
                path: __dirname + '/templates'
            });

            server.ext('onRequest', function (request, reply) {

                return reply.view('test', { message: 'hola!' });
            });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('<div>\n    <h1>hola!</h1>\n</div>\n');
                done();
            });
        });

        it('continues when result is null', function (done) {

            var server = new Hapi.Server();
            server.ext('onRequest', function (request, reply) {

                return reply(null).state('a', 'b');
            });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('ok');
                expect(res.headers['set-cookie']).to.deep.equal(['a=b']);
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

        it('intercepts 404 when using directory handler and file is missing', function (done) {

            var server = new Hapi.Server();

            server.ext('onPreResponse', function (request, next) {

                var response = request.response;
                return next({ isBoom: response.isBoom });
            });

            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './somewhere', listing: false, index: true } } });

            server.inject('/missing', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result.isBoom).to.equal(true);
                done();
            });
        });

        it('intercepts 404 when using file handler and file is missing', function (done) {

            var server = new Hapi.Server();

            server.ext('onPreResponse', function (request, next) {

                var response = request.response;
                return next({ isBoom: response.isBoom });
            });

            server.route({ method: 'GET', path: '/{path*}', handler: { file: './somewhere/something.txt' } });

            server.inject('/missing', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result.isBoom).to.equal(true);
                done();
            });
        });

        it('cleans unused file stream when response is overridden', { skip: process.platform === 'win32' }, function (done) {

            var server = new Hapi.Server();

            server.ext('onPreResponse', function (request, reply) {

                return reply({ something: 'else' });
            });

            server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './' } } });

            server.inject('/package.json', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.result.something).to.equal('else');

                var cmd = ChildProcess.spawn('lsof', ['-p', process.pid]);
                var lsof = '';
                cmd.stdout.on('data', function (buffer) {

                    lsof += buffer.toString();
                });

                cmd.stdout.on('end', function () {

                    var count = 0;
                    var lines = lsof.split('\n');
                    for (var i = 0, il = lines.length; i < il; ++i) {
                        count += !!lines[i].match(/package.json/);
                    }

                    expect(count).to.equal(0);
                    done();
                });

                cmd.stdin.end();
            });
        });
    });

    describe('#ext', function () {

        it('supports adding an array of ext methods', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreHandler', [
                function (request, next) {

                    request.app.x = '1';
                    return next();
                },
                function (request, next) {

                    request.app.x += '2';
                    return next();
                }
            ]);

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.app.x); } });

            server.inject('/', function (res) {

                expect(res.result).to.equal('12');
                done();
            });
        });

        it('sets bind via options', function (done) {

            var server = new Hapi.Server();
            server.ext('onPreHandler', function (request, next) {

                request.app.x = this.y;
                return next();
            }, { bind: { y: 42 } });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.app.x); } });

            server.inject('/', function (res) {

                expect(res.result).to.equal(42);
                done();
            });
        });

        it('uses server views for ext added via server', function (done) {

            var server = new Hapi.Server();

            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.ext('onPreHandler', function (request, reply) {

                reply.view('test');
            });

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.views({
                        engines: { html: require('handlebars') },
                        path: './no_such_directory_found'
                    });

                    plugin.route({ path: '/view', method: 'GET', handler: function (request, reply) { } });
                    return next();
                }
            };

            server.pack.register(plugin, function (err) {

                server.inject('/view', function (res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });
    });
});
