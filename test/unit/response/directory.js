// Load modules

var Lab = require('lab');
var Hapi = require('../../..');
var Directory = require('../../../lib/response/directory');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Response', function () {

    describe('Directory', function () {

        describe('#_generateListing', function () {

            it('returns an error when reading an invalid directory', function (done) {

                var dir = new Directory(['no_such_path'], {});
                dir._generateListing('no_such_path', null, function (response) {

                    expect(response.response.code).to.equal(500);
                    done();
                });
            });
        });
    });
});