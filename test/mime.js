// Load modules

var Lab = require('lab');
var Mime = require('../lib/mime');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var before = lab.before;
var after = lab.after;
var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;

describe('Mime', function () {

    describe('fromPath', function () {

        it('returns the mime type from a file path', function (done) {

            var result = Mime.fromPath('/static/javascript/app.js');

            expect(result).deep.equal({
                source: 'iana',
                charset: 'UTF-8',
                compressible: true,
                extensions: [ 'js' ],
                name: 'application/javascript'
            });
            done();
        });

        it('returns false if a match can not be found', function (done) {

            var result = Mime.fromPath('/static/javascript');

            expect(result).to.equal(false);
            done();
        });

        it ('returns false if path is not a string', function (done) {

            var result = Mime.fromPath(10);

            expect(result).to.equal(false);
            done();
        });
    });
});
