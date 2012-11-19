var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Scheme = require(libPath + 'auth/oz').Scheme;
var Oz = require('oz');

describe('Oz Scheme', function() {

    describe('#constructor', function() {

        it('throws an error when constructed without new', function(done) {

            var fn = function() {

                var scheme = Scheme();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when constructed without options', function(done) {

            var fn = function() {

                var scheme = new Scheme(null);
            };

            expect(fn).to.throw(Error, 'Invalid options');
            done();
        });

        it('throws an error when constructed without oz scheme', function(done) {

            var fn = function() {

                var scheme = new Scheme(null, {scheme: 'notOz'});
            };

            expect(fn).to.throw(Error, 'Wrong scheme');
            done();
        });

        it('throws an error when constructed without encryption password', function(done) {

            var fn = function() {

                var scheme = new Scheme(null, {scheme: 'oz'});
            };

            expect(fn).to.throw(Error, 'Missing encryption password');
            done();
        });

        it('throws an error when constructed without loadAppFunc', function(done) {

            var fn = function() {

                var scheme = new Scheme(null, {scheme: 'oz', encryptionPassword: 'test'});
            };

            expect(fn).to.throw(Error, 'Missing required loadAppFunc method in configuration');
            done();
        });

        it('throws an error when constructed without loadGrantFunc', function(done) {

            var fn = function() {

                var scheme = new Scheme(null, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { }
                });
            };

            expect(fn).to.throw(Error, 'Missing required loadGrantFunc method in configuration');
            done();
        });

        it('throws an error when constructed without server', function(done) {

            var fn = function() {

                var scheme = new Scheme(null, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { },
                    loadGrantFunc: function() { }
                });
            };

            expect(fn).to.throw(Error, 'Server is required');
            done();
        });

        it('doesn\'t throw an error when constructed with all required parameters', function(done) {

            var fn = function() {

                var server = {
                    settings: { },
                    addRoutes: function() { }
                };

                var scheme = new Scheme(server, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { },
                    loadGrantFunc: function() { }
                });
            };

            expect(fn).to.not.throw(Error);
            done();
        });

        it('applies oz settings when passed in', function(done) {

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var settings = {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { },
                ozSettings: { ticket: { myKey: 'myValue' } }
            };

            var scheme = new Scheme(server, settings);

            expect(Oz.settings.ticket.myKey).to.equal('myValue');
            done();
        });

        describe('authenticate', function() {

            it('doesn\'t return an error when missing session and bad request with optional auth', function(done) {

                var server = {
                    settings: { },
                    addRoutes: function() { }
                };

                var request = {
                    _route: {
                        config: {
                            auth: {
                                mode: 'optional'
                            }
                        }
                    },
                    log: function() { },
                    raw: {
                        res: {
                            setHeader: function() { }
                        },
                        req: {
                            headers: {
                                host: 'localhost'
                            },
                            url: 'http://localhost/test'
                        }
                    },
                    server: server
                };

                var scheme = new Scheme(server, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { },
                    loadGrantFunc: function() { }
                });

                scheme.authenticate(request, function(err) {

                    expect(err).to.not.exist;
                    done();
                });
            });
        });
    });
});