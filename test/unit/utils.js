// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Package = require('../../package.json');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Utils', function () {

    describe('#version', function () {

        it('returns the correct package version number', function (done) {

            expect(Hapi.utils.version()).to.equal(Package.version);
            done();
        });
    });
});