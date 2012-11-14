var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Auth = require(libPath + 'auth/index');

describe('Auth', function() {

    describe('#constructor', function() {

        it('throws an error when constructed without new', function(done) {

            var fn = function() {

                var auth = Auth();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when constructed without options', function(done) {

            var fn = function() {

                var auth = new Auth(null);
            };

            expect(fn).to.throw(Error, 'Invalid options');
            done();
        });

        it('throws an error when constructed without a scheme', function(done) {

            var fn = function() {

                var auth = new Auth(null, {scheme: null});
            };

            expect(fn).to.throw(Error, 'Missing scheme');
            done();
        });

        it('doesn\'t throw an error when constructed with all required parameters', function(done) {

            var fn = function() {

                var server = {
                    settings: { },
                    addRoutes: function() { }
                };

                var auth = new Auth(server, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { },
                    loadGrantFunc: function() { }
                });
            };

            expect(fn).to.not.throw(Error);
            done();
        });

        it('doesn\'t do anything when basic scheme is used', function(done) {

            var fn = function() {

                var server = {
                    settings: { },
                    addRoutes: function() { }
                };

                var auth = new Auth(server, {
                    scheme: 'basic'
                });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });

    describe('#authenticate', function() {

        it('doesn\'t throw an error when a session exists and entity is any', function(done) {

            var request = {
                session: {
                },
                _route: {
                    config: {
                        auth: {
                            entity: 'any'
                        }
                    }
                },
                log: function() { }
            };

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('doesn\'t throw an error when a session exists with a user', function(done) {

            var request = {
                session: {
                    user: 'test'
                },
                _route: {
                    config: {
                        auth: {
                        }
                    }
                },
                log: function() { }
            };

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('throws an error when a session exists without a user and no entity is provided', function(done) {

            var request = {
                session: {
                    test: 'test'
                },
                _route: {
                    config: {
                        auth: {
                        }
                    }
                },
                log: function() { }
            };

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.exist;
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('throws an error when a session exists without a app and app entity is specified', function(done) {

            var request = {
                session: {
                    user: 'test'
                },
                _route: {
                    config: {
                        auth: {
                            entity: 'app'
                        }
                    }
                },
                log: function() { }
            };

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.exist;
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('doesn\'t throw an error when a session exists with a app and app entity is specified', function(done) {

            var request = {
                session: {
                    app: 'test'
                },
                _route: {
                    config: {
                        auth: {
                            entity: 'app'
                        }
                    }
                },
                log: function() { }
            };

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('throws an error when an unknown entity is specified', function(done) {

            var server = {
                settings: { },
                addRoutes: function() { },
                host: 'localhost'
            };

            var request = {
                session: {
                    user: 'test'
                },
                _route: {
                    config: {
                        auth: {
                            entity: 'wrongEntity'
                        }
                    }
                },
                log: function() { },
                server: server,
                host: 'localhost'
            };

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.exist;
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('throws an error when missing session and bad request', function(done) {

            var server = {
                settings: { },
                addRoutes: function() { }
            };

            var request = {
                _route: {
                    config: {
                        auth: {
                            entity: 'user'
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

            var auth = new Auth(server, {
                scheme: 'oz',
                encryptionPassword: 'test',
                loadAppFunc: function() { },
                loadGrantFunc: function() { }
            });

            auth.authenticate(request, function(err) {

                expect(err).to.exist;
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });
    });
});