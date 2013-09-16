// Load modules

var Lab = require('lab');
var Hapi = require('../..');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Helper', function () {

    var server = null;

    before(function (done) {

        server = new Hapi.Server(0);
        server.start(done);
    });

    it('reuses cached helper value', function (done) {

        var gen = 0;
        var helper = function (id, next) {

            return next({ id: id, gen: gen++ });
        };

        server.helper('test', helper, { cache: { expiresIn: 1000 } });

        server.helpers.test(1, function (result) {

            expect(result.gen).to.equal(0);

            server.helpers.test(1, function (result) {

                expect(result.gen).to.equal(0);
                done();
            });
        });
    });

    it('generates new value after cache drop', function (done) {

        var gen = 0;
        var helper = function (id, next) {

            return next({ id: id, gen: gen++ });
        };

        server.helper('dropTest', helper, { cache: { expiresIn: 1000 } });

        server.helpers.dropTest(2, function (result) {

            expect(result.gen).to.equal(0);
            server.helpers.dropTest.cache.drop(2, function (err) {

                expect(err).to.not.exist;

                server.helpers.dropTest(2, function (result) {

                    expect(result.gen).to.equal(1);
                    done();
                });
            });
        });
    });

    it('errors on invalid drop key', function (done) {

        var gen = 0;
        var helper = function (id, next) {

            return next({ id: id, gen: gen++ });
        };

        server.helper('dropErrTest', helper, { cache: { expiresIn: 1000 } });

        server.helpers.dropErrTest.cache.drop(function () {}, function (err) {

            expect(err).to.exist;
            done();
        });
    });
});

