// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Partials', function () {

    var P = new Hapi.Response.View.Views.Partials();
    
    describe('#getPartialName', function () {

        it('should correctly parse known partial', function (done) {

            var testString = '/tmp/nav/nav.html';
            var testResult = 'nav/nav';
            
            var result = P.getPartialName({partials:{path: '/tmp'}, engine: {extension: 'html'}}, {}, testString);
            expect(result).to.equal(testResult);
            done();
        });
        
        it('should use slashReplacement if old version of handlebars used', function (done) {

            var slashReplacement = '-';
            var testString = '/tmp/nav/nav.html';
            var testResult = 'nav' + slashReplacement + 'nav';
            
            var testOptions = {
                partials: {
                    path: '/tmp'
                },
                engine: {
                    module: 'handlebars'
                },
                slashReplacement: slashReplacement
            };
            var testEngine = {
                VERSION: '1.0.rc.1'
            };
            
            var result = P.getPartialName(testOptions, testEngine, testString);
            expect(result).to.equal(testResult);
            done();
        })
    });
    
    describe('#extLength', function () {

        var generateInput = function (n) {
            return {
                engine: {
                    extension: n
                }
            };
        };
        
        it('should return (negative string length length) - 1', function (done) {

            var inputs = [
                ["html", -5],
                ["jade", -5],
                ["xml", -4]
            ];
            
            for(var i in inputs) {
                var ext = inputs[i][0];
                var testResult = inputs[i][1];
                
                var result = P.extLength(generateInput(ext));
                
                expect(result).to.equal(testResult);
            }
            done();
        });
        
        it('should consider default value if no input provided', function (done) {

            var inputs = [
                [null, -5],
                [undefined, -5]
            ];
            
            for(var i in inputs) {
                var ext = inputs[i][0];
                var testResult = inputs[i][1];
                
                var result = P.extLength(generateInput(ext));
                
                expect(result).to.equal(testResult);
            }
            done();
        })
    });
    
    describe('#find', function () {

        var jsSelector = function (filename) {

            return filename.slice(-3) == ".js";
        };
        
        it('should find at least one file in Hapi/test folder', function (done) {

            P.find(__dirname + '/../..', jsSelector, function (err, files) {

                expect(err).to.not.exist;
                expect(files).to.exist;
                expect(files.length).above(1);
                done();
            });
        });
        
        it('should work even if selector is omitted', function (done) {

            P.find(__dirname + '/../..', function (err, files) {

                expect(err).to.not.exist;
                expect(files).to.exist;
                expect(files.length).above(0);
                done();
            });
        })
    });
});