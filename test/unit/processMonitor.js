// Load modules

var expect = require('chai').expect;
var ProcessMonitor = process.env.TEST_COV ? require('../../lib-cov/monitor/process') : require('../../lib/monitor/process');

describe('Process Monitor', function() {

    it('throws an error when constructed without new', function(done) {
        var fn = function() {
            ProcessMonitor.Monitor();
        };
        expect(fn).throws(Error, 'ProcessMonitor must be instantiated using new');
        done();
    });

    describe('#cpu', function() {

        it('passes the current cpu usage to the callback', function(done) {
            var monitor = new ProcessMonitor.Monitor();
            monitor.cpu(function(err, cpu) {
                expect(err).not.to.exist;
                expect(cpu).to.exist;
                done();
            });
        });
    });

    describe('#memory', function() {

        it('passes the current memory usage to the callback', function(done) {
            var monitor = new ProcessMonitor.Monitor();
            monitor.memory(function(err, mem) {
                expect(err).not.to.exist;
                expect(mem).to.exist;
                done();
            });
        });
    });
});