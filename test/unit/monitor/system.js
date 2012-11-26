// Load modules

var expect = require('chai').expect;
var Fs = require('fs');
var Sinon = require('sinon');
var libPath = process.env.TEST_COV ? '../../../lib-cov/' : '../../../lib/';
var SystemMonitor = require(libPath + 'monitor/system');


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

            monitor.poll_cpu('invalid', function(err) {

                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('returns cpu usage from stat file', function(done) {

            var contents = 'cpu0  171386021 1565 28586977 1765610273 1928350 7722 4662154 2232299 0            ';

            var readFileStub = Sinon.stub(Fs, 'readFile', function(fileName, callback) {

                readFileStub.restore();
                callback(null, contents);
            });

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('cpu0', function(err, stats) {

                expect(stats.idle).to.equal(1765610273);
                expect(stats.total).to.equal(1974415361);
                done();
            });
        });

        it('returns error when cpu target not found', function(done) {

            var contents = 'cpu0  171386021 1565 28586977 1765610273 1928350 7722 4662154 2232299 0            ';

            var readFileStub = Sinon.stub(Fs, 'readFile', function(fileName, callback) {

                readFileStub.restore();
                callback(null, contents);
            });

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('cpu1', function(err, stats) {

                expect(err).to.be.instanceOf(Error);
                expect(stats).not.to.exist;
                done();
            });
        });
    });

    describe('#cpu', function() {

        it('doesn\'t pass an error to the callback', function(done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.cpu(function(err, result) {

                expect(err).to.not.exist;
                expect(result).to.exist;
                done();
            });
        });

        it('returns cpu usage delta from stat file', function(done) {

            var pollStub = Sinon.stub(SystemMonitor.Monitor.prototype, 'poll_cpu', function(target, callback) {

                return callback(null, {
                    idle: 1,
                    total: 2
                });
            });

            var monitor = new SystemMonitor.Monitor();
            var platform = process.platform;
            process.platform = 'linux';

            monitor.cpu('cpu0', function(err, stats) {

                pollStub.restore();
                process.platform = platform;
                console.log(stats);
                //done();
            });

            pollStub.restore();
            done();
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