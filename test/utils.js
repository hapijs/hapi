// Load modules

var Code = require('code');
var Hapi = require('..');
var Lab = require('lab');
var Package = require('../package.json');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Utils', function () {

    describe('#version', function () {

        it('returns the correct package version number', function (done) {

            expect(Hapi.version).to.equal(Package.version);
            done();
        });
    });
});
