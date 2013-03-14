// Load modules

var Lab = require('lab');
var Https = require('https');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Server', function () {

    it('throws an error constructed without new', function (done) {

        var fn = function () {

            Hapi.Server('0.0.0.0', 0, {});
        };
        expect(fn).throws(Error, 'Server must be instantiated using new');
        done();
    });

    it('defaults to port 80 when no port is provided', function (done) {

        var server = new Hapi.Server();
        expect(server.settings.port).to.be.equal(80);
        done();
    });

    it('defaults to port 80 when a null port is provided', function (done) {

        var server = new Hapi.Server('0.0.0.0', null);
        expect(server.settings.port).to.be.equal(80);
        done();
    });

    it('allows a ephemeral port to be set', function (done) {

        var server = new Hapi.Server('0.0.0.0', 0);
        expect(server.settings.port).to.be.equal(0);
        done();
    });

    it('defaults to 0.0.0.0 when no host is provided', function (done) {

        var server = new Hapi.Server(0);
        server.start(function () {

            expect(server.settings.host).to.be.equal('0.0.0.0');
            done();
        });
    });

    it('doesn\'t throw an error when host and port are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('0.0.0.0', 0);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error when double port config is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server(8080, 8084);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error when invalid config properties are provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server({ cache: 'memory', something: false });
        };

        expect(fn).throws(Error);
        done();
    });

    it('throws an error when double host config is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server('0.0.0.0', 'localhost');
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error when unknown arg type is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server(true);
        };
        expect(fn).throws(Error);
        done();
    });

    it('doesn\'t throw an error when disabling cache', function (done) {

        var fn = function () {

            var server = new Hapi.Server('0.0.0.0', 0, { cache: false });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('assigns this.views when config enables views', function (done) {

        var server = new Hapi.Server('0.0.0.0', 0, { views: { partials: { path: __dirname + '/templates' } } });
        expect(server.views).to.exist;
        done();
    });

    it('creates an https server when passed tls options', function (done) {

        var tls = {};

        var server = new Hapi.Server('0.0.0.0', 0, { tls: tls });
        expect(server.listener instanceof Https.Server).to.equal(true);
        done();
    });

    it('doesn\'t throw an error when enabling auth', function (done) {

        var fn = function () {

            var server = new Hapi.Server('0.0.0.0', 0, { auth: { scheme: 'basic', loadUserFunc: function () { } } });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error when router.routeDefaults.handler is provided', function (done) {

        var fn = function () {

            var server = new Hapi.Server({ router: { routeDefaults: { handler: function () { } } } });
        };
        expect(fn).to.throw(Error, 'Route defaults cannot include a handler');
        done();
    });

    describe('#start', function () {

        it('doesn\'t throw an error', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.start();
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('calls the callback when one is used', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0);
            server.start(function () {

                expect(server.settings.host).to.equal('0.0.0.0');
                expect(server.settings.port).to.not.equal(0);
                done();
            });
        });
    });

    describe('#stop', function () {

        it('doesn\'t throw an error when the server is started', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);

                server.start(function () {

                    server.stop();
                    done();
                });
            };
            expect(fn).to.not.throw(Error);
        });

        it('ignores repeated calls when the server isn\'t started', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.stop();
            };
            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('#route', function () {

        it('throws an error when a route is passed in that is missing a path', function (done) {

            var fn = function () {

                var route = {};
                var server = new Hapi.Server('0.0.0.0', 0);
                server.route(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when a route is passed in that is missing a method', function (done) {

            var fn = function () {

                var route = {
                    path: '/test'
                };
                var server = new Hapi.Server('0.0.0.0', 0);
                server.route(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when a route is passed in that is missing a handler', function (done) {

            var fn = function () {

                var route = {
                    path: '/test',
                    method: 'put'
                };
                var server = new Hapi.Server('0.0.0.0', 0);
                server.route(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('adds route to correct _router method property', function (done) {

            var route = {
                path: '/test',
                method: 'put',
                handler: function () { }
            };
            var server = new Hapi.Server('0.0.0.0', 0);
            server.route(route);

            expect(server._router.table.put[0].path).to.equal('/test');
            done();
        });

        it('throws an error when a new route conflicts with an existing route', function (done) {

            var fn = function () {

                var server = new Hapi.Server();
                server.route({ path: '/test/{p}/{p}/end', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p*2}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error when routes differ in case and case is sensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: true } });
                server.route({ path: '/test/{p}/End', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('throws an error when routes differ in case and case is insensitive', function (done) {

            var fn = function () {

                var server = new Hapi.Server({ router: { isCaseSensitive: false } });
                server.route({ path: '/test/{p}/End', method: 'put', handler: function () { } });
                server.route({ path: '/test/{p}/end', method: 'put', handler: function () { } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('adds to routes object with the passed in routes values', function (done) {

            var routes = [{
                path: '/test',
                method: 'put',
                handler: function () { }
            }, {
                path: '/test',
                method: 'post',
                handler: function () { }
            }];
            var server = new Hapi.Server('0.0.0.0', 0);
            server.route(routes);

            expect(server._router.table.put[0].path).to.equal('/test');
            done();
        });
    });

    describe('#helper', function () {

        it('throws an error when name is not a string', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.helper(0, function () { });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when method is not a function', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.helper('user', 'function');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options is not an object', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.helper('user', function () { }, 'options');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.generateKey is not a function', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.helper('user', function () { }, { generateKey: 'function' });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.cache is not valid', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0, { cache: 'redis' });
                server.helper('user', function () { }, { cache: { mode: 'none', expiresIn: 3000 } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.cache is not enabled but server cache is not', function (done) {

            var fn = function () {

                var server = new Hapi.Server('0.0.0.0', 0);
                server.helper('user', function () { }, { cache: { expiresIn: 3000 } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('returns a valid result when calling a helper without using the cache', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0);
            server.helper('user', function (id, next) { return next({ id: id }); });
            server.helpers.user(4, function (result) {

                expect(result.id).to.equal(4);
                done();
            });
        });

        it('returns a valid result when calling a helper when using the cache', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0, { cache: 'memory' });
            server.start(function () {

                server.helper('user', function (id, str, next) { return next({ id: id, str: str }); }, { cache: { expiresIn: 1000, mode: 'server' } });
                server.helpers.user(4, 'something', function (result) {

                    expect(result.id).to.equal(4);
                    expect(result.str).to.equal('something');
                    done();
                });
            });
        });

        it('returns an error result when calling a helper that returns an error', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0);
            server.helper('user', function (id, next) { return next(new Error()); });
            server.helpers.user(4, function (result) {

                expect(result instanceof Error).to.equal(true);
                done();
            });
        });

        it('returns a different result when calling a helper without using the cache', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0);
            var gen = 0;
            server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); });
            server.helpers.user(4, function (result1) {

                expect(result1.id).to.equal(4);
                expect(result1.gen).to.equal(1);
                server.helpers.user(4, function (result2) {

                    expect(result2.id).to.equal(4);
                    expect(result2.gen).to.equal(2);
                    done();
                });
            });
        });

        describe('with cache', function () {

            it('returns a valid result when calling a helper using the cache', function (done) {

                var server = new Hapi.Server('0.0.0.0', 0, { cache: 'memory' });
                server.start(function() {

                    var gen = 0;
                    server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
                    var id = Math.random();
                    server.helpers.user(id, function (result1) {

                        expect(result1.id).to.equal(id);
                        expect(result1.gen).to.equal(1);
                        server.helpers.user(id, function (result2) {

                            expect(result2.id).to.equal(id);
                            expect(result2.gen).to.equal(1);
                            done();
                        });
                    });
                });
            });

            it('returns valid results when calling a helper (with different keys) using the cache', function (done) {

                var server = new Hapi.Server('0.0.0.0', 0, { cache: 'memory' });
                var gen = 0;
                server.helper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
                var id1 = Math.random();
                server.helpers.user(id1, function (result1) {

                    expect(result1.id).to.equal(id1);
                    expect(result1.gen).to.equal(1);
                    var id2 = Math.random();
                    server.helpers.user(id2, function (result2) {

                        expect(result2.id).to.equal(id2);
                        expect(result2.gen).to.equal(2);
                        done();
                    });
                });
            });

            it('returns new object (not cached) when second key generation fails when using the cache', function (done) {

                var server = new Hapi.Server('0.0.0.0', 0, { cache: 'memory' });
                var id1 = Math.random();
                var gen = 0;
                var helper = function (id, next) {

                    if (typeof id === 'function') {
                        id = id1;
                    }

                    return next({ id: id, gen: ++gen });
                };

                server.helper('user', helper, { cache: { expiresIn: 2000 } });

                server.helpers.user(id1, function (result1) {

                    expect(result1.id).to.equal(id1);
                    expect(result1.gen).to.equal(1);

                    server.helpers.user(function () { }, function (result2) {

                        expect(result2.id).to.equal(id1);
                        expect(result2.gen).to.equal(2);
                        done();
                    });
                });
            });
        });
    });

    describe('#routingTable', function () {

        it('returns an array of the current routes', function (done) {

            var server = new Hapi.Server('0.0.0.0', 0);

            server.route({ path: '/test/', method: 'get', handler: function () { } });
            server.route({ path: '/test/{p}/end', method: 'get', handler: function () { } });

            var routes = server.routingTable();

            expect(routes.length).to.equal(2);
            expect(routes[0].path).to.equal('/test/');
            done();
        });
    });

    describe('#log', function () {

        it('emits a log event', function (done) {

            var server = new Hapi.Server();

            server.once('log', function (event) {

                expect(event.data).to.equal('log event 1');
            });
            server.log('1', 'log event 1', Date.now());

            server.once('log', function (event) {

                expect(event.data).to.equal('log event 2');
            });
            server.log(['2'], 'log event 2', new Date(Date.now()));

            done();
        });
    });
});



