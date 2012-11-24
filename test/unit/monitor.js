// Load modules

var expect = require('chai').expect;
var Sinon = require('sinon');
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var monitorPath = require.resolve(libPath + 'monitor/index');
var Monitor = require(monitorPath);
var OSMonitor = require(libPath + 'monitor/system');


describe('Monitor', function() {

    it('throws an error constructed without new', function(done) {

        var fn = function() {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 50,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };

            var monitor = Monitor(config);
        };

        expect(fn).throws(Error, 'Monitor must be instantiated using new');
        done();
    });

    it('throws an error if opsInterval is too small', function(done) {

        var fn = function() {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 50,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };

            var monitor = new Monitor(config);
        };

        expect(fn).throws(Error, 'Invalid monitor.opsInterval configuration');
        done();
    });

    it('doesn\'t throw an error when opsInterval is more than 100', function(done) {

        var fn = function() {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };
            var monitor = new Monitor(config);
        };

        expect(fn).not.to.throw(Error);
        done();
    });

    it('uses the passed in broadcastInterval and sets the event queue correctly', function(done) {

        var subscribers = {
            console: ['ops', 'request', 'log'],
            'http://localhost/logs': ['log']
        };

        var server = {
            settings: {
                monitor: {
                    opsInterval: 200,
                    subscribers: subscribers,
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            },
            on: function() { },
            emit: function() { }
        };
        var monitor = new Monitor(server);

        expect(monitor._subscriberQueues.console).to.exist;
        expect(monitor._eventQueues.ops).to.exist;
        expect(monitor._eventQueues.request).to.exist;
        expect(monitor._eventQueues.log).to.exist;
        done();
    });

    it('throws an error if subscribers is null', function(done) {

        var fn = function() {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: null,
                        requestsEvent: 'response'
                    }
                }
            };
            var monitor = new Monitor(config);
        };

        expect(fn).throws(Error, 'Invalid monitor.subscribers configuration');
        done();
    });

    it('throws an error if requestsEvent is not response or tail', function(done) {

        var fn = function() {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: {},
                        requestsEvent: 'test'
                    }
                }
            };
            var monitor = new Monitor(config);
        };

        expect(fn).throws(Error, 'Invalid monitor.requestsEvent configuration');
        done();
    });

    describe('#_broadcast', function() {

        it('doesn\'t do anything if there are no subscribers', function(done) {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };

            var monitor = new Monitor(config);
            var broadcast = monitor._broadcast();

            expect(broadcast()).to.not.exist;
            done();
        });
    });

    describe('#_ops', function() {

        it('sets the event with the result data correctly', function(done) {

            var results = {
                osload: 1,
                osmem: 20,
                osdisk: 30,
                osup: 50
            };
            var subscribers = {
                console: ['ops']
            };

            var server = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: subscribers,
                        requestsEvent: 'response',
                        broadcastInterval: 5
                    }
                },
                on: function() { },
                emit: function() { }
            };
            var monitor = new Monitor(server);

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.ops).to.exist;

            var ops = monitor._ops();
            var event = ops(results);

            expect(event.os.load).to.equal(1);
            expect(event.os.mem).to.equal(20);
            expect(event.os.disk).to.equal(30);
            done();
        });
    });

    describe('#_request', function() {

        it('sets the event with the request data correctly', function(done) {

            var subscribers = {
                console: ['ops']
            };

            var server = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: subscribers,
                        requestsEvent: 'response',
                        broadcastInterval: 5
                    }
                },
                on: function() { },
                emit: function() { }
            };
            var request = {
                raw: {
                    req: {
                        headers: {
                            'user-agent': 'test'
                        }
                    }
                },
                _analytics: {},
                server: server
            };
            var monitor = new Monitor(server);

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.ops).to.exist;

            var requestFn = monitor._request();
            var event = requestFn(request);

            expect(event.event).to.equal('request');
            expect(event.source.userAgent).to.equal('test');
            done();
        });
    });
});