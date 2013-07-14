// Load modules

var Domain = require('domain');
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


describe('Pack', function () {

    var routesList = function (server) {

        var routes = server._router.table['get'];
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

                plugin.route({ method: 'GET', path: '/all', handler: function () { this.reply('all'); } });
                a.route({ method: 'GET', path: '/a', handler: function () { this.reply('a'); } });
                ab.route([{ method: 'GET', path: '/ab', handler: function () { this.reply('ab'); } }]);
                memoryx.route({ method: 'GET', path: '/memoryx', handler: function () { this.reply('memoryx'); } });
                sodd.route({ method: 'GET', path: '/sodd', handler: function () { this.reply('sodd'); } });

                memoryx.state('sid', { encoding: 'base64' });
                plugin.helper('test', function (next) {

                    next('123');
                });

                server2.helpers.test(function (result) {

                    expect(result).to.equal('123');
                    next();
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
        server.pack.allow({ route: true }).register(plugin, { something: true }, function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('registers plugin via server plugin interface (inline permission)', function (done) {

        var plugin = {
            name: 'test',
            version: '2.0.0',
            register: function (plugin, options, next) {

                expect(options.something).to.be.true;
                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, [{ route: true }, { something: true }], function (err) {

            expect(err).to.not.exist;
            done();
        });
    });

    it('throws when pack server contains cache configuration', function (done) {

        expect(function () {

            var pack = new Hapi.Pack();
            pack.server({ cache: 'memory', labels: ['a', 'b', 'c'] });
        }).to.throw('Cannot configure server cache in a pack member');
        done();
    });

    it('requires plugin', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['s1', 'a', 'b'] });
        pack.server({ labels: ['s2', 'a', 'test'] });
        pack.server({ labels: ['s3', 'a', 'b', 'd', 'cache'] });
        pack.server({ labels: ['s4', 'b', 'test', 'cache'] });

        pack.require('./pack/--test1', [{ route: true }, {}], function (err) {

            expect(err).to.not.exist;

            expect(pack._servers[0]._router.table['get']).to.not.exist;
            expect(routesList(pack._servers[1])).to.deep.equal(['/test1']);
            expect(pack._servers[2]._router.table['get']).to.not.exist;
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

                plugin.route({ method: 'GET', path: '/a', handler: function () { this.reply('a'); } });
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
        server.pack.require({ './pack/--test1': [{ route: true }, {}], './pack/--test2': {} }, function (err) {

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

                expect(res.result).to.equal(process.cwd() + '/test/integration/pack/--test2');
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
                    done();
                });
            });
        });
    });

    it('requires module', function (done) {

        var server = new Hapi.Server();
        server.pack.require('hapi-plugin-test', function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/hapi/plugin/test' }, function (res) {

                expect(res.result).to.equal('hapi-plugin-test');
                expect(server.plugins['hapi-plugin-test'].path).to.equal(process.cwd() + '/node_modules/hapi-plugin-test');
                done();
            });
        });
    });

    it('fails to require missing module', function (done) {

        var pack = new Hapi.Pack();
        pack.server({ labels: ['a', 'b'] });

        expect(function () {

            pack.allow({}).require('./pack/none', function (err) { });
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

        pack.start(function () {

            pack._servers.forEach(function (server) {

                expect(server._started).to.equal(true);
            });

            pack.stop(function () {

                pack._servers.forEach(function (server) {

                    expect(server._started).to.equal(false);
                });

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

                plugin.route({ method: 'GET', path: '/b', handler: function () { this.reply('b'); } });
                plugin.ext('onRequest', function (request, cont) {

                    request.setUrl('/b');
                    cont();
                });

                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.allow({ route: true }).register(plugin, [{ ext: true }], function (err) {

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
        pack.server({ labels: ['a', 'b'] });
        pack.server({ labels: ['a', 'c'] });
        pack.server({ labels: ['c', 'b'] });

        var handler = function () {

            return this.reply(this.app.deps);
        };

        pack._servers[0].route({ method: 'GET', path: '/', handler: handler });
        pack._servers[1].route({ method: 'GET', path: '/', handler: handler });
        pack._servers[2].route({ method: 'GET', path: '/', handler: handler });

        pack.allow({ ext: true }).require(['./pack/--deps1', './pack/--deps2', './pack/--deps3'], function (err) {

            expect(err).to.not.exist;

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

    it('automatically resolves the requirePath if specified (relative)', function (done) {

        var pack = new Hapi.Pack({ requirePath: './pack' });
        pack.server({ labels: 'c' });

        var handler = function () {

            return this.reply(this.app.deps);
        };

        pack._servers[0].route({ method: 'GET', path: '/', handler: handler });

        pack.allow({ ext: true }).require(['./pack/--deps3'], function (err) {

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
                expect(pack._servers[0].plugins['hapi-plugin-test'].path).to.equal(process.cwd() + '/node_modules/hapi-plugin-test');
                done();
            });
        });
    });

    it('resolves relative path', function (done) {

        var pack = new Hapi.Pack();
        pack.server();
        pack.require('../../node_modules/hapi-plugin-test', function (err) {

            expect(err).to.not.exist;
            pack._servers[0].inject({ method: 'GET', url: '/hapi/plugin/test' }, function (res) {

                expect(res.result).to.equal('hapi-plugin-test');
                expect(pack._servers[0].plugins['hapi-plugin-test'].path).to.equal(process.cwd() + '/node_modules/hapi-plugin-test');
                done();
            });
        });
    });

    it('fails to require single plugin with dependencies', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.pack.allow({ ext: true }).require('./pack/--deps1', [{ ext: true }], function (err) { });
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

            server.pack.allow({ ext: true }).register(plugin, function (err) { });
        }).to.throw('Plugin test missing dependencies: none');
        done();
    });

    it('fails to require multiple plugin with dependencies', function (done) {

        var server = new Hapi.Server();

        var domain = Domain.create();
        domain.on('error', function (err) {

            expect(err.message).to.equal('Plugin --deps1 missing dependencies: --deps2');
            done();
        });

        domain.run(function () {

            server.pack.allow({ ext: true }).require(['./pack/--deps1', './pack/--deps3'], function (err) { });
        });
    });

    it('uses plugin cache interface', function (done) {

        var plugin = {
            name: 'test',
            version: '1.0.0',
            register: function (plugin, options, next) {

                var cache = plugin.cache({ expiresIn: 10 });
                plugin.api({
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
        server.route({ method: 'GET', path: '/', handler: function () { this.reply('authenticated!') } });

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
});
