// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Response', function () {

    describe('View', function () {

        describe('#_generateListing', function () {

            it('returns an error when reading an invalid directory', function (done) {

                var fn = (function () {
                    Hapi.response.View.Views.init({
                        path: __dirname + '/../views/handlebars'
                    })
                    var view = new Hapi.response.View('valid/test', {});
                    
                    expect(view._payload).to.exist;
                    expect(view._payload.length).above(1);
                });
                
                expect(fn).to.not.throw();
                done();
            });
        });
    });
});