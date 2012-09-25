// Load modules

var expect = require('chai').expect;
var Hoek = require('hoek');
var ServerMock = require('./mocks/server');
var Monitor = process.env.TEST_COV ? require('../../lib-cov/monitor/') : require('../../lib/monitor/');


describe('Monitor', function() {

    it('throws an error if opsInterval too small', function(done) {
        var fn = function() {
            var server = Hoek.clone(ServerMock);
            server.settings.monitor = {
                opsInterval: 50,
                subscribers: {},
                requestsEvent: 'response'
            };
            var monitor = Monitor(server);
        };
        expect(fn).throws(Error, 'Invalid monitor.opsInterval configuration');
        done();
    });

    it('doesn\'t throw an error when opsInterval is more than 100', function(done) {
        var fn = function() {
            var server = Hoek.clone(ServerMock);
            server.settings.monitor = {
                opsInterval: 200,
                subscribers: {},
                requestsEvent: 'response'
            };
            var monitor = Monitor(server);
        };
        console.log(fn());
        expect(fn).not.to.throw(Error);
        done();
    });

    it('throws an error if subscribers is null', function(done) {
        var fn = function() {
            var server = Hoek.clone(ServerMock);
            server.settings.monitor = {
                opsInterval: 200,
                subscribers: null,
                requestsEvent: 'response'
            };
            var monitor = Monitor(server);
        };
        expect(fn).throws(Error, 'Invalid monitor.subscribers configuration');
        done();
    });

    it('throws an error if requestsEvent is not response or tail', function(done) {
        var fn = function() {
            var server = Hoek.clone(ServerMock);
            server.settings.monitor = {
                opsInterval: 200,
                subscribers: {},
                requestsEvent: 'test'
            };
            var monitor = Monitor(server);
        };
        expect(fn).throws(Error, 'Invalid monitor.requestsEvent configuration');
        done();
    });
});