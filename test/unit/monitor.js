// Load modules

var expect = require('chai').expect;
var Monitor = process.env.TEST_COV ? require('../../lib-cov/monitor/index') : require('../../lib/monitor/index');


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
});