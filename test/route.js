// Load modules

var Lab = require('lab');
var Async = require('async');
var Hoek = require('hoek');
var Hapi = require('..');
var Route = require('../lib/route');
var Request = require('../lib/request');
var Defaults = require('../lib/defaults');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Route', function () {

    it('throws when handler is missing in config', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.route({ method: 'GET', path: '/', config: { } });
        }).to.throw('Missing or undefined handler: /');
        done();
    });

    it('sets route plugins and app settings', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/', config: { handler: function (request, reply) { reply(request.route.app.x + request.route.plugins.x.y); }, app: { x: 'o' }, plugins: { x : { y: 'k' } } } });
        server.inject('/', function (res) {

            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('throws when validation is set without payload parsing', function (done) {

        var server = new Hapi.Server();
        expect(function () {

            server.route({ method: 'POST', path: '/', handler: function () {}, config: { validate: { payload: {} }, payload: { parse: false } } });
        }).to.throw('Route payload must be set to \'parse\' when payload validation enabled: /');
        done();
    });

    describe('#sort', function () {

        var paths = [
            '/',
            '/a',
            '/b',
            '/ab',
            '/a{p}b',
            '/a{p}',
            '/{p}b',
            '/{p}',
            '/a/b',
            '/a/{p}',
            '/b/',
            '/a1{p}/a',
            '/xx{p}/b',
            '/x{p}/a',
            '/x{p}/b',
            '/y{p?}/b',
            '/{p}xx/b',
            '/{p}x/b',
            '/{p}y/b',
            '/a/b/c',
            '/a/b/{p}',
            '/a/d{p}c/b',
            '/a/d{p}/b',
            '/a/{p}d/b',
            '/a/{p}/b',
            '/a/{p}/c',
            '/a/{p*2}',
            '/a/b/c/d',
            '/a/b/{p*2}',
            '/a/{p}/b/{x}',
            '/{p*5}',
            '/a/b/{p*}',
            '/{a}/b/{p*}',
            '/{p*}'
        ];

        it('compares every combination both ways', function (done) {

            for (var ai = 0, al = paths.length; ai < al; ++ai) {
                var a = { settings: { path: paths[ai] }, server: { settings: { router: { isCaseSensitive: true } } } };
                Route.prototype._parsePath.call(a);

                for (var bi = 0, bl = paths.length; bi < bl; ++bi) {
                    if (ai === bi) {
                        continue;
                    }

                    var b = { settings: { path: paths[bi] }, server: { settings: { router: { isCaseSensitive: true } } } };
                    Route.prototype._parsePath.call(b);

                    var a2b = Route.sort(a, b);
                    var b2a = Route.sort(b, a);

                    if (a2b !== (-1 * b2a)) {
                        console.log('a: \'' + paths[ai] + '\' | b: \'' + paths[bi] + '\'');
                    }

                    if (ai < bi && a2b !== -1) {
                        console.log('a: \'' + paths[ai] + '\' | b: \'' + paths[bi] + '\'');
                    }

                    expect(a2b).to.not.equal(0);
                    expect(a2b).to.equal(-1 * b2a);
                    expect(a2b).to.equal(ai < bi ? -1 : 1);
                }
            }

            done();
        });

        var handler = function (path) {

            return function (request, reply) {

                reply(path);
            };
        };

        var randomLoad = function () {

            it('sorts random routes in right order', function (done) {

                var server = new Hapi.Server();
                var copy = Hoek.clone(paths);
                while (copy.length) {
                    var i = Math.floor(Math.random() * (copy.length - 1));
                    var path = copy[i];
                    copy = copy.filter(function (item, index, array) { return index != i; });
                    server.route({ path: path, method: 'GET', handler: handler(path) });
                }

                var routes = server._router.routes['get'];
                var list = [];
                for (var i = 0, il = routes.length; i < il; ++i) {
                    var route = routes[i];
                    list.push(route.path);
                }

                expect(list).to.deep.equal(paths);
                done();
            });
        };

        for (var i = 0; i < 50; ++i) {
            randomLoad();
        }

        var server = new Hapi.Server();
        for (var i = 0, il = paths.length; i < il; ++i) {

            var path = paths[i];
            server.route({ path: path, method: 'GET', handler: handler(path) });
        }

        it('sorts routes in right order', function (done) {

            var routes = server._router.routes['get'];
            var list = [];
            for (var i = 0, il = routes.length; i < il; ++i) {
                var route = routes[i];
                list.push(route.path);
            }

            expect(list).to.deep.equal(paths);
            done();
        });

        it('matches routes in right order', function (done) {

            var requests = [
                ['/', '/'],
                ['/a', '/a'],
                ['/b', '/b'],
                ['/ab', '/ab'],
                ['/axb', '/a{p}b'],
                ['/axc', '/a{p}'],
                ['/bxb', '/{p}b'],
                ['/c', '/{p}'],
                ['/a/b', '/a/b'],
                ['/a/c', '/a/{p}'],
                ['/b/', '/b/'],
                ['/a1larry/a', '/a1{p}/a'],
                ['/xx1/b', '/xx{p}/b'],
                ['/xx1/a', '/x{p}/a'],
                ['/x1/b', '/x{p}/b'],
                ['/y/b', '/y{p?}/b'],
                ['/0xx/b', '/{p}xx/b'],
                ['/0x/b', '/{p}x/b'],
                ['/ay/b', '/{p}y/b'],
                ['/a/b/c', '/a/b/c'],
                ['/a/b/d', '/a/b/{p}'],
                ['/a/doc/b', '/a/d{p}c/b'],
                ['/a/dl/b', '/a/d{p}/b'],
                ['/a/ld/b', '/a/{p}d/b'],
                ['/a/a/b', '/a/{p}/b'],
                ['/a/d/c', '/a/{p}/c'],
                ['/a/d/d', '/a/{p*2}'],
                ['/a/b/c/d', '/a/b/c/d'],
                ['/a/b/c/e', '/a/b/{p*2}'],
                ['/a/c/b/d', '/a/{p}/b/{x}'],
                ['/a/b/c/d/e', '/{p*5}'],
                ['/a/b/c/d/e/f', '/a/b/{p*}'],
                ['/x/b/c/d/e/f/g', '/{a}/b/{p*}'],
                ['/x/y/c/d/e/f/g', '/{p*}']
            ];

            Async.forEachSeries(requests, function (request, next) {

                server.inject({ method: 'GET', url: request[0] }, function (res) {

                    expect(res.result).to.equal(request[1]);
                    next();
                });
            },
            function (err) {

                done();
            });
        });
    });

    describe('#pathRegex.validatePath', function () {

        var testPaths = function () {

            var paths = {
                '/': true,
                '/path': true,
                '/path/': true,
                '/path/to/somewhere': true,
                '/{param}': true,
                '/{param?}': true,
                '/{param*}': true,
                '/{param*5}': true,
                '/path/{param}': true,
                '/path/{param}/to': true,
                '/path/{param?}': true,
                '/path/{param}/to/{some}': true,
                '/path/{param}/to/{some?}': true,
                '/path/{param*2}/to': true,
                '/path/{param*27}/to': true,
                '/path/{param*2}': true,
                '/path/{param*27}': true,
                '/%20path/': true,
                'path': false,
                '/%path/': false,
                '/path/{param*}/to': false,
                '/path/{param*0}/to': false,
                '/path/{param*0}': false,
                '/path/{param*01}/to': false,
                '/path/{param*01}': false,
                '/{param?}/something': false,
                '/{param*03}': false,
                '/{param*3?}': false,
                '/{param*?}': false,
                '/{param*}/': false,
                '/a{p}': true,
                '/{p}b': true,
                '/a{p}b': true,
                '/d/a{p}': true,
                '/d/{p}b': true,
                '/d/a{p}b': true,
                '/a{p}/d': true,
                '/{p}b/d': true,
                '/a{p}b/d': true,
                '/d/a{p}/e': true,
                '/d/{p}b/e': true,
                '/d/a{p}b/e': true,
                '/a{p}.{x}': false,
                '/{p}{x}': false,
                '/a{p?}': true,
                '/{p*}d': false,
                '/a{p*3}': false
            };

            var test = function (path, isValid) {

                it('validates the path \'' + path + '\' as ' + (isValid ? 'well-formed' : 'malformed'), function (done) {

                    expect(!!(path.match(Route.pathRegex.validatePath))).to.equal(isValid);
                    done();
                });
            };

            var keys = Object.keys(paths);
            for (var i = 0, il = keys.length; i < il; ++i) {
                test(keys[i], paths[keys[i]]);
            }
        }();
    });

    describe('#_parsePath', function () {

        var testFingerprints = function () {

            var paths = {
                '/': '/',
                '/path': '/path',
                '/path/': '/path/',
                '/path/to/somewhere': '/path/to/somewhere',
                '/{param}': '/?',
                '/{param?}': '/?',
                '/{param*}': '/#',
                '/{param*5}': '/?/?/?/?/?',
                '/path/{param}': '/path/?',
                '/path/{param}/to': '/path/?/to',
                '/path/{param?}': '/path/?',
                '/path/{param}/to/{some}': '/path/?/to/?',
                '/path/{param}/to/{some?}': '/path/?/to/?',
                '/path/{param*2}/to': '/path/?/?/to',
                '/path/{param*}': '/path/#',
                '/path/{param*10}/to': '/path/?/?/?/?/?/?/?/?/?/?/to',
                '/path/{param*2}': '/path/?/?',
                '/%20path/': '/%20path/',
                '/a{p}': '/a?',
                '/{p}b': '/?b',
                '/a{p}b': '/a?b',
                '/a{p?}': '/a?',
                '/{p?}b': '/?b',
                '/a{p?}b': '/a?b'
            };

            var test = function (path, fingerprint) {

                it('process the path \'' + path + '\' as ' + fingerprint, function (done) {

                    var route = new Route({ path: path, method: 'get', handler: function () { } }, new Hapi.Server({ router: { isCaseSensitive: true } }));
                    expect(route.fingerprint).to.equal(fingerprint);
                    done();
                });
            };

            var keys = Object.keys(paths);
            for (var i = 0, il = keys.length; i < il; ++i) {
                test(keys[i], paths[keys[i]]);
            }
        }();

        var testMatch = function () {

            var paths = {
                '/path/to/|false': {
                    '/path/to': false,
                    '/Path/to': false,
                    '/path/to/': true,
                    '/Path/to/': true
                },
                '/path/to/|true': {
                    '/path/to': false,
                    '/Path/to': false,
                    '/path/to/': true,
                    '/Path/to/': false
                },
                '/path/{param*2}/to': {
                    '/a/b/c/d': false,
                    '/path/a/b/to': {
                        param: 'a/b'
                    }
                },
                '/path/{param*}': {
                    '/a/b/c/d': false,
                    '/path/a/b/to': {
                        param: 'a/b/to'
                    },
                    '/path/': {
                        param: ''
                    },
                    '/path': {
                        param: ''
                    }
                },
                '/path/{p1}/{p2?}': {
                    '/path/a/c/d': false,
                    '/Path/a/c/d': false,
                    '/path/a/b': {
                        p1: 'a',
                        p2: 'b'
                    },
                    '/path/a': {
                        p1: 'a',
                        p2: ''
                    },
                    '/path/a/': {
                        p1: 'a',
                        p2: ''
                    }
                },
                '/path/{p1}/{p2?}|false': {
                    '/path/a/c/d': false,
                    '/Path/a/c': {
                        p1: 'a',
                        p2: 'c'
                    },
                    '/path/a': {
                        p1: 'a',
                        p2: ''
                    },
                    '/path/a/': {
                        p1: 'a',
                        p2: ''
                    }
                },
                '/{p*}': {
                    '/path/': {
                        p: 'path/'
                    }
                },
                '/{a}/b/{p*}': {
                    '/a/b/path/': {
                        a: 'a',
                        p: 'path/'
                    }
                },
                '/a{b?}c': {
                    '/abc': {
                        b: 'b'
                    },
                    '/ac': {
                        b: ''
                    },
                    '/abC': false,
                    '/Ac': false
                },
                '/a{b?}c|false': {
                    '/abC': {
                        b: 'b'
                    },
                    '/Ac': {
                        b: ''
                    }
                },
                '/%0A': {
                    '/%0A': true,
                    '/%0a': true
                },
                '/a/b/{c}': {
                    '/a/b/c': true,
                    '/a/b': false
                }
            };

            var keys = Object.keys(paths);
            for (var i = 0, il = keys.length; i < il; ++i) {

                function test(path, matches, isCaseSensitive) {

                    var server = new Hapi.Server({ router: { isCaseSensitive: isCaseSensitive } });
                    var route = new Route({ path: path, method: 'get', handler: function () { } }, server);
                    var mkeys = Object.keys(matches);
                    for (var m = 0, ml = mkeys.length; m < ml; ++m) {
                        function match(route, match, result) {

                            it((result ? 'matches' : 'unmatches') + ' the path \'' + path + '\' with ' + match + ' (' + (isCaseSensitive ? 'case-sensitive' : 'case-insensitive') + ')', function (done) {

                                var request = {};
                                Request.prototype._setUrl.call(request, match);
                                var isMatch = route.match(request);

                                expect(isMatch).to.equal(!!result);
                                if (typeof result === 'object') {
                                    var ps = Object.keys(result);
                                    expect(ps.length).to.equal(request._paramsArray.length);

                                    for (var p = 0, pl = ps.length; p < pl; ++p) {
                                        expect(request.params[ps[p]]).to.equal(result[ps[p]]);
                                    }
                                }

                                done();
                            });
                        }
                        match(route, mkeys[m], matches[mkeys[m]]);
                    }
                }

                var pathParts = keys[i].split('|');
                var isCaseSensitive = (pathParts[1] ? pathParts[1] === 'true' : true);

                test(pathParts[0], paths[keys[i]], isCaseSensitive);
            }
        }();
    });

    describe('#match', function () {

        it('returns true when called with a matching path', function (done) {

            var server = new Hapi.Server();
            var route = new Route({ path: '/test', method: 'get', handler: function () { } }, server);
            var request = {
                path: '/test',
                method: 'get'
            };

            expect(route.match(request)).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function (done) {

            var server = new Hapi.Server();
            var route = new Route({ path: '/test', method: 'get', handler: function () { } }, server);
            var request = {
                path: '/test2',
                method: 'get'
            };

            expect(route.match(request)).to.be.false;
            done();
        });

        it('returns bad request route when called with an invalid path', function (done) {

            var server = new Hapi.Server();
            var route = new Route({ path: '/{test}', method: 'get', handler: function () { } }, server);
            var request = {
                path: '/test%l',
                _pathSegments: '/test%l'.split('/'),
                method: 'get'
            };

            expect(route.match(request).message).to.equal('URI malformed');
            done();
        });
    });

    describe('#test', function () {

        it('returns true when called with a matching path', function (done) {

            var server = new Hapi.Server();
            var route = new Route({ path: '/test', method: 'get', handler: function () { } }, server);

            expect(route.test('/test')).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function (done) {

            var server = new Hapi.Server();
            var route = new Route({ path: '/test', method: 'get', handler: function () { } }, server);

            expect(route.test('/test2')).to.be.false;
            done();
        });
    });
});