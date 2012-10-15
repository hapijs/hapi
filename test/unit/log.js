// Load modules

var expect = require('chai').expect;
var Log = process.env.TEST_COV ? require('../../lib-cov/log') : require('../../lib/log');


describe('Log', function () {

    describe('#event', function () {

        it('fires an event with the passed in tags', function (done) {

            Log.logFunc = function (string) {

                expect(string.match(/^\*\d{6}\/\d{6}\.\d{1,3}\, test, (\{"1"\:2\})|(JSON Error\: .*)$/)).to.exist;
            };

            Log.isTesting = true;
            Log.event('test', { 1: 2 });
            var circ = {};
            circ.circ = circ;
            Log.event('test', circ);

            Log.on('log', function (event) {

                expect(event).to.exist;
                expect(event.tags).to.exist;
                expect(event.tags[0]).to.equal('hello');

                Log.isTesting = false;
                Log.logFunc = console.log;
                done();
            });
            Log.event(['hello'], null, Date.now());
        });
    });
});

