// Load modules

var expect = require('chai').expect;
var Log = process.env.TEST_COV ? require('../../lib-cov/log') : require('../../lib/log');


describe('Log', function() {

    describe('#event', function() {

        it('fires an event with the passed in tags', function(done) {
            var env = process.env.NODE_ENV;
            var tags = ['hello'];
            process.env.NODE_ENV = 'nottatest';

            Log.on('log', function(event) {
                expect(event).to.exist;
                expect(event.tags).to.exist;
                expect(event.tags[0]).to.equal('hello');
                done();
            });
            Log.event(tags, null, Date.now());

            process.env.NODE_ENV = env;
        });
    });
});