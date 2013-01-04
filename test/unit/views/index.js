// Load modules

var Chai = require('chai');
var Hapi = require('../../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Views', function () {

    // Use Views to create new singletons of Views
    
    var Views = Hapi.Response.View.Views.Views;
    
    // Use V to access default singleton of Views
    
    var V = new Views();
    V.init();
    
    var viewsPath = __dirname + '/handlebars';
    
    describe('#init', function () {

        it('should set .options to _defaultOptions if missing input', function (done) {

            var testView = new Views(); 
            var init = (function () {
                testView.init(null);
            });
            expect(init).to.not.throw();
            
            for(var key in testView._defaultOptions) {
                var val = testView._defaultOptions[key];
                if (testView._defaultOptions.hasOwnProperty(key)) {
                    expect(testView.options[key]).to.deep.equal(val);
                }
            }
            done();
        });
    });
    
    describe('#isAbsPath', function () {

        it('should return correct responses for known inputs', function (done) {

            var inputs = [
                ['/tmp', true],
                ['/usr/local/bin', true],
                ['./bin', false],
                ['hapihapijoijoi', false]
            ];
            for(var i in inputs) {
                var testInput = inputs[i][0];
                var testResult = inputs[i][1];
                
                expect(V.isAbsPath(testInput)).to.equal(testResult);
            }
            
            done();
        });
        
        it('should throw for invalid input types', function (done) {

            var inputs = [
                null,
                undefined,
                {x:1},
                false,
                true
            ];
            
            for(var i in inputs) {
                var testInput = inputs[i];
                
                var fn = (function () {

                    V.isAbsPath(testInput);
                });
                
                expect(fn).to.throw();
            }
            
            done();
        });
    });
    
    describe('#isInsecureAccessAttempt', function () {

        it('should return correct responses for known inputs', function (done) {

            var inputs = [
                ['/tmp', false],
                ['/usr/local/bin', false],
                ['../bin', true],
                ['hapihapi/../joijoi', true]
            ];
            for(var i in inputs) {
                var testInput = inputs[i][0];
                var testResult = inputs[i][1];
                
                expect(V.isInsecureAccessAttempt(testInput)).to.equal(testResult);
            }
            
            done();
        });
        
        it('should throw for invalid input types', function (done) {

            var inputs = [
                null,
                undefined,
                {x:1},
                false,
                true
            ];
            
            for(var i in inputs) {
                var testInput = inputs[i];
                
                var fn = (function () {

                    V.isInsecureAccessAttempt(testInput);
                });
                
                expect(fn).to.throw();
            }
            
            done();
        });
    });
    
    describe('#appendExtension', function () {

        it('should return correct responses for known values', function (done) {

            var inputs = [
                [null, '.html'],
                [undefined, '.html'],
                ['hapi', 'hapi.html']
            ];
            
            for(var i in inputs) {
                var testInput = inputs[i][0];
                var testResult = inputs[i][1];
                
                var result = V.appendExtension(testInput);
                expect(result).to.equal(testResult);
            }
            
            done();
        });
    });
    
    describe('#render', function () {

        var testView = new Views();
        testView.init({
            path: viewsPath,
            layout: false
        });
        
        var testViewWithLayouts = new Views();
        testViewWithLayouts.init({
            path: viewsPath,
            layout: true
        });
        
        
        it('should work and not throw with valid (no layouts)', function (done) {

            var fn = (function () {
                var html = testView.render('valid/test', {title: 'test', message: 'Hapi'});
                expect(html).to.exist;
                expect(html.length).above(1);
            });
            
            expect(fn).to.not.throw();
            done();
        });
        
        it('should work and not throw with valid (with layouts)', function (done) {

            var fn = (function () {
                var html = testViewWithLayouts.render('valid/test', {title: 'test', message: 'Hapi'});
                expect(html).to.exist;
                expect(html.length).above(1);
            });
            
            expect(fn).to.not.throw();
            done();
        });
        
        it('should throw when referencing non existant partial (with layouts)', function (done) {

            var fn = (function () {
                var html = testViewWithLayouts.render('invalid/test', {title: 'test', message: 'Hapi'});
                expect(html).to.exist;
                expect(html.length).above(1);
            });
            
            expect(fn).to.throw();
            done();
        });
        
        it('should throw when referencing non existant partial (no layouts)', function (done) {

            var fn = (function () {
                var html = testView.render('invalid/test', {title: 'test', message: 'Hapi'});
                expect(html).to.exist;
                expect(html.length).above(1);
            });
            
            expect(fn).to.throw();
            done();
        });
        
        it('should throw if context uses layoutKeyword as a key', function (done) {

            var fn = (function () {
                var opts = {title: 'test', message: 'Hapi'};
                opts[testView.options.layoutKeyword] = 1;
                var html = testViewWithLayouts.render('valid/test', opts);
            });
            
            expect(fn).to.throw();
            done();
        });
        
        it('should throw on compile error (invalid template code)', function (done) {

            var fn = (function () {
                var html = testView.render('invalid/badmustache', {title: 'test', message: 'Hapi'});
                console.log('html', html)
            });
            
            expect(fn).to.throw();
            done();
        });
    });
    
    describe('#getPath', function () {

        it('should throw on invalid inputs unless configured otherwise', function (done) {

            var inputs = [
                ['layout', {path: viewsPath, allowAbsolutePaths: false}, viewsPath + '/layout.html', false],
                [viewsPath + '/invalid/test', {path: viewsPath, allowAbsolutePaths: true}, viewsPath + '/invalid/test.html', false],
                [viewsPath + '/invalid/test', {path: viewsPath, allowAbsolutePaths: false}, viewsPath + '/invalid/test.html', true],
                ['invalid/../invalid/test', {path: viewsPath, allowInsecureAccess: true}, viewsPath + '/invalid/test.html', false],
                ['invalid/../invalid/test', {path: viewsPath, allowInsecureAccess: false}, viewsPath + '/invalid/test.html', true],
                ['doesnotexist', {path: viewsPath}, null, true]
            ];
            
            for(var i in inputs) {
                var testInput = inputs[i][0];
                var testOptions = inputs[i][1];
                var testResult = inputs[i][2];
                var shouldThrow = inputs[i][3];
                
                var fn = (function () {

                    var tempView = new Views();
                    var t = tempView.init(testOptions);
                    var result = tempView.getPath(testInput);
                    expect(result).to.equal(testResult);
                });
                
                if (shouldThrow) {
                    expect(fn).to.throw();
                }
                else {
                    expect(fn).to.not.throw();
                }
            }
            
            done();
        });
    });
    
    describe('#loadPartials', function () {

        it('should load partials and be able to render them', function (done) {

            // This test does more than just test #loadPartials, move render part once integration tests added
            var fn = (function () {

                var tempView = new Views();
                tempView.init({
                    path: viewsPath + '/valid',
                    partials: {
                        path: viewsPath + '/valid/partials'
                    }
                });
                
                var html = tempView.render('testPartials', {});
                expect(html).to.exist;
                expect(html.length).above(1);
            })
            
            expect(fn).to.not.throw();
            done();
        });
    });
    
    describe('#processPartials', function () {

        it('should throw err if passed err', function (done) {

            var fn = (function () {

                var tempView = new Views();
                tempView.init({
                    path: viewsPath + '/valid',
                    partials: {
                        path: viewsPath + '/valid/partials'
                    }
                });
                tempView.processPartials("error", []);
            })
            
            expect(fn).to.throw();
            done();
        });
    });
});