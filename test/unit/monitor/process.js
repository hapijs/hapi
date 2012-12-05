// Load modules

var Chai = require('chai');
var ChildProcess = require('child_process');
var Sinon = require('sinon');
var Hapi = process.env.TEST_COV ? require('../../../lib-cov/hapi') : require('../../../lib/hapi');
var ProcessMonitor = process.env.TEST_COV ? require('../../../lib-cov/monitor/process') : require('../../../lib/monitor/process');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Process Monitor', function () {

    it('throws an error when constructed without new', function (done) {

        var fn = function () {

            ProcessMonitor.Monitor();
        };
        expect(fn).throws(Error, 'ProcessMonitor must be instantiated using new');
        done();
    });

    describe('#cpu', function () {

        it('passes the current cpu usage to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            monitor.cpu(function (err, cpu) {

                expect(err).not.to.exist;
                expect(cpu).to.exist;
                done();
            });
        });

        it('passes any errors to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            var args = 'ps -eo pcpu,pid | grep ' + process.pid + ' | awk \'{print $1}\'';

            var execStub = Sinon.stub(ChildProcess, 'exec');
            execStub.withArgs(args).callsArgWith(1, new Error());

            monitor.cpu(function (err, cpu) {

                expect(err).to.exist;
                execStub.restore();
                done();
            });
        });
    });

    describe('#memory', function () {

        it('passes the current memory usage to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            monitor.memory(function (err, mem) {

                expect(err).not.to.exist;
                expect(mem).to.exist;
                done();
            });
        });
    });
});