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

            expect(Mime.path('/static/javascript/app.js')).deep.equal({
                source: 'iana',
                charset: 'UTF-8',
                compressible: true,
                extensions: ['js'],
                type: 'application/javascript'
            });
            done();
        });

        it('returns empty object if a match can not be found', function (done) {

            expect(Mime.path('/static/javascript')).to.deep.equal({});
            done();
        });
    });

    describe('#type', function () {

        it('returns a found type', function (done) {

            expect(Mime.type('text/plain')).to.deep.equal({
                source: 'iana',
                compressible: true,
                extensions: ['txt', 'text', 'conf', 'def', 'list', 'log', 'in', 'ini'],
                type: 'text/plain'
            });
            done();
        });

        it('returns a missing type', function (done) {

            expect(Mime.type('hapi/test')).to.deep.equal({
                source: 'hapi',
                compressible: false,
                extensions: [],
                type: 'hapi/test'
            });
            done();
        });
    });
});
