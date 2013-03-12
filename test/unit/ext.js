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
            expect(ext._events.onRequest).to.equal(null);
            done();
        });

        it('sorts dependencies', function (done) {

            var generateExt = function (value) {

                return function (request, next) {

                    request.x = request.x || '';
                    request.x += value;
                    next();
                };
            };

            var ext = new Ext();
            ext._add('onRequest', generateExt(0), { before: 'a' });
            ext._add('onRequest', generateExt(1), { after: 'f' }, 'a');
            ext._add('onRequest', generateExt(2), { before: 'a' });
            ext._add('onRequest', generateExt(3), { before: ['b', 'c'] }, 'a');
            ext._add('onRequest', generateExt(4), { after: 'c' }, 'b');
            ext._add('onRequest', generateExt(5), { before: 'a' }, 'c');
            ext._add('onRequest', generateExt(6), { before: 'a' }, 'd');
            ext._add('onRequest', generateExt(7), { before: 'a' }, 'e');
            ext._add('onRequest', generateExt(8), { before: 'd' });
            ext._add('onRequest', generateExt(9), { after: 'c' }, 'a');

            var request = {
                log: function () {}
            };

            ext.invoke(request, 'onRequest', function (err) {

                expect(err).to.not.exist;
                expect(request.x).to.equal('0213547869');
                done();
            });
        });
    });
});