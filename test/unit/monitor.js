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
});

describe('System Monitor', function() {


});