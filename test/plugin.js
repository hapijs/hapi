// Load modules

var Path = require('path');
var Boom = require('boom');
var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Plugin', function () {

    describe('select()', function () {

        it('creates a subset of connections for manipulation', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'c'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd'] });
            server.connection({ labels: ['s4', 'b', 'x'] });

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    var a = plugin.select('a');
                    var ab = a.select('b');
                    var memoryx = plugin.select('x', 's4');
                    var sodd = plugin.select(['s2', 's4']);

                    expect(plugin.connections.length).to.equal(4);
                    expect(a.connections.length).to.equal(3);
                    expect(ab.connections.length).to.equal(2);
                    expect(memoryx.connections.length).to.equal(1);
                    expect(sodd.connections.length).to.equal(2);

                    plugin.route({ method: 'GET', path: '/all', handler: function (request, reply) { return reply('all'); } });
                    a.route({ method: 'GET', path: '/a', handler: function (request, reply) { return reply('a'); } });
                    ab.route([{ method: 'GET', path: '/ab', handler: function (request, reply) { return reply('ab'); } }]);
                    memoryx.route({ method: 'GET', path: '/memoryx', handler: function (request, reply) { return reply('memoryx'); } });
                    sodd.route({ method: 'GET', path: '/sodd', handler: function (request, reply) { return reply('sodd'); } });

                    memoryx.state('sid', { encoding: 'base64' });
                    plugin.method({
                        name: 'testMethod', fn: function (next) {

                            return next(null, '123');
                        }, options: { cache: { expiresIn: 1000 } }
                    });

                    server.methods.testMethod(function (err, result) {

                        expect(result).to.equal('123');

                        plugin.methods.testMethod(function (err, result) {

                            expect(result).to.equal('123');
                            return next();
                        });
                    });
                }
            };

            server.register(plugin, function (err) {

                expect(err).to.not.exist();

                expect(internals.routesList(server, 's1')).to.deep.equal(['/a', '/ab', '/all']);
                expect(internals.routesList(server, 's2')).to.deep.equal(['/a', '/all', '/sodd']);
                expect(internals.routesList(server, 's3')).to.deep.equal(['/a', '/ab', '/all']);
                expect(internals.routesList(server, 's4')).to.deep.equal(['/all', '/sodd', '/memoryx']);
                done();
            });
        });

        it('registers a plugin on selection inside a plugin', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            var server1 = server.connections[0];
            var server2 = server.connections[1];
            var server3 = server.connections[2];

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

            server.register(plugin, { select: ['a', 'b'] }, function (err) {

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
    });

    describe('register()', function () {

        it('registers plugin with options', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a', 'b'] });

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    expect(options.something).to.be.true();
                    return next();
                }
            };

            server.register({ plugin: plugin, options: { something: true } }, function (err) {

                expect(err).to.not.exist();
                done();
            });
        });

        it('fails to register a bad plugin', function (done) {

            var server = new Hapi.Server();
            expect(function () {

                server.register({ register: function (plugin, options, next) { return next(); } }, function (err) { });
            }).to.throw('Missing plugin name');

            done();
        });

        it('throws when register is missing a callback function', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a', 'b'] });

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    return next();
                },
                options: { something: true }
            };

            expect(function () {

                server.register(plugin);
            }).to.throw('A callback function is required to register a plugin');
            done();
        });

        it('returns plugin error', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    return next(new Error('from plugin'));
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

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
            server.connection();
            expect(function () {

                server.register(plugin, function (err) { });
            }).to.throw('One of plugin or register required but cannot include both');
            done();
        });

        it('throws when register is not a function', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server.register({ register: 'x' }, function (err) { });
            }).to.throw('Plugin register must be a function');
            done();
        });

        it('throws when plugin contains non object plugin property', function (done) {

            var plugin = {
                name: 'test',
                plugin: 5
            };

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server.register(plugin, function (err) { });
            }).to.throw('Plugin register must be a function');
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
            server.connection();
            expect(function () {

                server.register(plugin, function (err) { });
            }).to.throw('Plugin register must be a function');
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
            server.connection();
            expect(function () {

                server.register(plugin, function (err) { });
            }).to.throw('Missing plugin name');
            done();
        });

        it('sets version to 0.0.0 if missing', function (done) {

            var plugin = {
                register: function (plugin, options, next) {

                    plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply(plugin.hapi.version); } });
                    return next();
                }
            };

            plugin.register.attributes = {
                pkg: {
                    name: 'steve'
                }
            };

            var server = new Hapi.Server();
            server.connection();

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                expect(server.connections[0]._registrations.steve.version).to.equal('0.0.0');
                server.inject('/', function (res) {

                    expect(res.result).to.equal(Hapi.version);
                    done();
                });
            });
        });

        it('prevents plugin from multiple registrations', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.route({ method: 'GET', path: '/a', handler: function (request, reply) { return reply('a'); } });
                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                expect(function () {

                    server.register(plugin, function (err) { });
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
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.register(plugin, function (err) {

                    expect(err).to.not.exist();
                    expect(server.app.x).to.equal(2);
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
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.register(plugin, function (err) {

                    expect(err).to.not.exist();
                    expect(server.app.x).to.equal(2);
                    done();
                });
            });
        });

        it('registers multiple plugins', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            var log = null;
            server.once('log', function (event, tags) {

                log = [event, tags];
            });

            server.register([internals.plugins.test1, internals.plugins.test2], function (err) {

                expect(err).to.not.exist();
                expect(internals.routesList(server)).to.deep.equal(['/test1', '/test2']);
                expect(log[1].test).to.equal(true);
                expect(log[0].data).to.equal('abc');
                done();
            });
        });

        it('registers multiple plugins (verbose)', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            var log = null;
            server.once('log', function (event, tags) {

                log = [event, tags];
            });

            server.register([{ plugin: internals.plugins.test1 }, { plugin: internals.plugins.test2 }], function (err) {

                expect(err).to.not.exist();
                expect(internals.routesList(server)).to.deep.equal(['/test1', '/test2']);
                expect(log[1].test).to.equal(true);
                expect(log[0].data).to.equal('abc');
                done();
            });
        });

        it('registers a child plugin', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.child, function (err) {

                expect(err).to.not.exist();
                server.inject('/test1', function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a plugin with route path prefix', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.test1, { route: { prefix: '/xyz' } }, function (err) {

                expect(server.plugins.test1.prefix).to.equal('/xyz');
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

                    plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('ok'); } });
                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(a, { route: { prefix: '/xyz' } }, function (err) {

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

                plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('ok'); } });
                return next();
            };

            a.register.attributes = { name: 'a' };

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ plugin: a }, { route: { prefix: '/xyz' } }, function (err) {

                expect(err).to.not.exist();
                server.inject('/xyz', function (res) {

                    expect(res.result).to.equal('ok');
                    done();
                });
            });
        });

        it('registers a child plugin with parent route path prefix', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.child, { route: { prefix: '/xyz' } }, function (err) {

                expect(err).to.not.exist();
                server.inject('/xyz/test1', function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a child plugin with parent route vhost prefix', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.child, { route: { vhost: 'example.com' } }, function (err) {

                expect(err).to.not.exist();
                server.inject({ url: '/test1', headers: { host: 'example.com' } }, function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a child plugin with parent route path prefix and inner register prefix', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ plugin: internals.plugins.child, options: { route: { prefix: '/inner' } } }, { route: { prefix: '/xyz' } }, function (err) {

                expect(err).to.not.exist();
                server.inject('/xyz/inner/test1', function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a child plugin with parent route vhost prefix and inner register vhost', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register({ plugin: internals.plugins.child, options: { route: { vhost: 'example.net' } } }, { route: { vhost: 'example.com' } }, function (err) {

                expect(err).to.not.exist();
                server.inject({ url: '/test1', headers: { host: 'example.com' } }, function (res) {

                    expect(res.result).to.equal('testing123');
                    done();
                });
            });
        });

        it('registers a plugin with route vhost', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'test' });
            server.register(internals.plugins.test1, { route: { vhost: 'example.com' } }, function (err) {

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

        it('registers plugins with pre-selected label', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });

            var server1 = server.connections[0];
            var server2 = server.connections[1];

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('ok'); } });
                    return next();
                }
            };

            server.register(plugin, { select: 'a' }, function (err) {

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

            var server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            var server1 = server.connections[0];
            var server2 = server.connections[1];
            var server3 = server.connections[2];

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('ok'); } });
                    plugin.expose('super', 'trooper');
                    return next();
                }
            };

            server.register(plugin, { select: ['a', 'c'] }, function (err) {

                expect(err).to.not.exist();
                expect(server.plugins.test).to.not.exist();
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
            server.connection();
            server.register(b, function (err) {

                server.register(c, function (err) {

                    server.register(a, function (err) {

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
            server.connection();
            server.register(b, function (err) {

                server.register(c, function (err) {

                    server.register(a, function (err) {

                        done();
                    });
                });
            });
        });
    });

    describe('after()', function () {

        it('fails to start server when after method fails', function (done) {

            var plugin = {
                name: 'plugin',
                register: function (plugin, options, next) {

                    plugin.after(function (plugin, finish) {

                        return finish();
                    });

                    plugin.after(function (plugin, finish) {

                        return finish(new Error('Not in the mood'));
                    });

                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.start(function (err) {

                    expect(err).to.exist();
                    done();
                });
            });
        });
    });

    describe('auth', function () {

        it('adds auth strategy via plugin', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: 'a' });
            server.connection({ labels: 'b' });
            server.route({ method: 'GET', path: '/', handler: function (request, reply) { return reply('authenticated!'); } });

            server.register(internals.plugins.auth, function (err) {

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
    });

    describe('bind()', function () {

        it('sets plugin context', function (done) {

            var plugin = {
                name: 'plugin',
                register: function (plugin, options, next) {

                    var bind = {
                        value: 'in context',
                        suffix: ' throughout'
                    };

                    plugin.route({
                        method: 'GET',
                        path: '/',
                        handler: function (request, reply) {

                            return reply(this.value);
                        }
                    });

                    plugin.ext('onPreResponse', function (request, reply) {

                        return reply(request.response.source + this.suffix);
                    });

                    plugin.bind(bind);        // Call last to test late binding

                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/', function (res) {

                    expect(res.result).to.equal('in context throughout');
                    done();
                });
            });
        });
    });

    describe('cache()', function () {

        it('provisions a server cache', function (done) {

            var server = new Hapi.Server();
            server.connection();
            var cache = server.cache('test', { expiresIn: 1000 });
            server.start(function () {

                cache.set('a', 'going in', 0, function (err) {

                    cache.get('a', function (err, value, cached, report) {

                        expect(value).to.equal('going in');

                        server.stop(function () {

                            done();
                        });
                    });
                });
            });
        });

        it('provisions a server cache with custom partition', function (done) {

            var server = new Hapi.Server({ cache: { engine: require('catbox-memory'), partition: 'hapi-test-other' } });
            server.connection();
            var cache = server.cache('test', { expiresIn: 1000 });
            server.start(function () {

                cache.set('a', 'going in', 0, function (err) {

                    cache.get('a', function (err, value, cached, report) {

                        expect(value).to.equal('going in');
                        expect(cache._cache.connection.settings.partition).to.equal('hapi-test-other');

                        server.stop(function () {

                            done();
                        });
                    });
                });
            });
        });

        it('throws when allocating an invalid cache segment', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server.cache('a', { expiresAt: '12:00', expiresIn: 1000 });
            }).throws();

            done();
        });

        it('allows allocating a cache segment with empty options', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server.cache('a', {});
            }).to.not.throw();

            done();
        });

        it('allows reusing the same cache segment', function (done) {

            var server = new Hapi.Server({ cache: { engine: require('catbox-memory'), shared: true } });
            server.connection();
            expect(function () {

                var a1 = server.cache('a', { expiresIn: 1000 });
                var a2 = server.cache('a', { expiresIn: 1000 });
            }).to.not.throw();
            done();
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

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

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
    });

    describe('_provisionCache()', function () {

        it('throws when missing options', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache();
            }).to.throw('Invalid cache policy options');
            done();
        });

        it('throws when creating method cache with invalid segment', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache({ expiresIn: 1000 }, 'method', 'steve', 'bad');
            }).to.throw('Server method cache segment must start with \'##\'');
            done();
        });

        it('throws when creating plugin cache with invalid segment', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', 'bad');
            }).to.throw('Plugin cache segment must start with \'!!\'');
            done();
        });

        it('uses custom method cache segment', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache({ expiresIn: 1000 }, 'method', 'steve', '##method');
            }).to.not.throw();
            done();
        });

        it('uses custom plugin cache segment', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
            }).to.not.throw();
            done();
        });

        it('throws when creating the same cache twice', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
                server._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
            }).to.throw('Cannot provision the same cache segment more than once');
            done();
        });

        it('allows creating the same cache twice via cache options', function (done) {

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server._provisionCache({ expiresIn: 1000 }, 'plugin', 'steve', '!!plugin');
                server._provisionCache({ expiresIn: 1000, shared: true }, 'plugin', 'steve', '!!plugin');
            }).to.not.throw();
            done();
        });
    });

    describe('dependency()', function () {

        it('fails to register single plugin with dependencies', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.dependency('none');
                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

                expect(function () {

                    server.start();
                }).to.throw('Plugin test missing dependency none in connection: ' + server.info.uri);
                done();
            });
        });

        it('fails to register multiple plugins with dependencies', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register([internals.plugins.deps1, internals.plugins.deps3], function (err) {

                expect(function () {

                    server.start();
                }).to.throw('Plugin deps1 missing dependency deps2 in connection: ' + server.info.uri);
                done();
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

            var server = new Hapi.Server();
            server.connection();
            server.register([a, c], function (err) {

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

            var server = new Hapi.Server();
            server.connection();
            server.register(a, function (err) {

                expect(function () {

                    server.start();
                }).to.throw('Plugin b missing dependency c in connection: ' + server.info.uri);
                done();
            });
        });
    });

    describe('events', function () {

        it('plugin event handlers receive more than 2 arguments when they exist', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.once('request', function () {

                        expect(arguments).to.have.length(3);
                        done();
                    });

                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject({ url: '/' }, function () { });
            });
        });

        it('listens to events on selected connections', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a'] });
            server.connection({ labels: ['b'] });
            server.connection({ labels: ['c'] });

            var server1 = server.connections[0];
            var server2 = server.connections[1];
            var server3 = server.connections[2];

            var counter = 0;
            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.select(['a', 'b']).on('test', function () {

                        ++counter;
                    });

                    plugin.select(['a']).on('start', function () {

                        ++counter;
                    });

                    return next();
                }
            };

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server1.emit('test');
                server2.emit('test');
                server3.emit('test');

                server.start(function () {

                    server.stop(function () {

                        expect(counter).to.equal(3);
                        done();
                    });
                });
            });
        });
    });

    describe('expose()', function () {

        it('exposes an api', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['s1', 'a', 'b'] });
            server.connection({ labels: ['s2', 'a', 'test'] });
            server.connection({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
            server.connection({ labels: ['s4', 'b', 'test', 'cache'] });

            server.register(internals.plugins.test1, function (err) {

                expect(err).to.not.exist();

                expect(server.connections[0]._router.routes.get).to.not.exist();
                expect(internals.routesList(server, 's2')).to.deep.equal(['/test1']);
                expect(server.connections[2]._router.routes.get).to.not.exist();
                expect(internals.routesList(server, 's4')).to.deep.equal(['/test1']);

                expect(server.connections[0].plugins.test1.add(1, 3)).to.equal(4);
                expect(server.connections[0].plugins.test1.glue('1', '3')).to.equal('13');

                done();
            });
        });
    });

    describe('ext()', function () {

        it('extends onRequest point', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.route({ method: 'GET', path: '/b', handler: function (request, reply) { return reply('b'); } });
                    plugin.ext('onRequest', function (request, reply) {

                        request.setUrl('/b');
                        return reply.continue();
                    });

                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                expect(internals.routesList(server)).to.deep.equal(['/b']);

                server.inject('/a', function (res) {

                    expect(res.result).to.equal('b');
                    done();
                });
            });
        });

        it('adds multiple ext functions with dependencies', function (done) {

            var server = new Hapi.Server();
            server.connection({ labels: ['a', 'b', '0'] });
            server.connection({ labels: ['a', 'c', '1'] });
            server.connection({ labels: ['c', 'b', '2'] });

            var handler = function (request, reply) {

                return reply(request.app.deps);
            };

            server.select('0').route({ method: 'GET', path: '/', handler: handler });
            server.select('1').route({ method: 'GET', path: '/', handler: handler });
            server.select('2').route({ method: 'GET', path: '/', handler: handler });

            server.register([internals.plugins.deps1, internals.plugins.deps2, internals.plugins.deps3], function (err) {

                expect(err).to.not.exist();

                server.start(function (err) {

                    expect(err).to.not.exist();
                    expect(server.plugins.deps1.breaking).to.equal('bad');

                    server.connections[0].inject('/', function (res) {

                        expect(res.result).to.equal('|2|1|');

                        server.connections[1].inject('/', function (res) {

                            expect(res.result).to.equal('|3|1|');

                            server.connections[2].inject('/', function (res) {

                                expect(res.result).to.equal('|3|2|');
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('handler()', function () {

        it('add new handler', function (done) {

            var server = new Hapi.Server();
            server.connection();
            var plugin = {
                name: 'foo',
                register: function (plugin, options, next) {

                    plugin.handler('bar', function (route, options) {

                        return function (request, reply) {

                            return reply('success');
                        };
                    });

                    return next();
                }
            };

            server.register(plugin, function (err) {

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

        it('errors on duplicate handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.handler('proxy', function () { });
            }).to.throw('Handler name already exists: proxy');
            done();
        });

        it('errors on unknown handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.route({ method: 'GET', path: '/', handler: { test: {} } });
            }).to.throw('Unknown handler: test');
            done();
        });

        it('errors on non-string name', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.handler();
            }).to.throw('Invalid handler name');
            done();
        });

        it('errors on non-function handler', function (done) {

            var server = new Hapi.Server();
            server.connection();

            expect(function () {

                server.handler('foo', 'bar');
            }).to.throw('Handler must be a function: foo');
            done();
        });
    });

    describe('log()', { parallel: false }, function () {

        it('emits a log event', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var count = 0;
            server.once('log', function (event) {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.once('log', function (event) {

                ++count;
                expect(event.data).to.equal('log event 1');
            });

            server.log('1', 'log event 1', Date.now());

            server.once('log', function (event) {

                ++count;
                expect(event.data).to.equal('log event 2');
            });

            server.log(['2'], 'log event 2', new Date(Date.now()));

            expect(count).to.equal(3);
            done();
        });

        it('emits a log event and print to console', { parallel: false }, function (done) {

            var server = new Hapi.Server();
            server.connection();

            server.once('log', function (event) {

                expect(event.data).to.equal('log event 1');
            });

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('hapi, internal, implementation, error');

                done();
            };

            server.log(['hapi', 'internal', 'implementation', 'error'], 'log event 1');
        });

        it('outputs log data to debug console', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('\n    {"data":1}');
                done();
            };

            server.log(['implementation'], { data: 1 });
        });

        it('outputs log error data to debug console', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.contain('\n    Error: test\n    at');
                done();
            };

            server.log(['implementation'], new Error('test'));
        });

        it('outputs log data to debug console without data', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var orig = console.error;
            console.error = function () {

                console.error = orig;
                expect(arguments[0]).to.equal('Debug:');
                expect(arguments[1]).to.equal('implementation');
                expect(arguments[2]).to.equal('');
                done();
            };

            server.log(['implementation']);
        });

        it('does not output events when debug disabled', function (done) {

            var server = new Hapi.Server({ debug: false });
            server.connection();

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('does not output events when debug.request disabled', function (done) {

            var server = new Hapi.Server({ debug: { request: false } });
            server.connection();

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['implementation']);
            console.error('nothing');
            expect(i).to.equal(1);
            console.error = orig;
            done();
        });

        it('does not output non-implementation events by default', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var i = 0;
            var orig = console.error;
            console.error = function () {

                ++i;
            };

            server.log(['xyz']);
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

                    plugin.on('log', function (event, tags) {

                        ++pc;
                    });

                    next();
                }
            };

            var server = new Hapi.Server();
            server.connection();

            var sc = 0;
            server.on('log', function (event, tags) {

                ++sc;
            });

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.log('test');
                expect(sc).to.equal(1);
                expect(pc).to.equal(1);
                done();
            });
        });
    });

    describe('method()', function () {

        it('adds server method using arguments', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.method('log', function (methodNext) { return methodNext(null); });
                    return next();
                }
            };

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                done();
            });
        });

        it('adds server method with plugin bind', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.bind({ x: 1 });
                    plugin.method('log', function (methodNext) { return methodNext(null, this.x); });
                    return next();
                }
            };

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.methods.log(function (err, result) {

                    expect(result).to.equal(1);
                    done();
                });
            });
        });

        it('adds server method with method bind', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.method('log', function (methodNext) { return methodNext(null, this.x); }, { bind: { x: 2 } });
                    return next();
                }
            };

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.methods.log(function (err, result) {

                    expect(result).to.equal(2);
                    done();
                });
            });
        });

        it('adds server method with method and ext bind', function (done) {

            var server = new Hapi.Server();
            server.connection();

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.bind({ x: 1 });
                    plugin.method('log', function (methodNext) { return methodNext(null, this.x); }, { bind: { x: 2 } });
                    return next();
                }
            };

            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.methods.log(function (err, result) {

                    expect(result).to.equal(2);
                    done();
                });
            });
        });
    });

    describe('path()', function () {

        it('sets local path for directory route handler', function (done) {

            var plugin = {
                name: 'plugin',
                register: function (plugin, options, next) {

                    plugin.path(Path.join(__dirname, '..'));

                    plugin.route({
                        method: 'GET',
                        path: '/handler/{file*}',
                        handler: {
                            directory: {
                                path: './'
                            }
                        }
                    });

                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection({ files: { relativeTo: __dirname } });
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/handler/package.json', function (res) {

                    expect(res.statusCode).to.equal(200);
                    done();
                });
            });
        });

        it('throws when plugin sets undefined path', function (done) {

            var plugin = {
                name: 'plugin',
                register: function (plugin, options, next) {

                    plugin.path();
                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            expect(function () {

                server.register(plugin, function (err) { });
            }).to.throw('path must be a non-empty string');
            done();
        });
    });

    describe('render()', function () {

        it('renders view (root)', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.render('test', { title: 'test', message: 'Hapi' }, function (err, rendered, config) {

                expect(rendered).to.exist();
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('renders view (root with options)', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.views({
                engines: { html: require('handlebars') }
            });

            server.render('test', { title: 'test', message: 'Hapi' }, { path: Path.join(__dirname, '/templates') }, function (err, rendered, config) {

                expect(rendered).to.exist();
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('renders view (plugin)', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.views({
                        engines: { 'html': require('handlebars') },
                        relativeTo: Path.join(__dirname, '/templates/plugin')
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
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/view', function (res) {

                    expect(res.result).to.equal('<h1>steve</h1>');
                    done();
                });
            });
        });

        it('renders view (plugin with options)', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.views({
                        engines: { 'html': require('handlebars') }
                    });

                    var view = plugin.render('test', { message: 'steve' }, { relativeTo: Path.join(__dirname, '/templates/plugin') }, function (err, rendered, config) {

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
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/view', function (res) {

                    expect(res.result).to.equal('<h1>steve</h1>');
                    done();
                });
            });
        });
    });

    describe('views()', function () {

        it('requires plugin with views', function (done) {

            var plugin = {
                name: 'plugin',
                register: function (plugin, options, next) {

                    plugin.path(__dirname);

                    var views = {
                        engines: { 'html': require('handlebars') },
                        path: './templates/plugin'
                    };

                    plugin.views(views);
                    if (Object.keys(views).length !== 2) {
                        return next(new Error('plugin.view() modified options'));
                    }

                    plugin.route([
                        {
                            path: '/view', method: 'GET', handler: function (request, reply) {

                                return reply.view('test', { message: options.message });
                            }
                        },
                        {
                            path: '/file', method: 'GET', handler: { file: './templates/plugin/test.html' }
                        }
                    ]);

                    plugin.ext('onRequest', function (request, reply) {

                        if (request.path === '/ext') {
                            return reply.view('test', { message: 'grabbed' });
                        }

                        return reply.continue();
                    });

                    return next();
                }
            };

            var server = new Hapi.Server();
            server.connection();
            server.register({ plugin: plugin, options: { message: 'viewing it' } }, function (err) {

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

        it('requires plugin with views with specific relativeTo', function (done) {

            var plugin = {
                name: 'test',
                register: function (plugin, options, next) {

                    plugin.views({
                        engines: { 'html': require('handlebars') },
                        relativeTo: Path.join(__dirname, '/templates/plugin')
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
            server.connection();
            server.register(plugin, function (err) {

                expect(err).to.not.exist();
                server.inject('/view', function (res) {

                    expect(res.result).to.equal('<h1>steve</h1>');
                    done();
                });
            });
        });
    });
});


internals.routesList = function (server, label) {

    var table = server.select(label || []).table();
    var connections = Object.keys(table);

    var list = [];
    for (var c = 0, cl = connections.length; c < cl; ++c) {
        var routes = table[connections[c]];
        for (var i = 0, il = routes.length; i < il; ++i) {
            var route = routes[i];
            if (route.method === 'get') {
                list.push(route.path);
            }
        }
    }

    return list;
};


internals.plugins = {
    auth: {
        name: 'plugin',
        register: function (plugin, options, next) {

            plugin.auth.scheme('basic', function (server, options) {

                var settings = Hoek.clone(options);

                var scheme = {
                    authenticate: function (request, reply) {

                        var req = request.raw.req;
                        var authorization = req.headers.authorization;
                        if (!authorization) {
                            return reply(Boom.unauthorized(null, 'Basic'));
                        }

                        var parts = authorization.split(/\s+/);

                        if (parts[0] &&
                            parts[0].toLowerCase() !== 'basic') {

                            return reply(Boom.unauthorized(null, 'Basic'));
                        }

                        if (parts.length !== 2) {
                            return reply(Boom.badRequest('Bad HTTP authentication header format', 'Basic'));
                        }

                        var credentialsParts = new Buffer(parts[1], 'base64').toString().split(':');
                        if (credentialsParts.length !== 2) {
                            return reply(Boom.badRequest('Bad header internal syntax', 'Basic'));
                        }

                        var username = credentialsParts[0];
                        var password = credentialsParts[1];

                        settings.validateFunc(username, password, function (err, isValid, credentials) {

                            if (!isValid) {
                                return reply(Boom.unauthorized('Bad username or password', 'Basic'), { credentials: credentials });
                            }

                            return reply(null, { credentials: credentials });
                        });
                    }
                };

                return scheme;
            });

            var loadUser = function (username, password, callback) {

                if (username === 'john') {
                    return callback(null, password === '12345', { user: 'john' });
                }

                return callback(null, false);
            };

            plugin.auth.strategy('basic', 'basic', 'required', { validateFunc: loadUser });

            plugin.auth.scheme('special', function () { return { authenticate: function () { } }; });
            plugin.auth.strategy('special', 'special', {});

            return next();
        }
    },
    child: {
        name: 'child',
        register: function (plugin, options, next) {

            if (options.route) {
                return plugin.register(internals.plugins.test1, options, next);
            }

            return plugin.register(internals.plugins.test1, next);
        }
    },
    deps1: {
        name: 'deps1',
        register: function (plugin, options, next) {

            plugin.dependency('deps2', function (plugin, next) {

                plugin.expose('breaking', plugin.plugins.deps2.breaking);
                return next();
            });

            plugin.select('a').ext('onRequest', function (request, reply) {

                request.app.deps = request.app.deps || '|';
                request.app.deps += '1|';
                return reply.continue();
            }, { after: 'deps3' });

            return next();
        }
    },
    deps2: {
        name: 'deps2',
        register: function (plugin, options, next) {

            plugin.select('b').ext('onRequest', function (request, reply) {

                request.app.deps = request.app.deps || '|';
                request.app.deps += '2|';
                return reply.continue();
            }, { after: 'deps3', before: 'deps1' });

            plugin.expose('breaking', 'bad');

            return next();
        }
    },
    deps3: {
        name: 'deps3',
        register: function (plugin, options, next) {

            plugin.select('c').ext('onRequest', function (request, reply) {

                request.app.deps = request.app.deps || '|';
                request.app.deps += '3|';
                return reply.continue();
            });

            return next();
        }
    },
    test1: {
        register: function (plugin, options, next) {

            var handler = function (request, reply) {

                return reply('testing123' + ((plugin.settings.app && plugin.settings.app.my) || ''));
            };

            plugin.select('test').route({ path: '/test1', method: 'GET', handler: handler });

            plugin.expose({
                add: function (a, b) {

                    return a + b;
                }
            });

            plugin.expose('glue', function (a, b) {

                return a + b;
            });

            plugin.expose('prefix', plugin.config.route.prefix);

            return next();
        }
    },
    test2: {
        register: function (plugin, options, next) {

            plugin.route({ path: '/test2', method: 'GET', handler: function (request, reply) { return reply('testing123'); } });
            plugin.log('test', 'abc');
            return next();
        }
    }
};


internals.plugins.test1.register.attributes = {
    name: 'test1',
    version: '1.0.0'
};


internals.plugins.test2.register.attributes = {
    pkg: {
        name: 'test2',
        version: '1.0.0'
    }
};
