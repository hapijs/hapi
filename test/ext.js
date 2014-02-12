// Load modules

var ChildProcess = require('child_process');
var Lab = require('lab');
var Hapi = require('..');
var Ext = require('../lib/ext');
var Handler = require('../lib/handler');


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

            var server = new Hapi.Server({
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates/valid'
                }
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
                expect(res.headers['set-cookie']).to.deep.equal(["a=b"]);
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

        it('cleans unused file stream when response is overridden', function (done) {

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
                    next();
                },
                function (request, next) {

                    request.app.x += '2';
                    next();
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
                next();
            }, { bind: { y: 42 } });

            server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(request.app.x); } });

            server.inject('/', function (res) {

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

    describe('#sort', function () {

        it('skips when no exts added', function (done) {

            var ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse'], Handler.invoke);
            ext.sort('onRequest');
            expect(ext._events.onRequest).to.equal(null);
            done();
        });

        var testDeps = function (scenario, callback) {

            var generateExt = function (value) {

                return function (request, next) {

                    request.x = request.x || '';
                    request.x += value;
                    next();
                };
            };

            var ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse'], Handler.invoke);
            scenario.forEach(function (record, i) {

                ext._add('onRequest', generateExt(record.id), { before: record.before, after: record.after }, { name: record.group });
            });

            var request = {
                _route: { env: {} },
                server: {},
                log: function () { }
            };

            ext.invoke(request, 'onRequest', function (err) {

                expect(err).to.not.exist;
                callback(request.x);
            });
        };

        it('sorts dependencies (1)', function (done) {

            var scenario = [
                { id: '0', before: 'a' },
                { id: '1', after: 'f', group: 'a' },
                { id: '2', before: 'a' },
                { id: '3', before: ['b', 'c'], group: 'a' },
                { id: '4', after: 'c', group: 'b' },
                { id: '5', group: 'c' },
                { id: '6', group: 'd' },
                { id: '7', group: 'e' },
                { id: '8', before: 'd' },
                { id: '9', after: 'c', group: 'a' }
            ];

            testDeps(scenario, function (result) {

                expect(result).to.equal('0213547869');
                done();
            });
        });

        it('sorts dependencies (explicit)', function (done) {

            var set = '0123456789abcdefghijklmnopqrstuvwxyz';
            var array = set.split('');

            var scenario = [];
            for (var i = 0, il = array.length; i < il; ++i) {
                var item = {
                    id: array[i],
                    group: array[i],
                    after: i ? array.slice(0, i) : [],
                    before: array.slice(i + 1)
                };
                scenario.push(item);
            }

            var fisherYates = function (array) {

                var i = array.length;
                while (--i) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var tempi = array[i];
                    var tempj = array[j];
                    array[i] = tempj;
                    array[j] = tempi;
                }
            };

            fisherYates(scenario);
            testDeps(scenario, function (result) {

                expect(result).to.equal(set);
                done();
            });
        });

        it('throws on circular dependency', function (done) {

            var scenario = [
                { id: '0', before: 'a', group: 'b' },
                { id: '1', before: 'c', group: 'a' },
                { id: '2', before: 'b', group: 'c' }
            ];

            expect(function () {

                testDeps(scenario, function (result) { });
            }).to.throw('onRequest extension added by c created a dependencies error');

            done();
        });
    });
});
