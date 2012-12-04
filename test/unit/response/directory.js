// Load modules

var Chai = require('chai');
var Hapi = process.env.TEST_COV ? require('../../../lib-cov/hapi') : require('../../../lib/hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('Directory', function () {

        describe('#_generateListing', function () {

            it('returns an error when reading an invalid directory', function (done) {

                var dir = new Hapi.response.Directory('no_such_path', {});
                dir._generateListing(function (response) {

                    expect(response.code).to.equal(500);
                    done();
                });
            });
        });
    });
});