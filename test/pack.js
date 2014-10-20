// Load modules

var Domain = require('domain');
var Path = require('path');
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


describe('Pack', function () {

    var routesList = function (server) {

        var routes = server._router.routes.get;
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

                        return next(null, '123');
                    }, options: { cache: { expiresIn: 1000 } }
                });

                server2.methods.testMethod(function (err, result) {

                    expect(result).to.equal('123');

                    plugin.methods.testMethod(function (err, result) {

                        expect(result).to.equal('123');
                        return next();
                    });
                });
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist();

            expect(routesList(pack._servers[0])).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(pack._servers[1])).to.deep.equal(['/a', '/all', '/sodd']);
            expect(routesList(pack._servers[2])).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(pack._servers[3])).to.deep.equal(['/all', '/sodd', '/memoryx']);
            done();
        });
    });

    it('registers plugin with options', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true();
                return next();
            },
            options: { something: true }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('throws when register is missing a callback function', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                return next();
            },
            options: { something: true }
        };

        expect(function () {

            pack.register(plugin);
        }).to.throw('A callback function is required to register a plugin');
        done();
    });

    it('registers plugin via server pack interface', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true();
                return next();
            },
            options: { something: true }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('returns plugin error', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                return next(new Error('from plugin'));
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.exist();
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

            server.pack.register(plugin, function (err) { });
        }).to.throw('One of plugin or register required but cannot include both');
        done();
    });

    it('throws when register is not a function', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register({ register: 'x' }, function (err) { });
        }).to.throw('Plugin register must be a function or a required plugin module');
        done();
    });

    it('throws when pack server contains cache configuration', function (done) {

        expect(function () {

            var pack = new Hapi.Pack();
            pack.server({ cache: require('catbox-memory'), labels: ['a', 'b', 'c'] });
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
                return next();
            }
        };

        plugin.register.attributes = {
            pkg: {
                name: '--steve'
            }
        };

        var server = new Hapi.Server();

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            expect(server._registrations['--steve'].version).to.equal('0.0.0');
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
                return next();
            }
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('path must be a non-empty string');
        done();
    });

    it('registers plugin with exposed api', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['s1', 'a', 'b'] });
        pack.server({ labels: ['s2', 'a', 'test'] });
        pack.server({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
        pack.server({ labels: ['s4', 'b', 'test', 'cache'] });

        pack.register(require('./pack/--test1'), function (err) {

            expect(err).to.not.exist();

            expect(pack._servers[0]._router.routes.get).to.not.exist();
            expect(routesList(pack._servers[1])).to.deep.equal(['/test1']);
            expect(pack._servers[2]._router.routes.get).to.not.exist();
            expect(routesList(pack._servers[3])).to.deep.equal(['/test1']);

            expect(pack._servers[0].plugins['--test1'].add(1, 3)).to.equal(4);
            expect(pack._servers[0].plugins['--test1'].glue('1', '3')).to.equal('13');

            done();
        });
    });

    it('prevents plugin from multiple registrations', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/a', handler: function (request, reply) { reply('a'); } });
                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            expect(function () {

                server.pack.register(plugin, function (err) { });
            }).to.throw('Plugin test already registered in: ' + server.info.uri);

            done();
        });
    });

    it('allows plugin multiple registrations (attributes)', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.app.x = plugin.app.x ? plugin.app.x + 1 : 1;
                return next();
            }
        };

        plugin.register.attributes = { multiple: true };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist();
                expect(server.pack.app.x).to.equal(2);
                done();
            });
        });
    });

    it('allows plugin multiple registrations (property)', function (done) {

        var plugin = {
            name: 'test',
            multiple: true,
            register: function (plugin, options, next) {

                plugin.app.x = plugin.app.x ? plugin.app.x + 1 : 1;
                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist();
                expect(server.pack.app.x).to.equal(2);
                done();
            });
        });
    });

    it('registers multiple plugins', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        var log = null;
        server.pack.events.once('log', function (event, tags) {

            log = [event, tags];
        });

        server.pack.register([require('./pack/--test1'), require('./pack/--test2')], function (err) {

            expect(err).to.not.exist();
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

            expect(err).to.not.exist();
            expect(routesList(server)).to.deep.equal(['/test1', '/test2']);
            expect(log[1].test).to.equal(true);
            expect(log[0].data).to.equal('abc');
            done();
        });
    });

    it('requires plugin with views', function (done) {

        var server = new Hapi.Server();
        server.pack.register({ plugin: require('./pack/--views'), options: { message: 'viewing it' } }, function (err) {

            expect(err).to.not.exist();
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

            expect(err).to.not.exist();
            server.inject('/view', function (res) {

                expect(res.result).to.equal('<h1>steve</h1>');
                done();
            });
        });
    });

    it('registers a child plugin', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--child'), function (err) {

            expect(err).to.not.exist();
            server.inject('/test1', function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a plugin with route path prefix', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--test1'), { route: { prefix: '/xyz' } }, function (err) {

            expect(server.plugins['--test1'].prefix).to.equal('/xyz');
            expect(err).to.not.exist();
            server.inject('/xyz/test1', function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a plugin with route path prefix and plugin root route', function (done) {

        var a = {
            name: 'a',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
                return next();
            }
        };

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(a, { route: { prefix: '/xyz' } }, function (err) {

            expect(err).to.not.exist();
            server.inject('/xyz', function (res) {

                expect(res.result).to.equal('ok');
                done();
            });
        });
    });

    it('ignores the type of the plugin value', function (done) {

        var a = function () { };
        a.register = function (plugin, options, next) {

            plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
            return next();
        };

        a.register.attributes = { name: 'a' };

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register({ plugin: a }, { route: { prefix: '/xyz' } }, function (err) {

            expect(err).to.not.exist();
            server.inject('/xyz', function (res) {

                expect(res.result).to.equal('ok');
                done();
            });
        });
    });

    it('registers a child plugin with parent route path prefix', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--child'), { route: { prefix: '/xyz' } }, function (err) {

            expect(err).to.not.exist();
            server.inject('/xyz/test1', function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a child plugin with parent route vhost prefix', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--child'), { route: { vhost: 'example.com' } }, function (err) {

            expect(err).to.not.exist();
            server.inject({ url: '/test1', headers: { host: 'example.com' } }, function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a child plugin with parent route path prefix and inner register prefix', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register({ plugin: require('./pack/--child'), options: { route: { prefix: '/inner' } } }, { route: { prefix: '/xyz' } }, function (err) {

            expect(err).to.not.exist();
            server.inject('/xyz/inner/test1', function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a child plugin with parent route vhost prefix and inner register vhost', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register({ plugin: require('./pack/--child'), options: { route: { vhost: 'example.net' } } }, { route: { vhost: 'example.com' } }, function (err) {

            expect(err).to.not.exist();
            server.inject({ url: '/test1', headers: { host: 'example.com' } }, function (res) {

                expect(res.result).to.equal('testing123');
                done();
            });
        });
    });

    it('registers a plugin with route vhost', function (done) {

        var server = new Hapi.Server({ labels: 'test' });
        server.pack.register(require('./pack/--test1'), { route: { vhost: 'example.com' } }, function (err) {

            expect(err).to.not.exist();
            server.inject('/test1', function (res) {

                expect(res.statusCode).to.equal(404);

                server.inject({ url: '/test1', headers: { host: 'example.com' } }, function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });
    });

    it('registers a plugin on selection inside a plugin', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a'] });
        pack.server({ labels: ['b'] });
        pack.server({ labels: ['c'] });

        var server1 = pack._servers[0];
        var server2 = pack._servers[1];
        var server3 = pack._servers[2];

        var child = {
            name: 'child',
            register: function (plugin, options, next) {

                plugin.expose('key2', 2);
                return next();
            }
        };

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.expose('key1', 1);
                plugin.select('a').register(child, next);
            }
        };

        pack.register(plugin, { select: ['a', 'b'] }, function (err) {

            expect(err).to.not.exist();
            expect(server1.plugins.test.key1).to.equal(1);
            expect(server1.plugins.child.key2).to.equal(2);
            expect(server2.plugins.test.key1).to.equal(1);
            expect(server2.plugins.child).to.not.exist();
            expect(server3.plugins.test).to.not.exist();
            expect(server3.plugins.child).to.not.exist();
            done();
        });
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

            pack.register({ register: function (plugin, options, next) { return next(); } }, function (err) { });
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

                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
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

            expect(err).to.not.exist();

            pack.start(function (err) {

                expect(err).to.not.exist();
                expect(pack.plugins['--deps1'].breaking).to.equal('bad');

                pack._servers[0].inject('/', function (res) {

                    expect(res.result).to.equal('|2|1|');

                    pack._servers[1].inject('/', function (res) {

                        expect(res.result).to.equal('|3|1|');

                        pack._servers[2].inject('/', function (res) {

                            expect(res.result).to.equal('|3|2|');
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
        }).to.throw('Plugin --deps1 missing dependency --deps2 in server: ' + server.info.uri);
        done();
    });

    it('fails to register single plugin with dependencies', function (done) {

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.dependency('none');
                return next();
            }
        };

        var server = new Hapi.Server();
        expect(function () {

            server.pack.register(plugin, function (err) { });
        }).to.throw('Plugin test missing dependency none in server: ' + server.info.uri);
        done();
    });

    it('fails to require multiple plugins with dependencies', function (done) {

        var server = new Hapi.Server();

        var domain = Domain.create();
        domain.on('error', function (err) {

            expect(err.message).to.equal('Plugin --deps1 missing dependency --deps2 in server: ' + server.info.uri);
            done();
        });

        domain.run(function () {

            server.pack.register([require('./pack/--deps1'), require('./pack/--deps3')], function (err) { });
        });
    });

    it('recognizes dependencies from peer plugins', function (done) {

        var a = {
            name: 'a',
            register: function (plugin, options, next) {

                plugin.register(b, next);
            }
        };

        var b = {
            name: 'b',
            register: function (plugin, options, next) {

                return next();
            }
        };

        var c = {
            name: 'c',
            register: function (plugin, options, next) {

                plugin.dependency('b');
                return next();
            }
        };

        var server = new Hapi.Server(0);
        server.pack.register([a, c], function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('errors when missing inner dependencies', function (done) {

        var a = {
            name: 'a',
            register: function (plugin, options, next) {

                plugin.register(b, next);
            }
        };

        var b = {
            name: 'b',
            register: function (plugin, options, next) {

                plugin.dependency('c');
                return next();
            }
        };

        var domain = Domain.create();
        domain.on('error', function (err) {

            expect(err.message).to.equal('Plugin b missing dependency c in server: ' + server.info.uri);
            done();
        });

        var server = new Hapi.Server();

        domain.run(function () {

            server.pack.register(a, function (err) { });
        });
    });

    it('fails to start server when after method fails', function (done) {

        var server = new Hapi.Server();
        server.pack.register(require('./pack/--afterErr'), function (err) {

            expect(err).to.not.exist();
            server.start(function (err) {

                expect(err).to.exist();
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

                        cache.get(key, function (err, value, cached, report) {

                            callback(err, value);
                        });
                    },
                    set: function (key, value, callback) {

                        cache.set(key, value, 0, callback);
                    }
                });

                return next();
            }
        };

        var server = new Hapi.Server(0);
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.start(function () {

                server.plugins.test.set('a', '1', function (err) {

                    expect(err).to.not.exist();
                    server.plugins.test.get('a', function (err, value) {

                        expect(err).to.not.exist();
                        expect(value).to.equal('1');
                        setTimeout(function () {

                            server.plugins.test.get('a', function (err, value) {

                                expect(err).to.not.exist();
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
        server.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('authenticated!'); } });

        server.pack.register(require('./pack/--auth'), function (err) {

            expect(err).to.not.exist();

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

            expect(err).to.not.exist();
            done();
        });
    });

    it('sets plugin context', function (done) {

        var server = new Hapi.Server();
        server.pack.register(require('./pack/--context'), function (err) {

            expect(err).to.not.exist();
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

                    expect(tags).to.exist();
                    done();
                });

                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.inject({ url: '/' }, function () { });
        });
    });

    it('returns a reference to the new server when adding one to the pack', function (done) {

        var pack = new Hapi.Pack();
        var server = pack.server();

        expect(server).to.exist();
        server.inject({ url: '/' }, function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('sets directory route handler', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.pack.register(require('./pack/--handler'), function (err) {

            expect(err).to.not.exist();
            server.inject('/handler/package.json', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(JSON.parse(res.result).name).to.equal('--handler');
                done();
            });
        });
    });

    it('errors on bad cache start', function (done) {

        var cache = {
            engine: {
                start: function (callback) {

                    return callback(new Error('oops'));
                }
            }
        };

        var server = new Hapi.Server(0, { cache: cache });
        server.start(function (err) {

            expect(err.message).to.equal('oops');
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

        it('emits server log events once', function (done) {

            var pc = 0;

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.events.on('log', function (event, tags) {

                        ++pc;
                    });

                    next();
                }
            };

            var server = new Hapi.Server();

            var sc = 0;
            server.on('log', function (event, tags) {

                ++sc;
            });

            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.log('test');
                expect(sc).to.equal(1);
                expect(pc).to.equal(1);
                done();
            });
        });
    });

    it('adds server method using arguments', function (done) {

        var pack = new Hapi.Pack();
        pack.server();

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.method('log', function (methodNext) { return methodNext(null); });
                return next();
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });

    it('adds server method with plugin bind', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.bind({ x: 1 });
                plugin.method('log', function (methodNext) { return methodNext(null, this.x); });
                return next();
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.methods.log(function (err, result) {

                expect(result).to.equal(1);
                done();
            });
        });
    });

    it('adds server method with method bind', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.method('log', function (methodNext) { return methodNext(null, this.x); }, { bind: { x: 2 } });
                return next();
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.methods.log(function (err, result) {

                expect(result).to.equal(2);
                done();
            });
        });
    });

    it('adds server method with method and ext bind', function (done) {

        var server = new Hapi.Server();

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.bind({ x: 1 });
                plugin.method('log', function (methodNext) { return methodNext(null, this.x); }, { bind: { x: 2 } });
                return next();
            }
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server.methods.log(function (err, result) {

                expect(result).to.equal(2);
                done();
            });
        });
    });

    it('sets multiple dependencies in one statement', function (done) {

        var a = {
            name: 'a',
            register: function (plugin, options, next) {

                plugin.dependency(['b', 'c']);
                return next();
            }
        };

        var b = {
            name: 'b',
            register: function (plugin, options, next) {

                return next();
            }
        };

        var c = {
            name: 'c',
            register: function (plugin, options, next) {

                return next();
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
                return next();
            }
        };

        var b = {
            name: 'b',
            register: function (plugin, options, next) {

                return next();
            }
        };

        var c = {
            name: 'c',
            register: function (plugin, options, next) {

                return next();
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

    it('registers plugins with pre-selected label', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a'] });
        pack.server({ labels: ['b'] });

        var server1 = pack._servers[0];
        var server2 = pack._servers[1];

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
                return next();
            }
        };

        pack.register(plugin, { select: 'a' }, function (err) {

            expect(err).to.not.exist();
            server1.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                server2.inject('/', function (res) {

                    expect(res.statusCode).to.equal(404);
                    done();
                });
            });
        });
    });

    it('registers plugins with pre-selected labels', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a'] });
        pack.server({ labels: ['b'] });
        pack.server({ labels: ['c'] });

        var server1 = pack._servers[0];
        var server2 = pack._servers[1];
        var server3 = pack._servers[2];

        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { reply('ok'); } });
                plugin.expose('super', 'trooper');
                return next();
            }
        };

        pack.register(plugin, { select: ['a', 'c'] }, function (err) {

            expect(err).to.not.exist();
            expect(pack.plugins.test).to.not.exist();
            expect(server1.plugins.test.super).to.equal('trooper');
            expect(server2.plugins.test).to.not.exist();
            expect(server3.plugins.test.super).to.equal('trooper');

            server1.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                server2.inject('/', function (res) {

                    expect(res.statusCode).to.equal(404);
                    server3.inject('/', function (res) {

                        expect(res.statusCode).to.equal(200);
                        done();
                    });
                });
            });
        });
    });

    it('listens to events on selected servers', function (done) {

        var pack = new Hapi.Pack();
        pack.server(0, { labels: ['a'] });
        pack.server(0, { labels: ['b'] });
        pack.server(0, { labels: ['c'] });

        var server1 = pack._servers[0];
        var server2 = pack._servers[1];
        var server3 = pack._servers[2];

        var counter = 0;
        var plugin = {
            name: 'test',
            register: function (plugin, options, next) {

                plugin.select(['a', 'b']).events.on('test', function () {

                    ++counter;
                });

                plugin.select(['a']).events.on('start', function () {

                    ++counter;
                });

                return next();
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist();
            server1.emit('test');
            server2.emit('test');
            server3.emit('test');

            pack.start(function () {

                pack.stop(function () {

                    expect(counter).to.equal(3);
                    done();
                });
            });
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

                    return next();
                }
            };

            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist();
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
                    cache: '../node_modules/catbox-memory',
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

                expect(err).to.not.exist();
                pack.start(function (err) {

                    expect(err).to.not.exist();
                    pack.stop(function () {

                        pack._servers[0].inject('/test1', function (res) {

                            expect(res.result).to.equal('testing123special-value');
                            done();
                        });
                    });
                });
            });
        });

        it('composes pack (cache.engine)', function (done) {

            var manifest = {
                pack: {
                    cache: {
                        engine: '../node_modules/catbox-memory'
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

                expect(err).to.not.exist();
                pack.start(function (err) {

                    expect(err).to.not.exist();
                    pack.stop(function () {

                        pack._servers[0].inject('/test1', function (res) {

                            expect(res.result).to.equal('testing123special-value');
                            done();
                        });
                    });
                });
            });
        });

        it('composes pack (cache array)', function (done) {

            var manifest = {
                pack: {
                    cache: [{
                        engine: '../node_modules/catbox-memory'
                    }],
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

                expect(err).to.not.exist();
                pack.start(function (err) {

                    expect(err).to.not.exist();
                    pack.stop(function () {

                        pack._servers[0].inject('/test1', function (res) {

                            expect(res.result).to.equal('testing123special-value');
                            done();
                        });
                    });
                });
            });
        });

        it('composes pack (engine function)', function (done) {

            var manifest = {
                pack: {
                    cache: {
                        engine: require('catbox-memory')
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

                expect(err).to.not.exist();
                pack.start(function (err) {

                    expect(err).to.not.exist();
                    pack.stop(function () {

                        pack._servers[0].inject('/test1', function (res) {

                            expect(res.result).to.equal('testing123special-value');
                            done();
                        });
                    });
                });
            });
        });

        it('composes pack (string port)', function (done) {

            var manifest = {
                servers: [
                    {
                        port: '0',
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
                    '../test/pack/--test1': {}
                }
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist();
                pack.start(function (err) {

                    expect(err).to.not.exist();
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
                        engine: '../../node_modules/catbox-memory'
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

                expect(err).to.not.exist();
                pack.start(function (err) {

                    expect(err).to.not.exist();
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
                        port: '8001'
                    }
                ],
                plugins: {}
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist();
                done();
            });
        });

        it('validates server config after defaults applied', function (done) {

            var manifest = {
                servers: [
                    {
                        options: {
                            timeout: {

                            }
                        }
                    }
                ],
                plugins: {}
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist();
                done();
            });
        });

        it('composes pack with plugin registration options', function (done) {

            var manifest = {
                pack: {
                    app: {
                        my: 'special-value'
                    }
                },
                servers: [
                    {
                        port: 0,
                        options: {
                            labels: ['a', 'b']
                        }
                    },
                    {
                        port: 0,
                        options: {
                            labels: ['b', 'c']
                        }
                    }
                ],
                plugins: {
                    '../test/pack/--custom': [
                        {
                            options: {
                                path: '/'
                            }
                        },
                        {
                            select: 'a',
                            options: {
                                path: '/a'
                            }
                        },
                        {
                            select: 'b',
                            options: {
                                path: '/b'
                            }
                        },
                        {
                            route: {
                                prefix: '/steve'
                            },
                            options: {
                                path: '/a'
                            }
                        }
                    ]
                }
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist();

                var server1 = pack._servers[0];
                var server2 = pack._servers[1];

                server1.inject('/', function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('/');

                    server2.inject('/', function (res) {

                        expect(res.statusCode).to.equal(200);
                        expect(res.result).to.equal('/');

                        server1.inject('/a', function (res) {

                            expect(res.statusCode).to.equal(200);
                            expect(res.result).to.equal('/a');

                            server2.inject('/a', function (res) {

                                expect(res.statusCode).to.equal(404);

                                server1.inject('/b', function (res) {

                                    expect(res.statusCode).to.equal(200);
                                    expect(res.result).to.equal('/b');

                                    server2.inject('/b', function (res) {

                                        expect(res.statusCode).to.equal(200);
                                        expect(res.result).to.equal('/b');

                                        server1.inject('/steve/a', function (res) {

                                            expect(res.statusCode).to.equal(200);
                                            expect(res.result).to.equal('/a');

                                            server2.inject('/steve/a', function (res) {

                                                expect(res.statusCode).to.equal(200);
                                                expect(res.result).to.equal('/a');
                                                done();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        it('composes pack with inner deps', function (done) {

            var manifest = {
                servers: [{}],
                plugins: {
                    '../test/pack/--deps1': null,
                    '../test/pack/--deps2': null
                }
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.not.exist();
                done();
            });
        });

        it('errors on invalid plugin', function (done) {

            var manifest = {
                servers: [{}],
                plugins: {
                    '../test/pack/--fail': null
                }
            };

            Hapi.Pack.compose(manifest, function (err, pack) {

                expect(err).to.exist();
                done();
            });
        });

        it('throws on pack with missing inner deps', function (done) {

            var manifest = {
                servers: [{ host: 'localhost' }],
                plugins: {
                    '../test/pack/--deps1': null
                }
            };

            var domain = Domain.create();
            domain.on('error', function (err) {

                expect(err.message).to.equal('Plugin --deps1 missing dependency --deps2 in server: http://localhost:80');
                done();
            });

            domain.run(function () {

                Hapi.Pack.compose(manifest, function (err, pack) {});
            });
        });

        it('throws on invalid manifest options', function (done) {

            var manifest = {
                pack: {
                    app: {
                        my: 'special-value'
                    }
                },
                servers: [
                ],
                plugins: {
                    './--loaded': {}
                }
            };

            expect(function() {

                Hapi.Pack.compose(manifest, function () {});
            }).to.throw(/Invalid manifest options/);
            done();
        });
    });

    describe('#render', function () {

        it('renders view', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.views({
                        engines: { 'html': require('handlebars') },
                        basePath: __dirname + '/pack/--views',
                        path: './templates'
                    });

                    var view = plugin.render('test', { message: 'steve' }, function (err, rendered, config) {

                        plugin.route([
                            {
                                path: '/view', method: 'GET', handler: function (request, reply) {

                                    return reply(rendered);
                                }
                            }
                        ]);

                        return next();
                    });
                }
            };

            var server = new Hapi.Server();
            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/view', function (res) {

                    expect(res.result).to.equal('<h1>steve</h1>');
                    done();
                });
            });
        });

        it('renders view (with options)', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.views({
                        engines: { 'html': require('handlebars') }
                    });

                    var view = plugin.render('test', { message: 'steve' }, { basePath: __dirname + '/pack/--views', path: './templates' }, function (err, rendered, config) {

                        plugin.route([
                            {
                                path: '/view', method: 'GET', handler: function (request, reply) {

                                    return reply(rendered);
                                }
                            }
                        ]);

                        return next();
                    });
                }
            };

            var server = new Hapi.Server();
            server.pack.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/view', function (res) {

                    expect(res.result).to.equal('<h1>steve</h1>');
                    done();
                });
            });
        });
    });
});
