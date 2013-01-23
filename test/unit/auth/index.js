// Load modules

var Chai = require('chai');
var Oz = require('oz');
var Hapi = require('../../helpers');
var Auth = require('../../../lib/auth');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


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

            expect(fn).to.throw(Error, 'Auth options must include one of scheme or strategies but not both');
            done();
        });

        it('doesn\'t throw an error when constructed with all required parameters', function (done) {

            var fn = function () {

                var server = {
                    settings: {},
                    addRoutes: function () { }
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
    });

    describe('#authenticate', function () {

        var test = function (scheme) {

            it('doesn\'t throw an error when a session exists and entity is any (' + scheme.scheme + ')', function (done) {

                var request = {
                    session: {
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'any'
                            }
                        }
                    },
                    log: function () { }
                };

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('doesn\'t throw an error when a session exists and entity defaults to any (' + scheme.scheme + ')', function (done) {

                var request = {
                    session: {
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                            }
                        }
                    },
                    log: function () { }
                };

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('doesn\'t throw an error when a session exists with a user and user entity specified (' + scheme.scheme + ')', function (done) {

                var request = {
                    session: {
                        user: 'test'
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'user'
                            }
                        }
                    },
                    log: function () { }
                };

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('throws an error when a session exists without a user and user entity is specified (' + scheme.scheme + ')', function (done) {

                var request = {
                    session: {
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'user'
                            }
                        }
                    },
                    log: function () { }
                };

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('throws an error when a session exists without a app and app entity is specified (' + scheme.scheme + ')', function (done) {

                var request = {
                    session: {
                        user: 'test'
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'app'
                            }
                        }
                    },
                    log: function () { }
                };

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('doesn\'t throw an error when a session exists with a app and app entity is specified (' + scheme.scheme + ')', function (done) {

                var request = {
                    session: {
                        app: 'test'
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'app'
                            }
                        }
                    },
                    log: function () { }
                };

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.not.exist;
                    done();
                });
            });

            it('throws an error when an unknown entity is specified (' + scheme.scheme + ')', function (done) {

                var server = {
                    settings: {},
                    addRoutes: function () { },
                    host: 'localhost'
                };

                var request = {
                    session: {
                        user: 'test'
                    },
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'wrongEntity'
                            }
                        }
                    },
                    log: function () { },
                    server: server,
                    host: 'localhost'
                };

                var auth = new Auth(server, scheme);

                auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                    expect(err).to.be.instanceOf(Error);
                    done();
                });
            });

            it('throws an error when missing session and bad request (' + scheme.scheme + ')', function (done) {

                var server = {
                    settings: {},
                    addRoutes: function () { }
                };

                var request = {
                    _timestamp: Date.now(),
                    _route: {
                        config: {
                            auth: {
                                entity: 'user'
                            }
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
    });

    describe('#setStrategies', function () {

        it('throws an error if no strategies are defined', function (done) {

            var request = {
                _timestamp: Date.now(),
                _route: {
                    config: {
                        auth: {}
                    }
                },
                log: function () { }
            };

            var server = {
                settings: {},
                addRoutes: function () { }
            };

            var scheme = {
                strategies: {}
            };



            var a = function () {

                var auth = new Auth(server, scheme);
            };

            expect(a).to.throw(Error);
            done();
        });

        it('doesn\'t throw an error if strategies are defined but not used', function (done) {

            var request = {
                _timestamp: Date.now(),
                _route: {
                    config: {
                        auth: {}
                    }
                },
                log: function () { }
            };

            var server = {
                settings: {},
                addRoutes: function () { }
            };

            var scheme = {
                strategies: {
                    'test': {
                        scheme: 'basic',
                        loadUserFunc: function () { }
                    }
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
                _route: {
                    config: {
                        auth: {
                            mode: 'required',
                            strategy: "test"
                        }
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
                            authorization: 'basic d2FsbWFydDp3YWxtYXJ0'
                        },
                        url: 'http://localhost/test'
                    }
                },
            };


            var server = {
                settings: {},
                addRoutes: function () { }
            };

            var scheme = {
                strategies: {
                    'test': {
                        scheme: 'basic',
                        loadUserFunc: function (username, callback) {

                            return callback(null, { id: 'walmart', password: 'walmart' })
                        }
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

        it('returns an error if strategies are defined but non matching strategy requested', function (done) {

            var request = {
                _timestamp: Date.now(),
                _route: {
                    config: {
                        auth: {
                            mode: 'required',
                            strategy: "missing"
                        }
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
                            authorization: 'basic d2FsbWFydDp3YWxtYXJ0'
                        },
                        url: 'http://localhost/test'
                    }
                },
            };


            var server = {
                settings: {},
                addRoutes: function () { }
            };

            var scheme = {
                strategies: {
                    'test': {
                        scheme: 'basic',
                        loadUserFunc: function (username, callback) {

                            return callback(null, { id: 'walmart', password: 'walmart' })
                        }
                    }
                }
            };

            var a = function () {

                var auth = new Auth(server, scheme);
                auth.authenticate(request, function (err) {

                    expect(err).to.exist;
                });
            };

            expect(a).to.not.throw(Error);
            done();
        });
    });
});