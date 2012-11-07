// Load modules

var Https = require('https');
var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Server = require(libPath + 'server');

describe('Server', function () {

    it('throws an error constructed without new', function (done) {
        var fn = function () {
            Server('0.0.0.0', 8086, {});
        };
        expect(fn).throws(Error, 'Server must be instantiated using new');
        done();
    });

    it('defaults to port 80 when no port is provided', function (done) {
        var server = new Server();
        expect(server.settings.port).to.be.equal(80);
        done();
    });

    it('defaults to port 80 when a null port is provided', function (done) {
        var server = new Server('0.0.0.0', null);
        expect(server.settings.port).to.be.equal(80);
        done();
    });

    it('allows a ephemeral port to be set', function (done) {
        var server = new Server('0.0.0.0', 0);
        expect(server.settings.port).to.be.equal(0);
        done();
    });

    it('defaults to localhost when no host is provided', function (done) {
        var server = new Server();
        expect(server.settings.host).to.be.equal('localhost');
        done();
    });

    it('doesn\'t throw an error when host and port are provided', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 8083);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error when double port config is provided', function (done) {
        var fn = function () {
            var server = new Server(8080, 8084);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error when double host config is provided', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 'localhost');
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error when unknown arg type is provided', function (done) {
        var fn = function () {
            var server = new Server(true);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error when an incomplete authentication config is provided', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 8084, { authentication: {} });
        };
        expect(fn).throws(Error);
        done();
    });

    it('doesn\'t throw an error when disabling authentication', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 8085, { authentication: false });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('doesn\'t throw an error when enabling docs', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 8086, { docs: true });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('doesn\'t throw an error when enabling the debug console', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 8087, { debug: { websocketPort: 3002 } });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('doesn\'t throw an error when disabling cache', function (done) {
        var fn = function () {
            var server = new Server('0.0.0.0', 8088, { cache: false });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('assigns _monitor when config enables monitor', function (done) {
        var server = new Server('0.0.0.0', 8082, { monitor: true });
        expect(server._monitor).to.exist;
        done();
    });

    it('creates an https server when passed tls options', function (done) {
        var tls = {
        };

        var server = new Server('0.0.0.0', 8082, { tls: tls });
        expect(server.listener instanceof Https.Server).to.equal(true);
        done();
    });


    describe('#_match', function () {

        it('throws an error when the method parameter is null', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8092);
                server._match(null, '/test');
            };
            expect(fn).to.throw(Error, 'The method parameter must be provided');
            done();
        });

        it('throws an error when the path parameter is null', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8091);
                server._match('POST', null);
            };
            expect(fn).to.throw(Error, 'The path parameter must be provided');
            done();
        });

        it('returns null when no routes are added', function (done) {
            var server = new Server('0.0.0.0', 8092);
            var result = server._match('GET', '/test');

            expect(result).to.not.exist;
            done();
        });

        it('returns the route when there is a match', function (done) {
            var server = new Server('0.0.0.0', 8092);
            server.addRoute({
                method: 'GET',
                path: '/test',
                handler: function () { }
            });
            var result = server._match('GET', '/test');

            expect(result).exist;
            expect(result.path).to.equal('/test');
            done();
        });
    });


    describe('#start', function () {

        it('doesn\'t throw an error', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8088);
                server.start();
            };
            expect(fn).to.not.throw(Error);
            done();
        });

        it('calls the callback when one is used', function(done) {

            var server = new Server('0.0.0.0', 0);
            server.start(function() {

                expect(server.settings.host).to.equal('0.0.0.0');
                expect(server.settings.port).to.not.equal(0);
                done();
            });
        });

        it('calls the callback when not using ephemeral port', function(done) {

            var server = new Server('0.0.0.0', 8880);
            server.start(function(host, port) {

                expect(server.settings.host).to.equal('0.0.0.0');
                expect(server.settings.port).to.equal(8880);
                done();
            });
        });
    });


    describe('#stop', function () {

        it('doesn\'t throw an error when the server is started', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8089);

                server.start(function() {
                    server.stop();
                    done();
                });
            };
            expect(fn).to.not.throw(Error);
        });

        it('throws an error when the server isn\'t started', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8090);
                server.stop();
            };
            expect(fn).to.throw(Error);
            done();
        });
    });


    describe('#setRoutesDefaults', function () {

        it('throws an error when a default handler is provided', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8091);
                server.setRoutesDefaults({ handler: function () { } });
            };
            expect(fn).to.throw(Error, 'Defaults cannot include a handler');
            done();
        });

        it('changes the value of routeDefaults with the passed in object', function (done) {
            var server = new Server('0.0.0.0', 8092);
            server.setRoutesDefaults({ item: true });
            expect(server.routeDefaults.item).to.be.true;
            done();
        });
    });


    describe('#addRoute', function () {

        it('throws an error when a route is passed in that is missing a path', function (done) {
            var fn = function () {
                var route = {
                };
                var server = new Server('0.0.0.0', 8093);
                server.addRoute(route);
            };
            expect(fn).to.throw(Error, 'Route options missing path');
            done();
        });

        it('throws an error when a route is passed in that is missing a method', function (done) {
            var fn = function () {
                var route = {
                    path: '/test'
                };
                var server = new Server('0.0.0.0', 8094);
                server.addRoute(route);
            };
            expect(fn).to.throw(Error, 'Route options missing method');
            done();
        });

        it('throws an error when a route is passed in that is missing a handler', function (done) {
            var fn = function () {
                var route = {
                    path: '/test',
                    method: 'put'
                };
                var server = new Server('0.0.0.0', 8095);
                server.addRoute(route);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('adds route to correct _routes method property', function (done) {
            var route = {
                path: '/test',
                method: 'put',
                handler: function () { }
            };
            var server = new Server('0.0.0.0', 8096);
            server.addRoute(route);

            expect(server._routes.put[0]).to.exist;
            expect(server._routes.put[0].path).to.equal('/test');
            done();
        });
    });

    describe('#addRoutes', function () {

        it('throws an error when null routes are passed in', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097);
                server.addRoutes(null);
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
            var server = new Server('0.0.0.0', 8098);
            server.addRoutes(routes);

            expect(server._routes.put[0].path).to.equal('/test');
            done();
        });
    });

    describe('#addHelper', function () {

        it('throws an error when name is not a string', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097);
                server.addHelper(0, function () { });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when method is not a function', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097);
                server.addHelper('user', 'function');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options is not an object', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097);
                server.addHelper('user', function () { }, 'options');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.generateKey is not a function', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097);
                server.addHelper('user', function () { }, { generateKey: 'function' });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.cache is not valid', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097, { cache: 'redis' });
                server.addHelper('user', function () { }, { cache: { mode: 'none', expiresIn: 3000 } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when options.cache is not enabled but server cache is not', function (done) {
            var fn = function () {
                var server = new Server('0.0.0.0', 8097);
                server.addHelper('user', function () { }, { cache: { expiresIn: 3000 } });
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('returns a valid result when calling a helper without using the cache', function (done) {

            var server = new Server('0.0.0.0', 8097);
            server.addHelper('user', function (id, next) { return next({ id: id }); });
            server.helpers.user(4, function (result) {

                result.id.should.be.equal(4);
                done();
            });
        });

        it('returns a different result when calling a helper without using the cache', function (done) {

            var server = new Server('0.0.0.0', 8097);
            var gen = 0;
            server.addHelper('user', function (id, next) { return next({ id: id, gen: ++gen }); });
            server.helpers.user(4, function (result1) {

                result1.id.should.be.equal(4);
                result1.gen.should.be.equal(1);
                server.helpers.user(4, function (result2) {

                    result2.id.should.be.equal(4);
                    result2.gen.should.be.equal(2);
                    done();
                });
            });
        });

        describe('with cache', function () {

            it('returns a valid result when calling a helper using the cache', function (done) {

                var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
                var gen = 0;
                server.addHelper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
                var id = Math.random();
                server.helpers.user(id, function (result1) {

                    result1.id.should.be.equal(id);
                    result1.gen.should.be.equal(1);
                    server.helpers.user(id, function (result2) {

                        result2.id.should.be.equal(id);
                        result2.gen.should.be.equal(1);
                        done();
                    });
                });
            });

            it('returns valid results when calling a helper (with different keys) using the cache', function (done) {

                var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
                var gen = 0;
                server.addHelper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
                var id1 = Math.random();
                server.helpers.user(id1, function (result1) {

                    result1.id.should.be.equal(id1);
                    result1.gen.should.be.equal(1);
                    var id2 = Math.random();
                    server.helpers.user(id2, function (result2) {

                        result2.id.should.be.equal(id2);
                        result2.gen.should.be.equal(2);
                        done();
                    });
                });
            });

            it('returns new object (not cached) when second key generation fails when using the cache', function (done) {

                var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
                var id1 = Math.random();
                var gen = 0;
                var helper = function (id, next) {

                    if (typeof id === 'function') {
                        id = id1;
                    }

                    return next({ id: id, gen: ++gen });
                };

                server.addHelper('user', helper, { cache: { expiresIn: 2000 } });

                server.helpers.user(id1, function (result1) {

                    result1.id.should.be.equal(id1);
                    result1.gen.should.be.equal(1);

                    server.helpers.user(function () { }, function (result2) {

                        result2.id.should.be.equal(id1);
                        result2.gen.should.be.equal(2);
                        done();
                    });
                });
            });
        });
    });
});



