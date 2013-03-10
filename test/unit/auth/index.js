// Load modules

var Lab = require('lab');
var Oz = require('oz');
var Hapi = require('../../..');
var Auth = require('../../../lib/auth');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Auth', function () {

    describe('#constructor', function () {

        it('throws an error when constructed without new', function (done) {

            var fn = function () {

                var auth = Auth();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when constructed without options', function (done) {

            var fn = function () {

                var auth = new Auth(null);
            };

            expect(fn).to.throw(Error, 'Invalid options');
            done();
        });

        it('throws an error when constructed without a scheme', function (done) {

            var fn = function () {

                var auth = new Auth(null, { scheme: null });
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error when constructed with all required parameters', function (done) {

            var fn = function () {

                var server = {
                    settings: {},
                    route: function () { }
                };

                var auth = new Auth(server, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function () { },
                    loadGrantFunc: function () { }
                });
            };

            expect(fn).to.not.throw(Error);
            done();
        });

        it('throws an error if no strategies are defined', function (done) {

            var request = {
                _timestamp: Date.now(),
                route: { auth: {} },
                log: function () { }
            };

            var server = {
                settings: {},
                route: function () { }
            };

            var a = function () {

                var auth = new Auth(server, {});
            };

            expect(a).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error if strategies are defined but not used', function (done) {

            var server = {
                settings: {},
                route: function () { }
            };

            var scheme = {
                'test': {
                    scheme: 'basic',
                    loadUserFunc: function () { }
                }
            };

            var a = function () {

                var auth = new Auth(server, scheme);
            };

            expect(a).to.not.throw(Error);
            done();
        });

        it('doesn\'t throw an error if strategies are defined and used', function (done) {

            var request = {
                _timestamp: Date.now(),
                route: {
                    auth: {
                        mode: 'required',
                        strategies: ['test']
                    }
                },
                log: function () { },
                raw: {
                    res: {
                        setHeader: function () { }
                    },
                    req: {
                        headers: {
                            host: 'localhost',
                            authorization: 'basic ' + (new Buffer('steve:password').toString('base64'))
                        },
                        url: 'http://localhost/test'
                    }
                }
            };


            var server = {
                settings: {},
                route: function () { }
            };

            var scheme = {
                'test': {
                    scheme: 'basic',
                    loadUserFunc: function (username, callback) {

                        return callback(null, { id: 'steve', password: 'password' });
                    }
                }
            };

            var a = function () {

                var auth = new Auth(server, scheme);
                auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                });
            };

            expect(a).to.not.throw(Error);
            done();
        });

        it('cannot create a route with a strategy not configured on the server', function (done) {

            var config = {
                auth: {
                    mode: 'required',
                    strategies: ['missing']
                }
            };

            var options = {
                auth: {
                    'test': {
                        scheme: 'basic',
                        loadUserFunc: function (username, callback) {

                            return callback(null, { id: 'steve', password: 'password' });
                        }
                    }
                }
            };

            var server = new Hapi.Server(options);

            var a = function () {

                var handler = function (request) { };
                server.route({ method: 'GET', path: '/', handler: handler, config: config });
            };

            expect(a).to.throw(Error, 'Unknown authentication strategy: missing');
            done();
        });
    });

    describe('#authenticate', function () {

        var test = function (scheme) {

            it('doesn\'t throw an error when a session exists and entity is any (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {},
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'any',
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('doesn\'t throw an error when a session exists and entity defaults to any (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('doesn\'t throw an error when a session exists with a user and user entity specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {
                        user: 'test'
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'user',
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('throws an error when a session exists without a user and user entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {},
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'user',
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('throws an error when a session exists without a app and app entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {
                        user: 'test'
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'app',
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('doesn\'t throw an error when a session exists with a app and app entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {
                        app: 'test'
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'app',
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('throws an error when an unknown entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    session: {
                        user: 'test'
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'wrongEntity',
                            strategies: [scheme.scheme]
                        }
                    },
                    log: function () { },
                    server: server,
                    host: 'localhost'
                };

                server.auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('throws an error when missing session and bad request (' + scheme.scheme + ')', function (done) {

                var server = {
                    settings: {},
                    route: function () { }
                };

                var request = {
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            mode: 'required',
                            entity: 'user',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    raw: {
                        res: {
                            setHeader: function () { }
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

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });
        };

        var oz = {
            scheme: 'oz',
            encryptionPassword: 'test',
            loadAppFunc: function () { },
            loadGrantFunc: function () { }
        };

        test(oz);

        var basic = {
            scheme: 'basic',
            loadUserFunc: function () { }
        };

        test(basic);

        var hawk = {
            scheme: 'hawk',
            getCredentialsFunc: function () { }
        };

        test(hawk);

        it('returns error on bad ext scheme callback', function (done) {

            var server = {
                settings: {}
            };

            var request = {
                _timestamp: Date.now(),
                route: {
                    auth: {
                        strategies: ['default']
                    }
                },
                log: function () { },
                raw: {
                    res: {
                        setHeader: function () { }
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

            var scheme = {
                scheme: 'ext:test',
                implementation: {
                    authenticate: function (request, callback) {

                        return callback(null, null, false);
                    }
                }
            };

            var auth = new Auth(server, scheme);

            auth.authenticate(request, function (err) {

                expect(err).to.exist;
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('Authentication response missing both error and session');
                done();
            });
        });
    });
});