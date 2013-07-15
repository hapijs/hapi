// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Auth = require('../../lib/auth');


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

            expect(fn).to.throw('Auth must be instantiated using new');
            done();
        });

        it('throws an error when constructed without options', function (done) {

            var fn = function () {

                var auth = new Auth();
                auth.addBatch(null);
            };

            expect(fn).to.throw(Error, 'Invalid auth options');
            done();
        });

        it('throws an error when constructed without a scheme', function (done) {

            var fn = function () {

                var auth = new Auth();
                auth.addBatch({ scheme: null });
            };

            expect(fn).to.throw('Cannot read property \'scheme\' of null');
            done();
        });

        it('doesn\'t throws an error if no strategies are defined', function (done) {

            var a = function () {

                var auth = new Auth();
                auth.addBatch({});
            };

            expect(a).to.not.throw;
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
                    validateFunc: function () { }
                }
            };

            var a = function () {

                var auth = new Auth(server);
                auth.addBatch(scheme);
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
                auth: {},
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
                    validateFunc: function (username, password, callback) {

                        return callback(null, password === 'password', { user: 'steve' });
                    }
                }
            };

            var a = function () {

                var auth = new Auth(server);
                auth.addBatch(scheme);
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
                        validateFunc: function (username, password, callback) {

                            return callback(null, password === 'password', { id: 'steve', password: 'password' });
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

            it('doesn\'t throw an error when credentials exist and entity is any (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    auth: {
                        credentials: {}
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'any',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server
                };

                server._auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('doesn\'t throw an error when credentials exist and entity defaults to any (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    auth: {
                        credentials: {}
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server
                };

                server._auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('doesn\'t throw an error when credentials exist with a user and user entity specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    auth: {
                        credentials: {
                            user: 'test'
                        }
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'user',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server
                };

                server._auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('throws an error when credentials exist without a user and user entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    auth: {
                        credentials: {}
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'user',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server
                };

                server._auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('throws an error when credentials exist without a app and app entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    auth: {
                        credentials: {
                            user: 'test'
                        }
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'app',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server
                };

                server._auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('doesn\'t throw an error when credentials exist with a app and app entity is specified (' + scheme.scheme + ')', function (done) {

                var options = {
                    auth: scheme
                };

                var server = new Hapi.Server('localhost', 0, options);

                var request = {
                    auth: {
                        credentials: {
                            app: 'test'
                        }
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'app',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server
                };

                server._auth.authenticate(request, function (err) {

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
                    auth: {
                        credentials: {
                            user: 'test'
                        }
                    },
                    _timestamp: Date.now(),
                    route: {
                        auth: {
                            entity: 'wrongEntity',
                            strategies: ['default']
                        }
                    },
                    log: function () { },
                    server: server,
                    host: 'localhost'
                };

                server._auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('throws an error when missing credentials and bad request (' + scheme.scheme + ')', function (done) {

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
                    auth: {
                        credentials: {}
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

                var auth = new Auth(server);
                auth.addBatch(scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });
        };

        var basic = {
            scheme: 'basic',
            validateFunc: function () { }
        };

        test(basic);

        var hawk = {
            scheme: 'hawk',
            getCredentialsFunc: function () { }
        };

        test(hawk);

        it('returns error on bad ext scheme callback', function (done) {

            var server = new Hapi.Server({
                auth: {
                    implementation: {
                        authenticate: function (request, callback) {

                            return callback(null, null, false);
                        }
                    }
                }
            });

            var handler = function () {

                this.reply('ok');
            };

            server.route({ method: 'GET', path: '/', handler: handler, config: { auth: 'default' } });
            server.inject({ url: '/', method: 'GET' }, function (res) {

                expect(res.statusCode).to.equal(500);
                done();
            });
        });
    });
});