// Load modules

var Domain = require('domain');
var Path = require('path');
var Lab = require('lab');
var Hapi = require('..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Pack', function () {

    var routesList = function (server) {

        var routes = server._router.routes['get'];
        var list = [];
        for (var i = 0, il = routes.length; i < il; ++i) {
            var route = routes[i];
            list.push(route.path);
        }

        return list;
    };

    it('registers plugins', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['s1', 'a', 'b'] });
        pack.server({ labels: ['s2', 'a', 'c'] });
        pack.server({ labels: ['s3', 'a', 'b', 'd'] });
        pack.server({ labels: ['s4', 'b', 'x'] });

        var server2 = pack._servers[2];

        var plugin = {
            name: 'test',
            version: '5.0.0',
            register: function (plugin, options, next) {

                var a = plugin.select('a');
                var ab = a.select('b');
                var memoryx = plugin.select('x', 's4');
                var sodd = plugin.select(['s2', 's4']);

                expect(plugin.length).to.equal(4);
                expect(a.length).to.equal(3);
                expect(ab.length).to.equal(2);
                expect(memoryx.length).to.equal(1);
                expect(sodd.length).to.equal(2);

                plugin.route({ method: 'GET', path: '/all', handler: function (request, reply) { reply('all'); } });
                a.route({ method: 'GET', path: '/a', handler: function (request, reply) { reply('a'); } });
                ab.route([{ method: 'GET', path: '/ab', handler: function (request, reply) { reply('ab'); } }]);
                memoryx.route({ method: 'GET', path: '/memoryx', handler: function (request, reply) { reply('memoryx'); } });
                sodd.route({ method: 'GET', path: '/sodd', handler: function (request, reply) { reply('sodd'); } });

                memoryx.state('sid', { encoding: 'base64' });
                plugin.method({
                    name: 'testMethod', fn: function (next) {

                        next(null, '123');
                    }, options: { cache: { expiresIn: 1000 } }
                });

                server2.methods.testMethod(function (err, result) {

                    expect(result).to.equal('123');

                    plugin.methods.testMethod(function (err, result) {

                        expect(result).to.equal('123');
                        next();
                    });
                });
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist;

            expect(routesList(pack._servers[0])).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(pack._servers[1])).to.deep.equal(['/a', '/all', '/sodd']);
            expect(routesList(pack._servers[2])).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(pack._servers[3])).to.deep.equal(['/all', '/sodd', '/memoryx']);

            expect(pack._servers[0].pack.list.test.version).to.equal('5.0.0');

            done();
        });
    });

    it('registers plugins with options', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        var plugin = {
            name: 'test',
            version: '5.0.0',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true;
                next();
            }
        };

        pack.register(plugin, { something: true }, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('registers plugin via server plugin interface', function (done) {

        var plugin = {
            name: 'test',
            version: '2.0.0',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true;
                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, { something: true }, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('throws when plugin missing register', function (done) {

        var plugin = {
            name: 'test',
            version: '2.0.0'
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, { something: true }, function (err) { });
        }).to.throw('Plugin missing register() method');
        done();
    });

    it('throws when pack server contains cache configuration', function (done) {

        expect(function () {

            var pack = new Hapi.Pack();
            pack.server({ cache: 'catbox-memory', labels: ['a', 'b', 'c'] });
        }).to.throw('Cannot configure server cache in a pack member');
        done();
    });

    it('requires plugin', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['s1', 'a', 'b'] });
        pack.server({ labels: ['s2', 'a', 'test'] });
        pack.server({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
        pack.server({ labels: ['s4', 'b', 'test', 'cache'] });

        pack.require('./pack/--test1', {}, function (err) {

            expect(err).to.not.exist;

            expect(pack._servers[0]._router.routes['get']).to.not.exist;
            expect(routesList(pack._servers[1])).to.deep.equal(['/test1']);
            expect(pack._servers[2]._router.routes['get']).to.not.exist;
            expect(routesList(pack._servers[3])).to.deep.equal(['/test1']);

            expect(pack._servers[0].plugins['--test1'].add(1, 3)).to.equal(4);
            expect(pack._servers[0].plugins['--test1'].glue('1', '3')).to.equal('13');

            done();
        });
    });

    it('requires plugin with absolute path', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['s1', 'a', 'b'] });
        pack.server({ labels: ['s2', 'a', 'test'] });
        pack.server({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
        pack.server({ labels: ['s4', 'b', 'test', 'cache'] });

        pack.require(__dirname + '/pack/--test1', {}, function (err) {

            expect(err).to.not.exist;

            expect(pack._servers[0]._router.routes['get']).to.not.exist;
            expect(routesList(pack._servers[1])).to.deep.equal(['/test1']);
            expect(pack._servers[2]._router.routes['get']).to.not.exist;
            expect(routesList(pack._servers[3])).to.deep.equal(['/test1']);

            expect(pack._servers[0].plugins['--test1'].add(1, 3)).to.equal(4);
            expect(pack._servers[0].plugins['--test1'].glue('1', '3')).to.equal('13');

            done();
        });
    });

    it('requires a plugin with options', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        pack.require('./pack/--test1', { something: true }, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('requires plugin via server plugin interface', function (done) {

        var plugin = {
            name: 'test',
            version: '2.0.0',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/a', handler: function (request, reply) { reply('a'); } });
                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/a']);

            expect(function () {

                server.pack.register(plugin, function (err) { });
            }).to.throw();

            done();
        });
    });

    it('requires multiple plugins using array', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        var log = null;
        server.pack.events.once('log', function (event, tags) {

            log = [event, tags];
        });

        server.pack.require(['./pack/--test1', './pack/--test2'], function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/test1', '/test2', '/test2/path']);
            expect(log[1].test).to.equal(true);
            expect(log[0].data).to.equal('abc');
            done();
        });
    });

    it('requires multiple plugins using object', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.require({ './pack/--test1': {}, './pack/--test2': {} }, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/test1', '/test2', '/test2/path']);
            done();
        });
    });

    it('exposes the plugin path', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.require('./pack/--test2', function (err) {

            expect(err).to.not.exist;
            server.inject('/test2/path', function (res) {

                expect(res.result).to.equal(Path.join(process.cwd(), 'test', 'pack', '--test2'));
                done();
            });
        });
    });

    it('requires plugin with views', function (done) {

        var server = new Hapi.Server();
        server.pack.require({ './pack/--views': { message: 'viewing it' } }, function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/view' }, function (res) {

                expect(res.result).to.equal('<h1>viewing it</h1>');

                server.inject({ method: 'GET', url: '/file' }, function (res) {

                    expect(res.result).to.equal('<h1>{{message}}</h1>');

                    server.inject({ method: 'GET', url: '/ext' }, function (res) {

                        expect(res.result).to.equal('<h1>grabbed</h1>');
                        done();
                    });
                });
            });
        });
    });

    it('requires plugin with views with specific basePath', function (done) {

        var plugin = {
            name: 'test',
            version: '3.0.0',
            register: function (plugin, options, next) {

                plugin.views({
                    engines: { 'html': 'handlebars' },
                    basePath: __dirname + '/pack/--views',
                    path: './templates'
                });

                plugin.route([
                    {
                        path: '/view', method: 'GET', handler: function (request, reply) {

                            return reply.view('test', { message: 'steve' });
                        }
                    }
                ]);

                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/view' }, function (res) {

                expect(res.result).to.equal('<h1>steve</h1>');
                done();
            });
        });
    });

    it('requires plugin with views and loader', function (done) {

        var server = new Hapi.Server();
        server.pack.require({ './pack/--viewsLoader': { message: 'viewing it' } }, function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('<h1>{{message}}</h1>|{"message":"viewing it"}');
                done();
            });
        });
    });

    it('requires module', function (done) {

        var server = new Hapi.Server();
        server.pack.require('hapi-plugin-test', function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/hapi/plugin/test' }, function (res) {

                expect(res.result).to.equal('hapi-plugin-test');
                expect(server.plugins['hapi-plugin-test'].path).to.equal(Path.join(process.cwd(), 'node_modules', 'hapi-plugin-test'));
                done();
            });
        });
    });

    it('requires a child plugin', function (done) {

        var server = new Hapi.Server();
        server.pack.require('./pack/--child', function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/hapi/plugin/test' }, function (res) {

                expect(res.result).to.equal('hapi-plugin-test');
                expect(server.plugins['hapi-plugin-test'].path).to.equal(Path.join(process.cwd(), 'node_modules', 'hapi-plugin-test'));
                done();
            });
        });
    });

    it('fails to require missing module', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        expect(function () {

            pack.require('./pack/none', function (err) { });
        }).to.throw('Cannot find module');
        done();
    });

    it('fails to require missing module in default route', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        expect(function () {

            pack.require('none', function (err) { });
        }).to.throw('Cannot find module');
        done();
    });

    it('starts and stops', function (done) {

        var pack = new Hapi.Pack();
        pack.server(0, { labels: ['s1', 'a', 'b'] });
        pack.server(0, { labels: ['s2', 'a', 'test'] });
        pack.server(0, { labels: ['s3', 'a', 'b', 'd', 'cache'] });
        pack.server(0, { labels: ['s4', 'b', 'test', 'cache'] });

        var started = 0;
        var stopped = 0;

        pack.events.on('start', function () { ++started; });
        pack.events.on('stop', function () { ++stopped; });

        pack.start(function () {

            pack._servers.forEach(function (server) {

                expect(server._started).to.equal(true);
            });

            pack.stop(function () {

                pack._servers.forEach(function (server) {

                    expect(server._started).to.equal(false);
                });

                expect(started).to.equal(1);
                expect(stopped).to.equal(1);
                done();
            });
        });
    });

    it('fails to register a bad plugin', function (done) {

        var pack = new Hapi.Pack();
        expect(function () {

            pack.register({ version: '0.0.0', register: function (plugin, options, next) { next(); } }, function (err) { });
        }).to.throw('Plugin missing name');

        done();
    });

    it('extends onRequest point', function (done) {

        var plugin = {
            name: 'test',
            version: '3.0.0',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/b', handler: function (request, reply) { reply('b'); } });
                plugin.ext('onRequest', function (request, cont) {

                    request.setUrl('/b');
                    cont();
                });

                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/b']);

            server.inject({ method: 'GET', url: '/a' }, function (res) {

                expect(res.result).to.equal('b');
                done();
            });
        });
    });

    it('adds multiple ext functions with dependencies', function (done) {

        var pack = new Hapi.Pack();
        pack.server(0, { labels: ['a', 'b'] });
        pack.server(0, { labels: ['a', 'c'] });
        pack.server(0, { labels: ['c', 'b'] });

        var handler = function (request, reply) {

            return reply(request.app.deps);
        };

        pack._servers[0].route({ method: 'GET', path: '/', handler: handler });
        pack._servers[1].route({ method: 'GET', path: '/', handler: handler });
        pack._servers[2].route({ method: 'GET', path: '/', handler: handler });

        pack.require(['./pack/--deps1', './pack/--deps2', './pack/--deps3'], function (err) {

            expect(err).to.not.exist;

            pack.start(function (err) {

                expect(err).to.not.exist;
                expect(pack.plugins['--deps1'].breaking).to.equal('bad');

                pack._servers[0].inject({ method: 'GET', url: '/' }, function (res) {

                    expect(res.result).to.equal('|2|1|')

                    pack._servers[1].inject({ method: 'GET', url: '/' }, function (res) {

                        expect(res.result).to.equal('|3|1|')

                        pack._servers[2].inject({ method: 'GET', url: '/' }, function (res) {

                            expect(res.result).to.equal('|3|2|')
                            done();
                        });
                    });
                });
            });
        });
    });

    it('automatically resolves the requirePath if specified (relative)', function (done) {

        var pack = new Hapi.Pack({ requirePath: './pack' });
        pack.server({ labels: 'c' });

        var handler = function (request, reply) {

            return reply(request.app.deps);
        };

        pack._servers[0].route({ method: 'GET', path: '/', handler: handler });

        pack.require(['./pack/--deps3'], function (err) {

            expect(err).to.not.exist;
            pack._servers[0].inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('|3|');
                done();
            });
        });
    });

    it('automatically resolves the requirePath if specified (node_modules)', function (done) {

        var pack = new Hapi.Pack({ requirePath: process.cwd() + '/node_modules' });
        pack.server();
        pack.require('hapi-plugin-test', function (err) {

            expect(err).to.not.exist;
            pack._servers[0].inject({ method: 'GET', url: '/hapi/plugin/test' }, function (res) {

                expect(res.result).to.equal('hapi-plugin-test');
                expect(pack._servers[0].plugins['hapi-plugin-test'].path).to.equal(Path.join(process.cwd(), 'node_modules', 'hapi-plugin-test'));
                done();
            });
        });
    });

    it('resolves relative path', function (done) {

        var pack = new Hapi.Pack();
        pack.server();
        pack.require('../node_modules/hapi-plugin-test', function (err) {

            expect(err).to.not.exist;
            pack._servers[0].inject({ method: 'GET', url: '/hapi/plugin/test' }, function (res) {

                expect(res.result).to.equal('hapi-plugin-test');
                expect(pack._servers[0].plugins['hapi-plugin-test'].path).to.equal(Path.join(process.cwd(), 'node_modules', 'hapi-plugin-test'));
                done();
            });
        });
    });

    it('fails to require single plugin with dependencies', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.pack.require('./pack/--deps1', function (err) { });
        }).to.throw('Plugin --deps1 missing dependencies: --deps2');
        done();
    });

    it('fails to register single plugin with dependencies', function (done) {

        var plugin = {
            name: 'test',
            version: '3.0.0',
            register: function (plugin, options, next) {

                plugin.dependency('none');
                next();
            }
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('Plugin test missing dependencies: none');
        done();
    });

    it('fails to require multiple plugins with dependencies', function (done) {

        var server = new Hapi.Server();

        var domain = Domain.create();
        domain.on('error', function (err) {

            expect(err.message).to.equal('Plugin --deps1 missing dependencies: --deps2');
            done();
        });

        domain.run(function () {

            server.pack.require(['./pack/--deps1', './pack/--deps3'], function (err) { });
        });
    });

    it('fails to start server when after method fails', function (done) {

        var server = new Hapi.Server();
        server.pack.require('./pack/--afterErr', function (err) {

            expect(err).to.not.exist;
            server.start(function (err) {

                expect(err).to.exist;
                done();
            });
        });
    });

    it('uses plugin cache interface', function (done) {

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                var cache = plugin.cache({ expiresIn: 10 });
                plugin.expose({
                    get: function (key, callback) {
                        cache.get(key, function (err, value) {

                            callback(err, value && value.item);
                        });
                    },
                    set: function (key, value, callback) {
                        cache.set(key, value, 0, callback);
                    }
                });

                next();
            }
        };

        var server = new Hapi.Server(0);
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            server.start(function () {

                server.plugins.test.set('a', '1', function (err) {

                    expect(err).to.not.exist;
                    server.plugins.test.get('a', function (err, value) {

                        expect(err).to.not.exist;
                        expect(value).to.equal('1');
                        setTimeout(function () {

                            server.plugins.test.get('a', function (err, value) {

                                expect(err).to.not.exist;
                                expect(value).to.equal(null);
                                done();
                            });
                        }, 11);
                    });
                });
            });
        });
    });

    it('adds auth strategy via plugin', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('authenticated!') } });

        server.pack.require('./pack/--auth', function (err) {

            expect(err).to.not.exist;

            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.statusCode).to.equal(401);
                server.inject({ method: 'GET', url: '/', headers: { authorization: 'Basic ' + (new Buffer('john:12345', 'utf8')).toString('base64') } }, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('authenticated!');
                    done();
                });
            });
        });
    });

    it('adds auth strategy via plugin to multiple servers', function (done) {

        var pack = new Hapi.Pack();
        pack.server(0, { labels: 'a' });
        pack.server(0, { labels: 'b' });

        pack.require('./pack/--auth', function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('requires a plugin using loader', function (done) {

        var server = new Hapi.Server();
        server.pack.require('./pack/--loader', function (err) {

            expect(err).to.not.exist;
            expect(server.plugins['--inner']['way-down']).to.equal(42);
            done();
        });
    });

    it('sets plugin context', function (done) {

        var server = new Hapi.Server();
        server.pack.require('./pack/--context', function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/' }, function (res) {

                expect(res.result).to.equal('in context throughout');
                done();
            });
        });
    });

    it('plugin event handlers receive more than 2 arguments when they exist', function (done) {

        var plugin = {
            name: 'test',
            version: '2.0.0',
            register: function (plugin, options, next) {

                plugin.events.once('request', function (request, event, tags) {

                    expect(tags).to.exist;
                    done();
                });

                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            server.inject({ url: '/' }, function () { });
        });
    });

    it('returns a reference to the new server when adding one to the pack', function (done) {

        var pack = new Hapi.Pack();
        var server = pack.server();

        expect(server).to.exist;
        server.inject({ url: '/' }, function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('sets route handler', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.pack.require('./pack/--handler', function (err) {

            expect(err).to.not.exist;
            var table = server.table();
            table.filter(function (route) {
                if (route.path === '/handler/{file*}') {
                    expect(route.settings.handler).to.be.an('function');
                }
            });

            done();
        });
    });

    describe('#log', { parallel: false }, function () {

        it('outputs log data to debug console', function (done) {

            var server = new Hapi.Server();

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    {"data":1}');
                done();
            };

            server.pack.log(['implementation'], { data: 1 });
        });

        it('outputs log error data to debug console', function (done) {

            var server = new Hapi.Server();

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.contain('\n    Error: test\n    at');
                done();
            };

            server.pack.log(['implementation'], new Error('test'));
        });

        it('outputs log data to debug console without data', function (done) {

            var server = new Hapi.Server();

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('');
                done();
            };

            server.pack.log(['implementation']);
        });

        it('does not output events when debug disabled', function (done) {

            var server = new Hapi.Server({ debug: false });

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            server.pack.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('does not output events when debug.request disabled', function (done) {

            var server = new Hapi.Server({ debug: { request: false } });

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            server.pack.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('does not output non-implementation events by default', function (done) {

            var server = new Hapi.Server();

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            server.pack.log(['xyz']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });
    });

    it('adds server method using arguments', function (done) {

        var pack = new Hapi.Pack();
        pack.server();

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                plugin.method('log', function () { });
                next();
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('adds server method with plugin bind', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                plugin.bind({ x: 1 });
                plugin.method('log', function () { return this.x; });
                next();
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(server.methods.log()).to.equal(1);
            done();
        });
    });

    it('adds server method with method bind', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                plugin.method('log', function () { return this.x; }, { bind: { x: 2 } });
                next();
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(server.methods.log()).to.equal(2);
            done();
        });
    });

    it('adds server method with method and ext bind', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                plugin.bind({ x: 1 });
                plugin.method('log', function () { return this.x; }, { bind: { x: 2 } });
                next();
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(server.methods.log()).to.equal(2);
            done();
        });
    });

    it('sets multiple dependencies in one statement', function (done) {

        var a = {
            name: 'a',
            version: '2.0.0',
            register: function (plugin, options, next) {

                plugin.dependency(['b', 'c']);
                next();
            }
        };

        var b = {
            name: 'b',
            version: '2.0.0',
            register: function (plugin, options, next) {

                next();
            }
        };

        var c = {
            name: 'c',
            version: '2.0.0',
            register: function (plugin, options, next) {

                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(b, function (err) {

            server.pack.register(c, function (err) {

                server.pack.register(a, function (err) {

                    done();
                });
            });
        });
    });

    it('sets multiple dependencies in multiple statements', function (done) {

        var a = {
            name: 'a',
            version: '2.0.0',
            register: function (plugin, options, next) {

                plugin.dependency('b');
                plugin.dependency('c');
                next();
            }
        };

        var b = {
            name: 'b',
            version: '2.0.0',
            register: function (plugin, options, next) {

                next();
            }
        };

        var c = {
            name: 'c',
            version: '2.0.0',
            register: function (plugin, options, next) {

                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(b, function (err) {

            server.pack.register(c, function (err) {

                server.pack.register(a, function (err) {

                    done();
                });
            });
        });
    });

    it('sets a loader then undo it', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                plugin.loader(function () { throw new Error('bad'); });
                plugin.loader();
                plugin.require('./pack/--test2', next);
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            server.inject('/test2/path', function (res) {

                expect(res.result).to.equal(Path.join(process.cwd(), 'test', 'pack', '--test2'));
                done();
            });
        });
    });

    it('throws when name is missing', function (done) {

        var server = new Hapi.Server();

        expect(function () {

            server.pack.require(null, function (err) { });
        }).to.throw('Invalid plugin name(s) object: must be string, object, or array');
        done();
    });

    it('throws when name is invalid type', function (done) {

        var server = new Hapi.Server();

        expect(function () {

            server.pack.require(45, function (err) { });
        }).to.throw('Invalid plugin name(s) object: must be string, object, or array');
        done();
    });

    it('starts a pack without callback', function (done) {

        var pack = new Hapi.Pack();
        pack.server(0);
        pack.require('./pack/--afterErr', function (err) {

            pack.start();
            setTimeout(function () {

                pack.stop();
                done();
            }, 10);
        });
    });

    describe('#_provisionCache ', function () {

        it('throws when missing options', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache();
            }).to.throw('Invalid cache policy options');
            done();
        });

        it('throws when creating method cache with invalid segment', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache({ expiresIn: 1000 }, 'method', 'steve', 'bad');
            }).to.throw('Server method cache segment must start with \'##\'');
            done();
        });

        it('throws when creating plugin cache with invalid segment', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', 'bad');
            }).to.throw('Plugin cache segment must start with \'!!\'');
            done();
        });

        it('uses custom method cache segment', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache({ expiresIn: 1000 }, 'method', 'steve', '##method');
            }).to.not.throw();
            done();
        });

        it('uses custom plugin cache segment', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
            }).to.not.throw();
            done();
        });

        it('throws when creating the same cache twice', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
                server.pack._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
            }).to.throw('Cannot provision the same cache segment more than once');
            done();
        });

        it('allows creating the same cache twice via cache options', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.pack._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
                server.pack._provisionCache({ expiresIn: 1000, shared: true }, 'plugin', 'steve', '!!plugin');
            }).to.not.throw();
            done();
        });
    });

    describe('#handler', function () {

        it('add new handler', function (done) {

            var server = new Hapi.Server();
            var plugin = {
                name: 'foo',
                version: '0.0.1',
                register: function (plugin, options, next) {

                    plugin.handler('bar', function (route, options) {

                        return function (request, reply) {

                            reply('success');
                        };
                    });
                    next();
                }
            };

            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist;
                server.route({
                    method: 'GET',
                    path: '/',
                    handler: {
                        bar: {}
                    }
                });
                server.inject('/', function (res) {
                    expect(res.payload).to.equal('success');
                    done();
                });
            });
        });
    });
});
