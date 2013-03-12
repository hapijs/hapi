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

        var testDeps = function (scenario, callback) {

            var generateExt = function (value) {

                return function (request, next) {

                    request.x = request.x || '';
                    request.x += value;
                    next();
                };
            };

            var ext = new Ext();
            scenario.forEach(function (record, i) {

                ext._add('onRequest', generateExt(record.id), { before: record.before, after: record.after }, record.group);
            });

            var request = {
                log: function () { }
            };

            ext.invoke(request, 'onRequest', function (err) {

                expect(err).to.not.exist;
                callback(request.x);
            });
        };

        it('sorts dependencies (1)', function (done) {

            var scenario = [
                { id: '0', before: 'a' },
                { id: '1', after: 'f', group: 'a' },
                { id: '2', before: 'a' },
                { id: '3', before: ['b', 'c'], group: 'a' },
                { id: '4', after: 'c', group: 'b' },
                { id: '5', group: 'c' },
                { id: '6', group: 'd' },
                { id: '7', group: 'e' },
                { id: '8', before: 'd' },
                { id: '9', after: 'c', group: 'a' }
            ];

            testDeps(scenario, function (result) {

                expect(result).to.equal('0213547869');
                done();
            });
        });

        it('sorts dependencies (2)', function (done) {

            var scenario = [
                { id: '0', before: 'a' },
                { id: '1', after: 'f', group: 'a' },
                { id: '2', before: 'a' },
                { id: '3', before: ['b', 'c'], group: 'a' },
                { id: '4', after: 'c', group: 'b' },
                { id: '5', group: 'c' },
                { id: '6', group: 'd' },
                { id: '7', group: 'e' },
                { id: '8', before: 'd', after: 'e' },
                { id: '9', after: 'c', group: 'a' }
            ];

            testDeps(scenario, function (result) {

                expect(result).to.equal('0213547869');
                done();
            });
        });
    });
});