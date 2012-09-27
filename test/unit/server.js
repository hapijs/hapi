// Load modules

var expect = require('chai').expect;
var Server = process.env.TEST_COV ? require('../../lib-cov/server') : require('../../lib/server');


describe('Server', function() {

    it('throws an error constructed without new', function(done) {
        var fn = function() {
            Server('0.0.0.0', 8086, {});
        };
        expect(fn).throws(Error, 'Server must be instantiated using new');
        done();
    });

    it('throws an error when no host is provided', function(done) {
        var fn = function() {
            var server = new Server();
        };
        expect(fn).throws(Error, 'Host must be provided');
        done();
    });

    it('throws an error when no port is provided', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0');
        };
        expect(fn).throws(Error, 'Port must be provided');
        done();
    });

    it('doesn\'t throw an error when host and port are provided', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8083);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error when an incomplete authentication config is provided', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8084, { authentication: {}});
        };
        expect(fn).throws(Error);
        done();
    });

    it('doesn\'t throw an error when disabling authentication', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8085, { authentication: false });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('doesn\'t throw an error when enabling docs', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8086, { docs: true });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('doesn\'t throw an error when enabling the debug console', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8087, { debug: true });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('doesn\'t throw an error when disabling cache', function(done) {
        var fn = function() {
            var server = new Server('0.0.0.0', 8088, { cache: false });
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('assigns _monitor when config enables monitor', function(done) {
        var server = new Server('0.0.0.0', 8082, { monitor: true });
        expect(server._monitor).to.exist;
        done();
    });


    describe('#_match', function() {

        it('throws an error when the method parameter is null', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8092);
                server._match(null, '/test');
            };
            expect(fn).to.throw(Error, 'The method parameter must be provided');
            done();
        });

        it('throws an error when the path parameter is null', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8091);
                server._match('POST', null);
            };
            expect(fn).to.throw(Error, 'The path parameter must be provided');
            done();
        });

        it('returns null when no routes are added', function(done) {
            var server = new Server('0.0.0.0', 8092);
            var result = server._match('GET', '/test');

            expect(result).to.not.exist;
            done();
        });

        it('returns the route when there is a match', function(done) {
            var server = new Server('0.0.0.0', 8092);
            server.addRoute({
                method: 'GET',
                path: '/test',
                handler: function() { }
            });
            var result = server._match('GET', '/test');

            expect(result).exist;
            expect(result.path).to.equal('/test');
            done();
        });
    });


    describe('#start', function() {

        it('doesn\'t throw an error', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8088);
                server.start();
            };
            expect(fn).to.not.throw(Error);
            done();
        });
    });


    describe('#stop', function() {

        it('doesn\'t throw an error when the server is started', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8089);
                server.listener.on('listening', function() {
                    server.stop();
                    done();
                });

                server.start();
            };
            expect(fn).to.not.throw(Error);
        });

        it('throws an error when the server isn\'t started', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8090);
                server.stop();
            };
            expect(fn).to.throw(Error);
            done();
        });
    });


    describe('#setRoutesDefaults', function() {

        it('throws an error when a default handler is provided', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8091);
                server.setRoutesDefaults({ handler: function() {} });
            };
            expect(fn).to.throw(Error, 'Defaults cannot include a handler');
            done();
        });

        it('changes the value of routeDefaults with the passed in object', function(done) {
            var server = new Server('0.0.0.0', 8092);
            server.setRoutesDefaults({ item: true });
            expect(server.routeDefaults.item).to.be.true;
            done();
        });
    });


    describe('#addRoute', function() {

        it('throws an error when a route is passed in that is missing a path', function(done) {
            var fn = function() {
                var route = {
                };
                var server = new Server('0.0.0.0', 8093);
                server.addRoute(route);
            };
            expect(fn).to.throw(Error, 'Route options missing path');
            done();
        });

        it('throws an error when a route is passed in that is missing a method', function(done) {
            var fn = function() {
                var route = {
                    path: '/test'
                };
                var server = new Server('0.0.0.0', 8094);
                server.addRoute(route);
            };
            expect(fn).to.throw(Error, 'Route options missing method');
            done();
        });

        it('throws an error when a route is passed in that is missing a handler', function(done) {
            var fn = function() {
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

        it('adds route to correct _routes method property', function(done) {
            var route = {
                path: '/test',
                method: 'put',
                handler: function() { }
            };
            var server = new Server('0.0.0.0', 8096);
            server.addRoute(route);

            expect(server._routes.put[0]).to.exist;
            expect(server._routes.put[0].path).to.equal('/test');
            done();
        });
    });


    describe('#addRoutes', function() {

        it('throws an error when null routes are passed in', function(done) {
            var fn = function() {
                var server = new Server('0.0.0.0', 8097);
                server.addRoutes(null);
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('adds to routes object with the passed in routes values', function(done) {
            var routes = [{
                path: '/test',
                method: 'put',
                handler: function() { }
            }, {
                path: '/test',
                method: 'post',
                handler: function() { }
            }];
            var server = new Server('0.0.0.0', 8098);
            server.addRoutes(routes);

            expect(server._routes.put[0].path).to.equal('/test');
            done();
        });
    });
});