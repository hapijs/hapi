// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Ext = require('../../lib/ext');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Ext', function () {

    describe('#sort', function () {

        it('skips when no exts added', function (done) {

            var ext = new Ext();
            ext.sort('onRequest');
            expect(ext.onRequest).to.equal(null);
            done();
        });
    });
});