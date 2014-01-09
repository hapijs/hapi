// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Route = require('../../lib/route');
var Request = require('../../lib/request');
var Defaults = require('../../lib/defaults');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Route', function () {

    var server = new Hapi.Server(Defaults.server);

    var _handler = function (request, reply) {

        reply('ok');
    };

    it('throws an error if the method is missing', function (done) {

        var fn = function () {

            var route = new Route({ path: '/test', handler: _handler }, server);
        };
        expect(fn).throws(Error);
        done();
    });

    it('does not throw an error when a method is present', function (done) {

        var fn = function () {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, server);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error if the handler is missing', function (done) {

        var fn = function () {

            var route = new Route({ path: '/test', method: 'get', handler: null }, server);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error if the path is includes an encoded non-reserved character', function (done) {

        var fn = function () {

            var route = new Route({ path: '/abc%21123', method: 'get', handler: _handler }, server);
        };
        expect(fn).throws(Error);
        done();
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

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, server);
            var request = {
                path: '/test',
                method: 'get'
            };

            expect(route.match(request)).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function (done) {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, server);
            var request = {
                path: '/test2',
                method: 'get'
            };

            expect(route.match(request)).to.be.false;
            done();
        });

        it('returns bad request route when called with an invalid path', function (done) {

            var route = new Route({ path: '/{test}', method: 'get', handler: _handler }, server);
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

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, server);

            expect(route.test('/test')).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function (done) {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, server);

            expect(route.test('/test2')).to.be.false;
            done();
        });
    });
});