// Load modules

var expect = require('chai').expect;
var Utils = process.env.TEST_COV ? require('../../lib-cov/utils') : require('../../lib/utils');
var Version = require('../../package.json').version;

describe('Utils', function() {

    describe('#version', function() {

        it('returns the correct package version number', function(done) {
            expect(Utils.version()).to.equal(Version);
            done();
        });
    });
});