// Load modules

var expect = require('chai').expect;
var SystemMonitor = process.env.TEST_COV ? require('../../lib-cov/monitor/system') : require('../../lib/monitor/system');

describe('System Monitor', function() {

    it('throws an error when constructed without new', function(done) {
        var fn = function() {
            SystemMonitor.Monitor();
        };
        expect(fn).throws(Error, 'OSMonitor must be instantiated using new');
        done();
    });

    describe('#mem', function() {

        it('returns an object with the current memory usage', function(done) {
            var monitor = new SystemMonitor.Monitor();
            monitor.mem(function(err, mem) {
                expect(err).not.to.exist;
                expect(mem).to.exist;
                expect(mem.total).to.exist;
                expect(mem.free).to.exist;
                done();
            });
        });
    });

    describe('#poll_cpu', function() {

        it('returns an error if a target is omitted', function(done) {
            var monitor = new SystemMonitor.Monitor();
            monitor.poll_cpu(null, function(err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns an error if the target is invalid', function(done) {
            var monitor = new SystemMonitor.Monitor();
            monitor.poll_cpu('invalid', function(err, result) {
                expect(err).to.be.instanceOf(Error);
                done();
            });
        });
    });

    describe('#disk', function() {

        it('returns disk usage information', function(done) {
            var monitor = new SystemMonitor.Monitor();
            monitor.disk(function(err, result) {
                expect(err).to.not.exist;
                expect(result).to.exist;
                expect(result.free).to.be.greaterThan(1);
                expect(result.total).to.be.greaterThan(1);
                done();
            });
        });
    });
});