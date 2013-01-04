// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('View', function () {

        it('should not throw when created', function (done) {

            var fn = (function () {
                Hapi.response.View.Views.init({
                    path: __dirname + '/../views/handlebars/valid'
                })
                var view = new Hapi.response.View('test', {});
                
                expect(view._payload).to.exist;
                expect(view._payload.length).above(1);
            });
            
            expect(fn).to.not.throw();
            done();
        });
    });
});