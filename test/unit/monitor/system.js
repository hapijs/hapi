// Load modules

var Chai = require('chai');
var ChildProcess = require('child_process');
var Fs = require('fs');
var Sinon = require('sinon');
var Hapi = process.env.TEST_COV ? require('../../../lib-cov') : require('../../../lib');
var SystemMonitor = process.env.TEST_COV ? require('../../../lib-cov/monitor/system') : require('../../../lib/monitor/system');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('System Monitor', function () {

    it('throws an error when constructed without new', function (done) {

        var fn = function () {

            SystemMonitor.Monitor();
        };

        expect(fn).throws(Error, 'OSMonitor must be instantiated using new');
        done();
    });

    describe('#mem', function () {

        it('returns an object with the current memory usage', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.mem(function (err, mem) {

                expect(err).not.to.exist;
                expect(mem).to.exist;
                expect(mem.total).to.exist;
                expect(mem.free).to.exist;
                done();
            });
        });
    });

    describe('#poll_cpu', function () {

        it('returns an error if a target is omitted', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu(null, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('returns an error if the target is invalid', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('invalid', function (err) {

                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('returns cpu usage from stat file', function (done) {

            var contents = 'cpu0  171386021 1565 28586977 1765610273 1928350 7722 4662154 2232299 0            ';

            var readFileStub = Sinon.stub(Fs, 'readFile', function (fileName, callback) {

                readFileStub.restore();
                callback(null, contents);
            });

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('cpu0', function (err, stats) {

                expect(stats.idle).to.equal(1765610273);
                expect(stats.total).to.equal(1974415361);
                done();
            });
        });

        it('returns error when cpu target not found', function (done) {

            var contents = 'cpu0  171386021 1565 28586977 1765610273 1928350 7722 4662154 2232299 0            ';

            var readFileStub = Sinon.stub(Fs, 'readFile', function (fileName, callback) {

                readFileStub.restore();
                callback(null, contents);
            });

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('cpu1', function (err, stats) {

                expect(err).to.be.instanceOf(Error);
                expect(stats).not.to.exist;
                done();
            });
        });
    });

    describe('#cpu', function () {

        it('doesn\'t pass an error to the callback', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.cpu(function (err, result) {

                expect(err).to.not.exist;
                expect(result).to.exist;
                done();
            });
        });

        it('returns cpu usage delta from stat file', function (done) {

            var firstRun = true;
            var monitor = new SystemMonitor.Monitor();
            var pollStub = Sinon.stub(SystemMonitor.Monitor.prototype, 'poll_cpu', function (err, callback) {

                if (firstRun) {
                    firstRun = false;

                    return callback(null, {
                        idle: 1765610273,
                        total: 1974415361
                    });
                }

                return callback(null, {
                    idle: 1765613273,
                    total: 1994415361
                });
            });
            pollStub.withArgs('test1');

            var platform = process.platform;
            process.platform = 'linux';

            monitor.cpu('test1', function (err, stats) {

                pollStub.restore();
                process.platform = platform;
                expect(stats).to.equal('99.98');
                done();
            });
        });
    });

    describe('#disk', function () {

        it('returns disk usage information', function (done) {

            var monitor = new SystemMonitor.Monitor();

            var execStub = Sinon.stub(ChildProcess, 'exec');
            execStub.withArgs('df -m test1').callsArgWith(1, null, 'Filesystem 1M-blocks Used Available Capacity  Mounted on\ntest1 1220 333 1000 100%\n', '');

            monitor.disk('test1', function (err, usage) {

                expect(err).to.not.exist;
                expect(usage.total).to.equal(1220);
                expect(usage.free).to.equal(1000);
                execStub.restore();
                done();
            });
        });

        it('returns an error when free space greater than total', function (done) {

            var monitor = new SystemMonitor.Monitor();

            var execStub = Sinon.stub(ChildProcess, 'exec');
            execStub.withArgs('df -m test2').callsArgWith(1, null, 'Filesystem 1M-blocks Used Available Capacity  Mounted on\ntest2 220 333 1000 100%\n', '');

            monitor.disk('test2', function (err, usage) {

                expect(err).to.exist;
                execStub.restore();
                done();
            });
        });

        it('passes any errors to the callback', function (done) {

            var monitor = new SystemMonitor.Monitor();

            var execStub = Sinon.stub(ChildProcess, 'exec');
            execStub.withArgs('df -m test3').callsArgWith(1, new Error());

            monitor.disk('test3', function (err, usage) {

                expect(err).to.exist;
                expect(usage).to.not.exist;
                execStub.restore();
                done();
            });
        });
    });
});