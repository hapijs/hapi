// Load modules

var Lab = require('lab');
var Mime = require('../lib/mime');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;

describe('Mime', function () {

    describe('#path', function () {

        it('returns the mime type from a file path', function (done) {

            var result = Mime.path('/static/javascript/app.js');

            expect(result).deep.equal({
                source: 'iana',
                charset: 'UTF-8',
                compressible: true,
                extensions: [ 'js' ],
                type: 'application/javascript'
            });
            done();
        });

        it('returns false if a match can not be found', function (done) {

            var result = Mime.path('/static/javascript');
            expect(result).to.deep.equal({});
            done();
        });
    });
});
