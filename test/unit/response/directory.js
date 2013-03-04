// Load modules

var Chai = require('chai');
var Hapi = require('../../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('Directory', function () {

        describe('#_generateListing', function () {

            it('returns an error when reading an invalid directory', function (done) {

                var dir = new Hapi.response.Directory(['no_such_path'], {});
                dir._generateListing('no_such_path', null, function (response) {

                    expect(response.response.code).to.equal(500);
                    done();
                });
            });
        });
    });
});