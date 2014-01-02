// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Ext = require('../../lib/ext');
var Handler = require('../../lib/handler');


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

            var ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse'], Handler.invoke);
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

            var ext = new Ext(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler', 'onPostHandler', 'onPreResponse'], Handler.invoke);
            scenario.forEach(function (record, i) {

                ext._add('onRequest', generateExt(record.id), { before: record.before, after: record.after }, { name: record.group });
            });

            var request = {
                _route: { env: {} },
                server: {},
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

        it('sorts dependencies (explicit)', function (done) {

            var set = '0123456789abcdefghijklmnopqrstuvwxyz';
            var array = set.split('');

            var scenario = [];
            for (var i = 0, il = array.length; i < il; ++i) {
                var item = {
                    id: array[i],
                    group: array[i],
                    after: i ? array.slice(0, i) : [],
                    before: array.slice(i + 1)
                };
                scenario.push(item);
            }

            var fisherYates = function (array) {

                var i = array.length;
                while (--i) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var tempi = array[i];
                    var tempj = array[j];
                    array[i] = tempj;
                    array[j] = tempi;
                }
            };

            fisherYates(scenario);
            testDeps(scenario, function (result) {

                expect(result).to.equal(set);
                done();
            });
        });

        it('throws on circular dependency', function (done) {

            var scenario = [
                { id: '0', before: 'a', group: 'b' },
                { id: '1', before: 'c', group: 'a' },
                { id: '2', before: 'b', group: 'c' }
            ];

            expect(function () {

                testDeps(scenario, function (result) { });
            }).to.throw('onRequest extension added by c created a dependencies error');

            done();
        });
    });
});