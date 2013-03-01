// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


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

        var server1 = new Hapi.Server();
        var server2 = new Hapi.Server({ tls: {} });
        var server3 = new Hapi.Server({ tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server({ cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.server('s1', server1, { labels: ['a', 'b'] });
        pack.server('s2', server2, { labels: ['a', 'c'] });
        pack.server('s3', server3, { labels: ['a', 'b', 'd'] });
        pack.server('s4', server4, { labels: ['b', 'x'] });

        var plugin = {
            name: 'test',
            version: '5.0.0',
            register: function (pack, options, next) {

                var a = pack.select({ label: 'a' });
                var ab = a.select({ label: 'b' });
                var memoryx = pack.select({ labels: ['x', 'cache'] });
                var sodd = pack.select({ names: ['s2', 's4'] });

                expect(pack.length).to.equal(4);
                expect(a.length).to.equal(3);
                expect(ab.length).to.equal(2);
                expect(memoryx.length).to.equal(1);
                expect(sodd.length).to.equal(2);

                pack.route({ method: 'GET', path: '/all', handler: function () { this.reply('all'); } });
                a.route({ method: 'GET', path: '/a', handler: function () { this.reply('a'); } });
                ab.route([{ method: 'GET', path: '/ab', handler: function () { this.reply('ab'); } }]);
                memoryx.route({ method: 'GET', path: '/memoryx', handler: function () { this.reply('memoryx'); } });
                sodd.route({ method: 'GET', path: '/sodd', handler: function () { this.reply('sodd'); } });

                memoryx.state('sid', { encoding: 'base64' });
                pack.helper('test', function (next) {

                    next('123');
                });

                server3.helpers.test(function (result) {

                    expect(result).to.equal('123');
                    next();
                });
            }
        };

        pack.register(plugin, function (err) {

            expect(err).to.not.exist;

            expect(routesList(server1)).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(server2)).to.deep.equal(['/a', '/all', '/sodd']);
            expect(routesList(server3)).to.deep.equal(['/a', '/ab', '/all']);
            expect(routesList(server4)).to.deep.equal(['/all', '/sodd', '/memoryx']);

            expect(server1.plugin.list.test.version).to.equal('5.0.0');

            done();
        });
    });

    it('requires plugin', function (done) {

        var server1 = new Hapi.Server();
        var server2 = new Hapi.Server({ tls: {} });
        var server3 = new Hapi.Server({ tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server({ cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.server('s1', server1, { labels: ['a', 'b'] });
        pack.server('s2', server2, { labels: ['a', 'test'] });
        pack.server('s3', server3, { labels: ['a', 'b', 'd'] });
        pack.server('s4', server4, { labels: ['b', 'test'] });

        pack.allow({ route: true }).require('./pack/--test1', {}, function (err) {

            expect(err).to.not.exist;

            expect(server1._router.table['get']).to.not.exist;
            expect(routesList(server2)).to.deep.equal(['/test1']);
            expect(server3._router.table['get']).to.not.exist;
            expect(routesList(server4)).to.deep.equal(['/test1']);

            expect(server1.plugins['--test1'].add(1, 3)).to.equal(4);
            expect(server1.plugins['--test1'].glue('1', '3')).to.equal('13');

            done();
        });
    });

    it('requires plugin via server plugin interface', function (done) {

        var plugin = {
            name: 'test',
            version: '2.0.0',
            register: function (pack, options, next) {

                pack.route({ method: 'GET', path: '/a', handler: function () { this.reply('a'); } });
                next();
            }
        };

        var server = new Hapi.Server();
        server.plugin().register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/a']);

            expect(function () {

                server.plugin().register(plugin, function (err) { });
            }).to.throw();

            done();
        });
    });

    it('requires multiple plugins using array', function (done) {

        var server = new Hapi.Server();
        server.plugin({ labels: 'test' }).require(['./pack/--test1', './pack/--test2'], function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/test1', '/test2']);
            done();
        });
    });

    it('requires multiple plugins using object', function (done) {

        var server = new Hapi.Server();
        server.plugin({ labels: 'test' }).require({ './pack/--test1': {}, './pack/--test2': {} }, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/test1', '/test2']);
            done();
        });
    });

    it('requires plugin with views', function (done) {

        var server = new Hapi.Server();
        server.plugin().require({ './pack/--views': { message: 'viewing it' } }, function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/view' }, function (res) {

                expect(res.result).to.equal('<h1>viewing it</h1>');

                server.inject({ method: 'GET', url: '/file' }, function (res) {

                    expect(res.readPayload()).to.equal('<h1>{{message}}</h1>');
                    done();
                });
            });
        });
    });

    it('fails to require missing module', function (done) {

        var server1 = new Hapi.Server();
        var pack = new Hapi.Pack({ a: 1 });
        pack.server('s1', server1, { labels: ['a', 'b'] });

        pack.allow({}).require('./pack/none', function (err) {

            expect(err).to.exist;
            expect(err.message).to.contain('Cannot find module');
            done();
        });
    });

    it('fails to require missing module in default route', function (done) {

        var server1 = new Hapi.Server();
        var pack = new Hapi.Pack({ a: 1 });
        pack.server('s1', server1, { labels: ['a', 'b'] });

        pack.require('none', function (err) {

            expect(err).to.exist;
            expect(err.message).to.contain('Cannot find module');
            done();
        });
    });

    it('starts and stops', function (done) {

        var server1 = new Hapi.Server(0);
        var server2 = new Hapi.Server(0, { tls: {} });
        var server3 = new Hapi.Server(0, { tls: {}, cache: 'memory' });
        var server4 = new Hapi.Server(0, { cache: 'memory' });

        var pack = new Hapi.Pack({ a: 1 });
        pack.server('s1', server1, { labels: ['a', 'b'] });
        pack.server('s2', server2, { labels: ['a', 'test'] });
        pack.server('s3', server3, { labels: ['a', 'b', 'd'] });
        pack.server('s4', server4, { labels: ['b', 'test'] });

        pack.start(function () {

            expect(server1._started).to.equal(true);
            expect(server2._started).to.equal(true);
            expect(server3._started).to.equal(true);
            expect(server4._started).to.equal(true);

            pack.stop(function () {

                expect(server1._started).to.equal(false);
                expect(server2._started).to.equal(false);
                expect(server3._started).to.equal(false);
                expect(server4._started).to.equal(false);

                done();
            });
        });
    });

    it('fails to register a bad plugin', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        pack.register({ version: '0.0.0', register: function (pack, options, next) { next(); } }, function (err) {

            expect(err).to.exist;
            expect(err.message).to.equal('Plugin missing name');
            done();
        });
    });

    it('invalidates missing name', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ version: '0.0.0', hapi: { plugin: '1.x.x' }, register: function (pack, options, next) { next(); } });

        expect(err).to.exist;
        expect(err.message).to.equal('Plugin missing name');
        done();
    });

    it('invalidates missing version', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ name: 'test', hapi: { plugin: '1.x.x' }, register: function (pack, options, next) { next(); } });

        expect(err).to.exist;
        expect(err.message).to.equal('Plugin missing version');
        done();
    });

    it('invalidates missing register method', function (done) {

        var pack = new Hapi.Pack({ a: 1 });
        var err = pack.validate({ name: 'test', version: '0.0.0', hapi: { plugin: '1.x.x' } });

        expect(err).to.exist;
        expect(err.message).to.equal('Plugin missing register() method');
        done();
    });

    it('extends onRequest point', function (done) {

        var plugin = {
            name: 'test',
            version: '3.0.0',
            hapi: {
                plugin: '1.x.x'
            },
            register: function (pack, options, next) {

                pack.route({ method: 'GET', path: '/b', handler: function () { this.reply('b'); } });
                pack.ext('onRequest', function (request, cont) {

                    request.setUrl('/b');
                    cont();
                });

                next();
            }
        };

        var server = new Hapi.Server();
        server.plugin().allow({ ext: true }).register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(routesList(server)).to.deep.equal(['/b']);

            server.inject({ method: 'GET', url: '/a' }, function (res) {

                expect(res.result).to.equal('b');
                done();
            });
        });
    });
});
