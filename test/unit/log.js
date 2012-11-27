// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../lib-cov/hapi') : require('../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Log', function () {

    var stdoutIntercept = function (callback) {

        var write = process.stdout.write;

        process.stdout.write = function (string, encoding, fd) {

            callback(string, encoding, fd);
        };

        return function () {

            process.stdout.write = write;
        };
    };

    describe('#event', function () {

        it('fires an event with the passed in tags', function (done) {

            var tags = ['hello'];
            Hapi.log.once('log', function (event) {

                expect(event).to.exist;
                expect(event.tags).to.exist;
                expect(event.tags[0]).to.equal('hello');
                done();
            });
            Hapi.log.event(tags, null, Date.now());
        });

        it('outputs to stdout if no listeners exist', function (done) {

            var env = process.env.NODE_ENV;
            process.env.NODE_ENV = 'nottatest';

            var unhookStdout = stdoutIntercept(function (output) {

                expect(output).to.contain('hello');
            });

            var tags = ['hello'];
            Hapi.log.event(tags, null, Date.now());

            process.env.NODE_ENV = env;
            unhookStdout();
            done();
        });
    });

    describe('#print', function () {

        it('outputs correct text to stdout', function (done) {

            var event = {
                tags: ['tag1'],
                data: 'test'
            };

            var unhookStdout = stdoutIntercept(function (output) {

                expect(output).to.contain('test');
                expect(output).to.contain('tag1');
            });

            Hapi.log.print(event, false, true);
            unhookStdout();
            done();
        });

        it('outputs correct error text to stdout', function (done) {

            var event = {
                tags: ['tag1'],
                data: { a: 1 }
            };
            event.data.b = event.data;

            var unhookStdout = stdoutIntercept(function (output) {

                expect(output).to.contain('JSON Error');
            });

            Hapi.log.print(event, false, true);
            unhookStdout();
            done();
        });
    });
});

