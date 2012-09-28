// Load modules

var expect = require('chai').expect;
var SystemMonitor = process.env.TEST_COV ? require('../../lib-cov/monitor/system') : require('../../lib/monitor/system');

describe('System Monitor', function() {

    it('throws an error constructed without new', function(done) {
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

    describe('#poll_cpu', function(done) {

        it('returns an error if a target is omitted', function(done) {
            var monitor = new SystemMonitor.Monitor();
            monitor.poll_cpu(null, function(err) {
                expect(err).to.exist;
                done();
            });
        });
    });
});