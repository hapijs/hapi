// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');
var Views = process.env.TEST_COV ? require('../../../lib-cov/views') : require('../../../lib/views');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('View', function () {

        it('should not throw when created', function (done) {

            var fn = (function () {
                var manager = new Views({
                    path: __dirname + '/../templates/valid'
                });
                var view = new Hapi.response.View(manager, 'test', {message: "Ohai"});
                
                expect(view._payload).to.exist;
                expect(view._payload.length).above(1);
            });
            
            expect(fn).to.not.throw();
            done();
        });
    });
});
