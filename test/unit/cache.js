// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Cache = require(libPath + 'cache/index');
var Server = require(libPath + 'server');
var Defaults = require(libPath + 'defaults');
var Sinon = require('sinon');


require('../suite')(function(useRedis, useMongo) {
    describe('Client', function() {

        it('throws an error if using an unknown engine type', function(done) {
            var fn = function() {
                var options = {
                    engine: 'bob'
                };

                var client = new Cache.Client(options);
            };

            expect(fn).to.throw(Error);
            done();
        });

        if (useRedis) {
            it('creates a new connection when using redis', function(done) {
                var client = new Cache.Client(Defaults.cache('redis'));
                expect(client).to.exist;
                done();
            });
        }

        if (useMongo) {
            it('creates a new connection when using mongodb', function (done) {
                var client = new Cache.Client(Defaults.cache('mongodb'));

                expect(client).to.exist;
                done();
            });
        }

        if (useRedis) {
            it('returns not found on get when using null key', function (done) {
                var client = new Cache.Client(Defaults.cache('redis'));
                client.get(null, function (err, result) {

                    expect(err).to.equal(null);
                    expect(result).to.equal(null);
                    done();
                });
            });

            it('returns error on set when using null key', function (done) {
                var client = new Cache.Client(Defaults.cache('redis'));
                client.set(null, {}, 1000, function (err) {

                    expect(err instanceof Error).to.equal(true);
                    done();
                });
            });

            it('returns error on drop when using null key', function (done) {
                var client = new Cache.Client(Defaults.cache('redis'));
                client.drop(null, function (err) {

                    expect(err instanceof Error).to.equal(true);
                    done();
                });
            });
        }

        if (useMongo) {
            it('creates a new connection when using mongodb', function (done) {
                var client = new Cache.Client(Defaults.cache('mongodb'));

                expect(client).to.exist;
                done();
            });
        }

        describe('#stop', function() {

            if (useMongo) {
                it('closes the connection when using mongodb', function (done) {
                    var client = new Cache.Client(Defaults.cache('mongodb'));

                    expect(client.connection.client).to.exist;

                    client.stop();
                    expect(client.connection.client).to.not.exist;
                    done();
                });
            }

            if (useRedis) {
                it('closes the connection when using redis', function (done) {
                    var client = new Cache.Client(Defaults.cache('redis'));

                    expect(client.connection.client).to.exist;

                    client.stop();
                    expect(client.connection.client).to.not.exist;
                    done();
                });
            }
        });

        describe('#stop', function() {

            if (useMongo) {
                it('closes the connection when using mongodb', function (done) {
                    var client = new Cache.Client(Defaults.cache('mongodb'));

                    expect(client.connection.client).to.exist;

                    client.stop();
                    expect(client.connection.client).to.not.exist;
                    done();
                });
            }

            it('closes the connection when using redis', function (done) {
                var client = new Cache.Client(Defaults.cache('redis'));

                expect(client.connection.client).to.exist;

                client.stop();
                expect(client.connection.client).to.not.exist;
                done();
            });
        });
    });

    describe('Cache Rules', function() {

        describe('#compile', function() {

            it('compiles a single rule', function(done) {
                var config = {
                    expiresIn: 50000
                } ;
                var rule = Cache.compile(config);

                expect(rule.expiresIn).to.equal(config.expiresIn);

                done();
            });

            it('is enabled for both client and server by defaults', function (done) {
                var config = {
                    expiresIn: 50000,
                    segment: 'test'
                };
                var client = new Cache.Client(Defaults.cache('redis'));
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
                var client = new Cache.Client(Defaults.cache('redis'));
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
                    var client = new Cache.Client(Defaults.cache('redis'));
                    var cache = new Cache.Policy(config, client);
                };

                expect(fn).to.throw(Error);

                done();
            });

            it('assigns the expiresIn when the rule is cached', function(done) {
                var config = {
                    expiresIn: 50000
                } ;
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

            it('returns rule when staleIn is less than expiresIn', function(done) {
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

            it('returns rule when staleIn is less than 24 hours and using expiresAt', function(done) {
                var config = {
                    expiresAt: '03:00',
                    staleIn: 5000000,
                    staleTimeout: 500
                };
                var rule = Cache.compile(config);

                expect(rule.staleIn).to.equal(5000 * 1000);

                done();
            });
        });

        describe('#ttl', function() {

            it('returns zero when a rule is expired', function(done) {
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

            it('returns a positive number when a rule is not expired', function(done) {
                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);
                var created = new Date(Date.now());

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.be.greaterThan(0);
                done();
            });

            it('returns the correct expires time when no created time is provided', function(done) {
                var config = {
                    expiresIn: 50000
                };
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.equal(50000);
                done();
            });

            it('returns 0 when created several days ago and expiresAt is used', function(done) {
                var config = {
                    expiresAt: '13:00'
                };
                var created = new Date(Date.now());
                created.setHours(15);
                created = new Date(created.setDate(created.getDay() - 4)).getTime();
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns the 0 when created several days ago and expiresAt is used with an hour before the created hour', function(done) {
                var config = {
                    expiresAt: '12:00'
                };
                var created = new Date(Date.now());
                created.setHours(10);
                created = new Date(created.setDate(created.getDay() - 4)).getTime();
                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule, created);
                expect(ttl).to.equal(0);
                done();
            });

            it('returns a positive number when using a future expiresAt', function(done) {
                var hour = new Date(Date.now() + 60 * 60 * 1000).getHours();

                var config = {
                    expiresAt: hour + ':00'
                };

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.be.greaterThan(0);
                done();
            });

            it('returns the correct number when using a future expiresAt', function(done) {
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

            it('returns correct number when using an expiresAt time tomorrow', function(done) {
                var hour = new Date(Date.now() - 60 * 60 * 1000).getHours();

                var config = {
                    expiresAt: hour + ':00'
                };

                var rule = Cache.compile(config);

                var ttl = Cache.ttl(rule);
                expect(ttl).to.be.closeTo(23 * 60 * 60 * 1000, 60 * 60 * 1000);
                done();
            });

            it('returns correct number when using a created time from yesterday and expires in 2 hours', function(done) {
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

        describe('Stale', function() {

            describe('#compile', function() {

                it('throws an error if has only staleTimeout or staleIn', function(done) {
                    var config = {
                        mode: 'server',
                        staleIn: 30000,
                        expiresIn: 60000
                    };

                    var fn = function() {
                        Cache.compile(config);
                    };

                    expect(fn).to.throw(Error);
                    done();
                });

                it('doesn\'t throw an error if has both staleTimeout and staleIn', function(done) {
                    var config = {
                        mode: 'server',
                        staleIn: 30000,
                        staleTimeout: 300,
                        expiresIn: 60000
                    };

                    var fn = function() {
                        Cache.compile(config);
                    };
                    expect(fn).to.not.throw(Error);
                    done();
                });

                it('throws an error if trying to use stale caching on the client', function(done) {
                    var config = {
                        mode: 'client',
                        staleIn: 30000,
                        expiresIn: 60000,
                        staleTimeout: 300
                    };

                    var fn = function() {
                        Cache.compile(config);
                    };

                    expect(fn).to.throw(Error);
                    done();
                });

                it('converts the stale time to ms', function(done) {
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

                it('throws an error if staleTimeout is greater than expiresIn', function(done) {
                    var config = {
                        mode: 'client',
                        staleIn: 2000,
                        expiresIn: 1000,
                        staleTimeout: 3000
                    };

                    var fn = function() {
                        Cache.compile(config);
                    };

                    expect(fn).to.throw(Error);
                    done();
                });

                it('throws an error if staleIn is greater than expiresIn', function(done) {
                    var config = {
                        mode: 'client',
                        staleIn: 1000000,
                        expiresIn: 60000,
                        staleTimeout: 30
                    };

                    var fn = function() {
                        Cache.compile(config);
                    };

                    expect(fn).to.throw(Error);
                    done();
                });
            });
        });
    });


    describe('Cache', function () {


        it('returns stale object then fresh object based on timing when calling a helper using the cache with stale config', function (done) {

            var options = {
                cache: {
                    expiresIn: 200,
                    staleIn: 100,
                    staleTimeout: 50
                }
            };

            var gen = 0;
            var method = function (id, next) {

                setTimeout(function () {

                    return next({ id: id, gen: ++gen });
                }, 55);
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'redis' });
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
                        }, 30);
                    });
                }, 110);
            });
        });

        it('returns stale object then invalidate cache on error when calling a helper using the cache with stale config', function (done) {

            var options = {
                cache: {
                    expiresIn: 200,
                    staleIn: 100,
                    staleTimeout: 50
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
                }, 55);
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'redis' });
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
                        }, 30);
                    });
                }, 110);
            });
        });

        it('returns fresh object calling a helper using the cache with stale config', function (done) {

            var options = {
                cache: {
                    expiresIn: 200,
                    staleIn: 100,
                    staleTimeout: 50
                }
            };

            var gen = 0;
            var method = function (id, next) {

                return next({ id: id, gen: ++gen });
            };

            var server = new Server('0.0.0.0', 8097, { cache: 'redis' });
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
                        }, 50);
                    });
                }, 150);
            });
        });

        it('returns a valid result when calling a helper using the cache with bad cache connection', function (done) {

            var server = new Server('0.0.0.0', 8097, { cache: 'redis' });
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
    });
});
