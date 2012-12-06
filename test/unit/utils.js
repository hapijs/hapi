// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../lib-cov') : require('../../lib');
var Package = require('../../package.json');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Utils', function () {

    describe('#version', function () {

        it('returns the correct package version number', function (done) {

            expect(Hapi.Utils.version()).to.equal(Package.version);
            done();
        });
    });
});