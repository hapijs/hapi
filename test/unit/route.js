// Load modules

var expect = require('chai').expect;
var Route = process.env.TEST_COV ? require('../../lib-cov/route') : require('../../lib/route');
var ServerMock = require('./mocks/server');


describe('Route', function () {

    var _handler = function (request) {

        request.reply('ok');
    };

    it('throws an error if constructed without new', function (done) {

        var fn = function () {

            Route({}, ServerMock);
        };
        expect(fn).throws(Error, 'Route must be instantiated using new');
        done();
    });

    it('throws an error if the path is missing', function (done) {

        var fn = function () {

            var route = new Route({ method: 'get', handler: _handler }, ServerMock);
        };
        expect(fn).throws(Error);
        done();
    });

    it('throws an error if the method is missing', function (done) {

        var fn = function () {

            var route = new Route({ path: '/test', handler: _handler }, ServerMock);
        };
        expect(fn).throws(Error, 'Route options missing method');
        done();
    });

    it('doesn\'t throw an error when a method is present', function (done) {

        var fn = function () {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);
        };
        expect(fn).to.not.throw(Error);
        done();
    });

    it('throws an error if the handler is missing', function (done) {

        var fn = function () {

            var route = new Route({ path: '/test', method: 'get', handler: null }, ServerMock);
        };
        expect(fn).throws(Error, 'Handler must appear once and only once');
        done();
    });

    describe('#validatePathRegex', function () {

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
                '/{param*}/': false
            };

            var keys = Object.keys(paths);
            it('ensures no duplicated tests', function (done) {

                expect(keys.length).to.equal(30);
                done();
            });

            for (var i = 0, il = keys.length; i < il; ++i) {

                function test(path, isValid) {

                    it('validates the path \'' + path + '\' as ' + (isValid ? 'well-formed' : 'malformed'), function (done) {

                        expect(!!(path.match(Route.validatePathRegex))).to.equal(isValid);
                        done();
                    });
                };
                test(keys[i], paths[keys[i]]);
            }
        }();
    });

    describe('#_generateRegex', function () {

        var testFingerprints = function () {

            var paths = {
                '/': '/',
                '/path': '/path',
                '/path/': '/path/',
                '/path/to/somewhere': '/path/to/somewhere',
                '/{param}': '/?',
                '/{param?}': '/?',
                '/{param*}': '/?*',
                '/{param*5}': '/?/?/?/?/?',
                '/path/{param}': '/path/?',
                '/path/{param}/to': '/path/?/to',
                '/path/{param?}': '/path/?',
                '/path/{param}/to/{some}': '/path/?/to/?',
                '/path/{param}/to/{some?}': '/path/?/to/?',
                '/path/{param*2}/to': '/path/?/?/to',
                '/path/{param*10}/to': '/path/?/?/?/?/?/?/?/?/?/?/to',
                '/path/{param*2}': '/path/?/?',
                '/%20path/': '/%20path/'
            };

            var keys = Object.keys(paths);
            it('ensures no duplicated tests', function (done) {

                expect(keys.length).to.equal(17);
                done();
            });

            for (var i = 0, il = keys.length; i < il; ++i) {

                function test(path, fingerprint) {

                    it('process the path \'' + path + '\' as ' + fingerprint, function (done) {

                        var route = new Route({ path: path, method: 'get', handler: function () { } }, { settings: { router: { isTrailingSlashSensitive: false, isCaseSensitive: true } } });
                        route._generateRegex();

                        expect(route.fingerprint).to.equal(fingerprint);
                        done();
                    });
                };
                test(keys[i], paths[keys[i]]);
            }
        }();
    });

    describe('#match', function () {

        it('returns true when called with a matching path', function (done) {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);
            var request = {
                path: '/test',
                method: 'get'
            };

            expect(route.match(request)).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function (done) {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);
            var request = {
                path: '/test2',
                method: 'get'
            };

            expect(route.match(request)).to.be.false;
            done();
        });

        it('returns false when called with an invalid path', function (done) {

            var route = new Route({ path: '/{test}', method: 'get', handler: _handler }, ServerMock);
            var request = {
                path: '/test%l',
                method: 'get'
            };

            expect(route.match(request)).to.be.false;
            done();
        });
    });

    describe('#test', function () {

        it('returns true when called with a matching path', function (done) {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);

            expect(route.test('/test')).to.be.true;
            done();
        });

        it('returns false when called with a non-matching path', function (done) {

            var route = new Route({ path: '/test', method: 'get', handler: _handler }, ServerMock);

            expect(route.test('/test2')).to.be.false;
            done();
        });
    });
});