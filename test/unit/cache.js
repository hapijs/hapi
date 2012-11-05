// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Cache = require(libPath + 'cache/index');
var Server = require(libPath + 'server');
var Defaults = require(libPath + 'defaults');
var Log = require(libPath + 'log');
var Sinon = require('sinon');


require('../suite')(function (useRedis, useMongo) {

    describe('Client', function () {

        it('throws an error if using an unknown engine type', function (done) {

            var fn = function () {
                var options = {
                    engine: 'bob'
                };

                var client = new Cache.Client(options);
            };

            expect(fn).to.throw(Error);
            done();
        });

        var testEngine = function (engine) {

            it('creates a new connection using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.start(function (err) {

                    expect(client.isReady()).to.equal(true);
                    done();
                });
            });

            it('closes the connection using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.start(function (err) {

                    expect(client.isReady()).to.equal(true);
                    client.stop();
                    expect(client.isReady()).to.equal(false);
                    done();
                });
            });

            it('ignored starting a connection twice using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                var x = 2;
                var start = function () {

                    client.start(function (err) {

                        expect(client.isReady()).to.equal(true);
                        --x;
                        if (!x) {
                            done();
                        }
                    });
                };

                start();
                start();
            });

            it('returns not found on get when using null key using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.start(function (err) {

                    client.get(null, function (err, result) {

                        expect(err).to.equal(null);
                        expect(result).to.equal(null);
                        done();
                    });
                });
            });

            it('returns error on set when using null key using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.set(null, {}, 1000, function (err) {

                    expect(err instanceof Error).to.equal(true);
                    done();
                });
            });

            it('ignores set when using non-positive ttl value using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.start(function (err) {

                    client.set('x', 'y', 0, function (err) {

                        expect(err).to.not.exist;
                        done();
                    });
                });
            });

            it('returns error on drop when using null key using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.drop(null, function (err) {

                    expect(err instanceof Error).to.equal(true);
                    done();
                });
            });

            it('returns error on get when stopped using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.stop();
                client.connection.get('x', function (err, result) {

                    expect(err).to.exist;
                    expect(result).to.not.exist;
                    done();
                });
            });

            it('returns error on set when stopped using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.stop();
                client.connection.set('x', 'y', 1, function (err) {

                    expect(err).to.exist;
                    done();
                });
            });

            it('returns error on drop when stopped using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.stop();
                client.connection.drop('x', function (err) {

                    expect(err).to.exist;
                    done();
                });
            });

            it('returns error on missing segment name using ' + engine, function (done) {

                var config = {
                    expiresIn: 50000,
                    segment: ''
                };
                var fn = function () {
                    var client = new Cache.Client(Defaults.cache(engine));
                    var cache = new Cache.Policy(config, client);
                };
                expect(fn).to.throw(Error);
                done();
            });

            it('returns error on bad segment name using ' + engine, function (done) {

                var config = {
                    expiresIn: 50000,
                    segment: 'a\0b'
                };
                var fn = function () {
                    var client = new Cache.Client(Defaults.cache(engine));
                    var cache = new Cache.Policy(config, client);
                };
                expect(fn).to.throw(Error);
                done();
            });

            it('returns error when cache item dropped while stopped using ' + engine, function (done) {

                var client = new Cache.Client(Defaults.cache(engine));
                client.stop();
                client.drop('a', function (err) {

                    expect(err).to.exist;
                    done();
                });
            });
        };

        testEngine('memory');

        if (useMongo) {
            testEngine('mongodb');
        }

        if (useRedis) {
            testEngine('redis');
        }

        // Error engine

        var failOn = function (method) {

            var err = new Error('FAIL');
            var errorEngineImp = {

                start: function (callback) { callback(method === 'start' ? err : null); },
                stop: function () { },
                isReady: function () { return method !== 'isReady'; },
                validateSegmentName: function () { return method === 'validateSegmentName' ? err : null; },
                get: function (key, callback) { return callback(method === 'get' ? err : null); },
                set: function (key, value, ttl, callback) { return callback(method === 'set' ? err : null); },
                drop: function (key, callback) { return callback(method === 'drop' ? err : null); }
            };

            var options = {
                engine: errorEngineImp,
                partition: 'hapi-cache'
            };

            return new Cache.Client(options);
        };

        it('returns error when calling get on a bad connection', function (done) {

            var client = failOn('get');
            client.get('x', function (err, result) {

                expect(err).to.exist;
                expect(err.message).to.equal('FAIL');
                done();
            });
        });

        it('logs an error when fails to start on bad connection', function (done) {

            Log.once('log', function (event) {
                expect(event).to.exist;
                expect(event.tags).to.exist;
                expect(event.tags[0]).to.equal('cache');
                done();
            });
            var client = failOn('start');
        });
    });

    describe('Policy', function () {

        var getCache = function () {

            var config = {
                mode: 'client',
                expiresIn: 1
            };
            var client = new Cache.Client(Defaults.cache('memory'));
            var cache = new Cache.Policy(config, client);
            return cache;
        };

        it('returns null on get when cache mode is not server', function (done) {

            getCache().get('x', function (err, result) {

                expect(err).to.not.exist;
                expect(result).to.not.exist;
                done();
            });
        });

        it('returns null on set when cache mode is not server', function (done) {

            getCache().set('x', 'y', 100, function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('returns null on drop when cache mode is not server', function (done) {

            getCache().drop('x', function (err) {

                expect(err).to.not.exist;
                done();
            });
        });

        it('returns null on get when item expired', function (done) {

            var client = new Cache.Client(Defaults.cache('memory'));
            client.set('x', 'y', 1, function (err) {

                setTimeout(function () {

                    client.get('x', function (err, result) {

                        expect(err).to.not.exist;
                        expect(result).to.not.exist;
                        done();
                    });
                }, 2);
            });
        });
    });

    describe('Cache Rules', function () {

        describe('#compile', function () {

            it('compiles a single rule', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                expect(rule.expiresIn).to.equal(config.expiresIn);

                done();
            });

            it('is enabled for both client and server by defaults', function (done) {

                var config = {
                    expiresIn: 50000,
                    segment: 'test'
                };
                var client = new Cache.Client(Defaults.cache('memory'));
                var cache = new Cache.Policy(config, client);

                expect(cache.isMode('server')).to.equal(true);
                expect(cache.isMode('client')).to.equal(true);
                expect(Object.keys(cache.rule.mode).length).to.equal(2);

                done();
            });

            it('is disabled when mode is none', function (done) {

                var config = {
                    mode: 'none'
                };
                var client = new Cache.Client(Defaults.cache('memory'));
                var cache = new Cache.Policy(config, client);

                expect(cache.isEnabled()).to.equal(false);
                expect(Object.keys(cache.rule.mode).length).to.equal(0);

                done();
            });

            it('throws an error when mode is none and config has other options set', function (done) {

                var config = {
                    mode: 'none',
                    expiresIn: 50000
                };
                var fn = function () {

                    var cache = new Cache.Policy(config, {});
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when segment is missing', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var fn = function () {

                    var client = new Cache.Client(Defaults.cache('memory'));
                    var cache = new Cache.Policy(config, client);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('assigns the expiresIn when the rule is cached', function(done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                expect(rule.expiresIn).to.equal(config.expiresIn);

                done();
            });

            it('throws an error when parsing a rule with both expiresAt and expiresIn', function (done) {

                var config = {
                    expiresAt: 50,
                    expiresIn: '02:00'
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when parsing a rule with niether expiresAt or expiresIn', function (done) {

                var config = {
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when parsing a bad expiresAt value', function (done) {

                var config = {
                    expiresAt: function () { }
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleIn is used without staleTimeout', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleIn: 1000000
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is used without staleIn', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleTimeout: 100
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleIn is greater than a day and using expiresAt', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleIn: 100000000,
                    staleTimeout: 500
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleIn is greater than expiresIn', function (done) {

                var config = {
                    expiresIn: 500000,
                    staleIn: 1000000,
                    staleTimeout: 500
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is greater than expiresIn', function (done) {

                var config = {
                    expiresIn: 500000,
                    staleIn: 100000,
                    staleTimeout: 500000
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is greater than expiresIn - staleIn', function (done) {

                var config = {
                    expiresIn: 30000,
                    staleIn: 20000,
                    staleTimeout: 10000
                };
                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('throws an error when staleTimeout is used without server mode', function (done) {

                var config = {
                    mode: 'client',
                    expiresIn: 1000000,
                    staleIn: 500000,
                    staleTimeout: 500
                };
                var fn = function () {

                    var cache = new Cache.Policy(config, {});
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('returns rule when staleIn is less than expiresIn', function (done) {

                var config = {
                    expiresIn: 1000000,
                    staleIn: 500000,
                    staleTimeout: 500
                };
                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(500 * 1000);
                expect(rule.expiresIn).to.equal(1000 * 1000);

                done();
            });

            it('returns rule when staleIn is less than 24 hours and using expiresAt', function (done) {

                var config = {
                    expiresAt: '03:00',
                    staleIn: 5000000,
                    staleTimeout: 500
                };
                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(5000 * 1000);

                done();
            });

            it('throws an error if has only staleTimeout or staleIn', function (done) {

                var config = {
                    mode: 'server',
                    staleIn: 30000,
                    expiresIn: 60000
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('doesn\'t throw an error if has both staleTimeout and staleIn', function (done) {

                var config = {
                    mode: 'server',
                    staleIn: 30000,
                    staleTimeout: 300,
                    expiresIn: 60000
                };

                var fn = function () {

                    Cache.compile(config);
                };
                expect(fn).to.not.throw(Error);
                done();
            });

            it('throws an error if trying to use stale caching on the client', function (done) {

                var config = {
                    mode: 'client',
                    staleIn: 30000,
                    expiresIn: 60000,
                    staleTimeout: 300
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('converts the stale time to ms', function (done) {

                var config = {
                    mode: 'server+client',
                    staleIn: 30000,
                    expiresIn: 60000,
                    staleTimeout: 300
                };

                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(config.staleIn);
                done();
            });

            it('throws an error if staleTimeout is greater than expiresIn', function (done) {

                var config = {
                    mode: 'client',
                    staleIn: 2000,
                    expiresIn: 1000,
                    staleTimeout: 3000
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('throws an error if staleIn is greater than expiresIn', function (done) {

                var config = {
                    mode: 'client',
                    staleIn: 1000000,
                    expiresIn: 60000,
                    staleTimeout: 30
                };

                var fn = function () {

                    Cache.compile(config);
                };

                expect(fn).to.throw(Error);
                done();
            });
        });

        describe('#ttl', function () {

            it('returns zero when a rule is expired', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);
                var created = new Date(Date.now());
                created = created.setMinutes(created.getMinutes() - 5);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.equal(0);
                done();
            });

            it('returns a positive number when a rule is not expired', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);
                var created = new Date(Date.now());

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.greaterThan(0);
                done();
            });

            it('returns the correct expires time when no created time is provided', function (done) {

                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.equal(50000);
                done();
            });

            it('returns 0 when created several days ago and expiresAt is used', function (done) {

                var config = {
                    expiresAt: '13:00'
                };
                var created = Date.now() - 313200000;                                       // 87 hours (3 days + 15 hours)
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns 0 when created in the future', function (done) {

                var config = {
                    expiresIn: '100'
                };
                var created = Date.now() + 1000;
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns 0 for bad rule', function (done) {

                var created = Date.now() - 1000;
                var ttl = Cache.ttl({}, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns 0 when created 60 hours ago and expiresAt is used with an hour before the created hour', function (done) {

                var config = {
                    expiresAt: '12:00'
                };
                var created = Date.now() - 342000000;                                       // 95 hours ago (3 days + 23 hours)
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns a positive number when using a future expiresAt', function (done) {

                var hour = new Date(Date.now() + 60 * 60 * 1000).getHours();
                hour = hour === 0 ? 1 : hour;

                var config = {
                    expiresAt: hour + ':00'
                };

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.be.greaterThan(0);
                done();
            });

            it('returns the correct number when using a future expiresAt', function (done) {

                var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
                var hours = twoHoursAgo.getHours();
                var minutes = '' + twoHoursAgo.getMinutes();
                var created = twoHoursAgo.getTime() + (60 * 60 * 1000);
                minutes = minutes.length === 1 ? '0' + minutes : minutes;

                var config = {
                    expiresAt: hours + ':' + minutes
                };

                var rule = Cache.compile(config);
                var ttl = Cache.ttl(rule, created);

                expect(ttl).to.be.closeTo(22 * 60 * 60 * 1000, 60 * 1000);
                done();
            });

            it('returns correct number when using an expiresAt time tomorrow', function (done) {

                var hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

                var config = {
                    expiresAt: hour + ':00'
                };

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.be.closeTo(23 * 60 * 60 * 1000, 60 * 60 * 1000);
                done();
            });

            it('returns correct number when using a created time from yesterday and expires in 2 hours', function (done) {

                var hour = new Date(Date.now() + 2 * 60 * 60 * 1000).getHours();

                var config = {
                    expiresAt: hour + ':00'
                };
                var created = new Date(Date.now());
                created.setHours(new Date(Date.now()).getHours() - 22);

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.closeTo(60 * 60 * 1000, 60 * 60 * 1000);
                done();
            });
        });
    });

    describe('Stale', function () {

        before(function() {

            this.timeout(4000);
        });

        it('returns stale object then fresh object based on timing when calling a helper using the cache with stale config', function (done) {

            var options = {
                cache: {
                    expiresIn: 20,
                    staleIn: 10,
                    staleTimeout: 5
                }
            };

            var gen = 0;
            var method = function (id, next) {

                setTimeout(function () {

                    return next({ id: id, gen: ++gen });
                }, 6);
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
            server.addHelper('user', method, options);

            var id = Math.random();
            server.helpers.user(id, function (result1) {

                result1.gen.should.be.equal(1);     // Fresh
                setTimeout(function () {

                    server.helpers.user(id, function (result2) {

                        result2.gen.should.be.equal(1);     // Stale
                        setTimeout(function () {

                            server.helpers.user(id, function (result3) {

                                result3.gen.should.be.equal(2);     // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 11);
            });
        });

        it('returns stale object then invalidate cache on error when calling a helper using the cache with stale config', function (done) {

            var options = {
                cache: {
                    expiresIn: 20,
                    staleIn: 10,
                    staleTimeout: 5
                }
            };

            var gen = 0;
            var method = function (id, next) {

                setTimeout(function () {

                    if (gen !== 1) {
                        return next({ id: id, gen: ++gen });
                    }
                    else {
                        ++gen;
                        return next(new Error());
                    }
                }, 6);
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
            server.addHelper('user', method, options);

            var id = Math.random();
            server.helpers.user(id, function (result1) {

                result1.gen.should.be.equal(1);     // Fresh
                setTimeout(function () {

                    server.helpers.user(id, function (result2) {

                        // Generates a new one in background which will produce Error and clear the cache

                        result2.gen.should.be.equal(1);     // Stale

                        setTimeout(function () {

                            server.helpers.user(id, function (result3) {

                                result3.gen.should.be.equal(3);     // Fresh
                                done();
                            });
                        }, 3);
                    });
                }, 11);
            });
        });

        it('returns fresh object calling a helper using the cache with stale config', function (done) {

            var options = {
                cache: {
                    expiresIn: 20,
                    staleIn: 10,
                    staleTimeout: 5
                }
            };

            var gen = 0;
            var method = function (id, next) {

                return next({ id: id, gen: ++gen });
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
            server.addHelper('user', method, options);

            var id = Math.random();
            server.helpers.user(id, function (result1) {

                result1.gen.should.be.equal(1);     // Fresh
                setTimeout(function () {

                    server.helpers.user(id, function (result2) {

                        result2.gen.should.be.equal(2);     // Fresh

                        setTimeout(function () {

                            server.helpers.user(id, function (result3) {

                                result3.gen.should.be.equal(2);     // Fresh
                                done();
                            });
                        }, 5);
                    });
                }, 15);
            });
        });

        it('returns a valid result when calling a helper using the cache with bad cache connection', function (done) {

            var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
            server.cache.stop();
            var gen = 0;
            server.addHelper('user', function (id, next) { return next({ id: id, gen: ++gen }); }, { cache: { expiresIn: 2000 } });
            var id = Math.random();
            server.helpers.user(id, function (result1) {

                result1.id.should.be.equal(id);
                result1.gen.should.be.equal(1);
                server.helpers.user(id, function (result2) {

                    result2.id.should.be.equal(id);
                    result2.gen.should.be.equal(2);
                    done();
                });
            });
        });

        it('returns error when calling a helper using the cache with stale config when arrives within stale timeout', function (done) {

            var options = {
                cache: {
                    expiresIn: 20,
                    staleIn: 10,
                    staleTimeout: 5
                }
            };

            var gen = 0;
            var method = function (id, next) {

                if (gen !== 1) {
                    return next({ id: id, gen: ++gen });
                }
                else {
                    ++gen;
                    return next(new Error());
                }
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'memory' });
            server.addHelper('user', method, options);

            var id = Math.random();
            server.helpers.user(id, function (result1) {

                result1.gen.should.be.equal(1);     // Fresh
                setTimeout(function () {

                    server.helpers.user(id, function (result2) {

                        // Generates a new one which will produce Error

                        result2.should.be.instanceof(Error);     // Stale
                        done();
                    });
                }, 11);
            });
        });
    });
});

