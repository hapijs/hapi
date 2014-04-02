// Load modules

var Lab = require('lab');
var Hapi = require('..');
var Package = require('../package.json');


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

    describe('#isAbsolutePath', function () {

        it('returns true for absolute *nix path', function (done) {
            var path = '/test/directory/file.js';
            expect(Hapi.utils.isAbsolutePath(path)).to.equal(true);
            done();
        });

        it('returns true for absolute Windows path', function (done) {
            var path = 'C:\\Test\\Directory\\File.txt';
            expect(Hapi.utils.isAbsolutePath(path)).to.equal(true);
            done();
        });

        it('returns true for absolute azure path', function (done) {
            var path = '\\\\server\\test\\directory\\file.js';
            expect(Hapi.utils.isAbsolutePath(path)).to.equal(true);
            done();
        });

        it('returns false for *nix relative path', function (done) {
            var path = '../test/directory/test.js';
            expect(Hapi.utils.isAbsolutePath(path)).to.equal(false);
            done();
        });

        it('returns false for windows relative path', function (done) {
            var path = '..\\test\\directory\\test.js';
            expect(Hapi.utils.isAbsolutePath(path)).to.equal(false);
            done();
        });

        it('returns false for empty path', function (done) {
            var path = '';
            expect(Hapi.utils.isAbsolutePath(path)).to.equal(false);
            done();
        });
    });
});
