// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');
var Views = require('../../../lib/views');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('View', function () {

        it('does not throw when created', function (done) {

            var fn = (function () {

                var manager = new Views({
                    path: __dirname + '/../templates/valid'
                });

                var view = new Hapi.response.View(manager, 'test', { message: "Ohai" });
                view._prepare({ _states: [] }, function (response) {

                    expect(view._payload).to.exist;
                    expect(view._payload.length).above(1);
                });
            });

            expect(fn).to.not.throw();
            done();
        });

        it('returns error on invalid template path', function (done) {

            var manager = new Views({
                path: __dirname + '/../templates/invalid'
            });

            var view = new Hapi.response.View(manager, 'test', { message: "Ohai" });
            view._prepare({}, function (response) {

                expect(response instanceof Error).to.equal(true);
                done();
            });
        });
    });
});

