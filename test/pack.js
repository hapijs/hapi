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
            done();
        });
    });

    it('registers plugins with options', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true;
                next();
            },
            options: { something: true }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('registers plugin via server plugin interface', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true;
                next();
            },
            options: { something: true }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('returns plugin error', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                next(new Error('from plugin'));
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.exist;
            expect(err.message).to.equal('from plugin');
            done();
        });
    });

    it('throws when plugin missing register', function (done) {

        var plugin = {
            name: 'test'
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, { something: true }, function (err) { });
        }).to.throw('One of plugin or register required but cannot include both');
        done();
    });

    it('throws when pack server contains cache configuration', function (done) {

        expect(function () {

            var pack = new Hapi.Pack();
            pack.server({ cache: 'catbox-memory', labels: ['a', 'b', 'c'] });
        }).to.throw('Cannot configure server cache in a pack member');
        done();
    });

    it('throws when plugin contains non object plugin property', function (done) {

        var plugin = {
            name: 'test',
            plugin: 5
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('Plugin register must be a function or a required plugin module');
        done();
    });

    it('throws when plugin contains an object plugin property with invalid register', function (done) {

        var plugin = {
            name: 'test',
            plugin: {
                register: 5
            }
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('Plugin register must be a function or a required plugin module');
        done();
    });

    it('throws when plugin contains a pkg attribute without a name', function (done) {

        var plugin = {
            register: function () { }
        };

        plugin.register.attributes = {
            pkg: {

            }
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('Missing plugin name');
        done();
    });

    it('sets version to 0.0.0 if missing', function (done) {

        var plugin = {
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { reply(plugin.version); } });
                next();
            }
        };

        plugin.register.attributes = {
            pkg: {
                name: '--steve'
            }
        };

        var server = new Hapi.Server();

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(server.pack.list['--steve'].version).to.equal('0.0.0');
            server.inject('/', function (res) {

                expect(res.result).to.equal(Hapi.version);
                done();
            });
        });
    });

    it('throws when plugin sets undefined path', function (done) {

        var plugin = {
            name: '--steve',
            register: function (plugin, options, next) {

                plugin.path();
                next();
            }
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('path must be a non-empty string');
        done();
    });

    it('registers required plugin', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['s1', 'a', 'b'] });
        pack.server({ labels: ['s2', 'a', 'test'] });
        pack.server({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
        pack.server({ labels: ['s4', 'b', 'test', 'cache'] });

        pack.register(require('./pack/--test1'), function (err) {

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

    it('registers a plugin with options', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        pack.register({ plugin: require('./pack/--test1'), options: { something: true } }, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('requires plugin via server plugin interface', function (done) {

        var plugin = {
            name: 'test',
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

    it('registers multiple plugins', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        var log = null;
        server.pack.events.once('log', function (event, tags) {

            log = [event, tags];
        });

        server.pack.register([require('./pack/--test1'), require('./pack/--test2')], function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/test1', '/test2']);
            expect(log[1].test).to.equal(true);
            expect(log[0].data).to.equal('abc');
            done();
        });
    });

    it('registers multiple plugins (verbose)', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        var log = null;
        server.pack.events.once('log', function (event, tags) {

            log = [event, tags];
        });

        server.pack.register([{ plugin: require('./pack/--test1') }, { plugin: require('./pack/--test2') }], function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/test1', '/test2']);
            expect(log[1].test).to.equal(true);
            expect(log[0].data).to.equal('abc');
            done();
        });
    });

    it('requires plugin with views', function (done) {

        var server = new Hapi.Server();
        server.pack.register({ plugin: require('./pack/--views'), options: { message: 'viewing it' } }, function (err) {

            expect(err).to.not.exist;
            server.inject('/view', function (res) {

                expect(res.result).to.equal('<h1>viewing it</h1>');

                server.inject('/file', function (res) {

                    expect(res.result).to.equal('<h1>{{message}}</h1>');

                    server.inject('/ext', function (res) {

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
            register: function (plugin, options, next) {

                plugin.views({
                    engines: { 'html': require('handlebars') },
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
            server.inject('/view', function (res) {

                expect(res.result).to.equal('<h1>steve</h1>');
                done();
            });
        });
    });

    it('registers a child plugin', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--child'), function (err) {

            expect(err).to.not.exist;
            server.inject('/test1', function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a plugin with route path prefix', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--test1'), { route: { prefix: '/xyz' } }, function (err) {

            expect(err).to.not.exist;
            server.inject('/xyz/test1', function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a plugin with route vhost', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--test1'), { route: { vhost: 'example.com' } }, function (err) {

            expect(err).to.not.exist;
            server.inject('/test1', function (res) {

                expect(res.statusCode).to.equal(404);

                server.inject({ url: '/test1', headers: { host: 'example.com' } }, function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });
    });

    it('fails to require missing module', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        expect(function () {

            pack.register(require('./pack/none'), function (err) { });
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

            pack.register({ register: function (plugin, options, next) { next(); } }, function (err) { });
        }).to.throw('Missing plugin name');

        done();
    });

    it('extends onRequest point', function (done) {

        var plugin = {
            name: 'test',
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

            server.inject('/a', function (res) {

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

        pack.register([require('./pack/--deps1'), require('./pack/--deps2'), require('./pack/--deps3')], function (err) {

            expect(err).to.not.exist;

            pack.start(function (err) {

                expect(err).to.not.exist;
                expect(pack.plugins['--deps1'].breaking).to.equal('bad');

                pack._servers[0].inject('/', function (res) {

                    expect(res.result).to.equal('|2|1|')

                    pack._servers[1].inject('/', function (res) {

                        expect(res.result).to.equal('|3|1|')

                        pack._servers[2].inject('/', function (res) {

                            expect(res.result).to.equal('|3|2|')
                            done();
                        });
                    });
                });
            });
        });
    });

    it('fails to require single plugin with dependencies', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(require('./pack/--deps1'), function (err) { });
        }).to.throw('Plugin --deps1 missing dependencies: --deps2');
        done();
    });

    it('fails to register single plugin with dependencies', function (done) {

        var plugin = {
            name: 'test',
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

            server.pack.register([require('./pack/--deps1'), require('./pack/--deps3')], function (err) { });
        });
    });

    it('fails to start server when after method fails', function (done) {

        var server = new Hapi.Server();
        server.pack.register(require('./pack/--afterErr'), function (err) {

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

        server.pack.register(require('./pack/--auth'), function (err) {

            expect(err).to.not.exist;

            server.inject('/', function (res) {

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

        pack.register(require('./pack/--auth'), function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('sets plugin context', function (done) {

        var server = new Hapi.Server();
        server.pack.register(require('./pack/--context'), function (err) {

            expect(err).to.not.exist;
            server.inject('/', function (res) {

                expect(res.result).to.equal('in context throughout');
                done();
            });
        });
    });

    it('plugin event handlers receive more than 2 arguments when they exist', function (done) {

        var plugin = {
            name: 'test',
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

    it('sets directory route handler', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.pack.register(require('./pack/--handler'), function (err) {

            expect(err).to.not.exist;
            server.inject('/handler/package.json', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(JSON.parse(res.result).name).to.equal('--handler');
                done();
            });
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
            register: function (plugin, options, next) {

                plugin.dependency(['b', 'c']);
                next();
            }
        };

        var b = {
            name: 'b',
            register: function (plugin, options, next) {

                next();
            }
        };

        var c = {
            name: 'c',
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
            register: function (plugin, options, next) {

                plugin.dependency('b');
                plugin.dependency('c');
                next();
            }
        };

        var b = {
            name: 'b',
            register: function (plugin, options, next) {

                next();
            }
        };

        var c = {
            name: 'c',
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

    it('starts a pack without callback', function (done) {

        var pack = new Hapi.Pack();
        pack.server(0);
        pack.register(require('./pack/--afterErr'), function (err) {

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

    describe('#compose', function () {

        it('composes pack', function (done) {

            var manifest = {
                pack: {
                    cache: {
                        engine: 'catbox-memory'
                    },
                    app: {
                        my: 'special-value'
                    }
                },
                servers: [
                    {
                        port: 0,
                        options: {
                            labels: ['api', 'nasty', 'test']
                        }
                    },
                    {
                        host: 'localhost',
                        port: 0,
                        options: {
                            labels: ['api', 'nice']
                        }
                    }
                ],
                plugins: {
                    '../test/pack/--test1': null
                }
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist;
                pack.start(function (err) {

                    expect(err).to.not.exist;
                    pack.stop(function () {

                        pack._servers[0].inject('/test1', function (res) {

                            expect(res.result).to.equal('testing123special-value');
                            done();
                        });
                    });
                });
            });
        });

        it('composes pack (env)', function (done) {

            var manifest = {
                pack: {
                    cache: {
                        engine: 'catbox-memory'
                    }
                },
                servers: [
                    {
                        port: '$env.hapi_port',
                        options: {
                            labels: ['api', 'nasty', 'test']
                        }
                    },
                    {
                        host: '$env.hapi_host',
                        port: 0,
                        options: {
                            labels: ['api', 'nice']
                        }
                    }
                ],
                plugins: {
                    '../test/pack/--test1': {}
                }
            };

            process.env.hapi_port = '0';
            process.env.hapi_host = 'localhost';

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist;
                pack.start(function (err) {

                    expect(err).to.not.exist;
                    pack.stop();

                    pack._servers[0].inject('/test1', function (res) {

                        expect(res.result).to.equal('testing123');
                        done();
                    });
                });
            });
        });

        it('composes pack (relative and absolute paths)', function (done) {

            var manifest = {
                pack: {
                    cache: {
                        engine: 'catbox-memory'
                    },
                    app: {
                        my: 'special-value'
                    }
                },
                servers: [
                    {
                        port: 0,
                        options: {
                            labels: ['api', 'nasty', 'test']
                        }
                    },
                    {
                        host: 'localhost',
                        port: 0,
                        options: {
                            labels: ['api', 'nice']
                        }
                    }
                ],
                plugins: {
                    './--test2': null
                }
            };

            manifest.plugins[__dirname + '/pack/--test1'] = null;

            Hapi.Pack.compose(manifest, { relativeTo: __dirname + '/pack' }, function (err, pack) {

                expect(err).to.not.exist;
                pack.start(function (err) {

                    expect(err).to.not.exist;
                    pack.stop(function () {

                        pack._servers[0].inject('/test1', function (res) {

                            expect(res.result).to.equal('testing123special-value');
                            done();
                        });
                    });
                });
            });
        });

        it('composes pack with ports', function (done) {

            var manifest = {
                servers: [
                    {
                        port: 8000
                    },
                    {
                        port: '8001',
                    }
                ],
                plugins: {}
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('throws when missing servers', function (done) {

            var manifest = {
                plugins: {}
            };

            expect(function () {

                Hapi.Pack.compose(manifest, function (err, pack) { });
            }).to.throw('Manifest missing servers definition');
            done();
        });
    });
});
