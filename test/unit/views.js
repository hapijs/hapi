// Load modules

var Chai = require('chai');
var Hapi = require('../helpers');
var Views = process.env.TEST_COV ? require('../../lib-cov/views') : require('../../lib/views');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Views', function () {

    var manager = new Views();

    var viewsPath = __dirname + '/templates';

    describe('#render', function () {

        var testView = new Views({
            path: viewsPath,
            layout: false
        });

        var testViewWithLayouts = new Views({
            path: viewsPath,
            layout: true
        });
        
        it('should work and not throw with valid (no layouts)', function (done) {

            var fn = (function () {
                var html = testView.render('valid/test', { title: 'test', message: 'Hapi' });
                expect(html).to.exist;
                expect(html.length).above(1);
            });

            expect(fn).to.not.throw();
            done();
        });

        it('should work and not throw with valid (with layouts)', function (done) {

            var fn = (function () {
                var html = testViewWithLayouts.render('valid/test', { title: 'test', message: 'Hapi' });
                expect(html).to.exist;
                expect(html.length).above(1);
            });

            expect(fn).to.not.throw();
            done();
        });

        it('should throw when referencing non existant partial (with layouts)', function (done) {

            var fn = (function () {
                var html = testViewWithLayouts.render('invalid/test', { title: 'test', message: 'Hapi' });
                expect(html).to.exist;
                expect(html.length).above(1);
            });

            expect(fn).to.throw();
            done();
        });

        it('should throw when referencing non existant partial (no layouts)', function (done) {

            var fn = (function () {
                var html = testView.render('invalid/test', { title: 'test', message: 'Hapi' });
                expect(html).to.exist;
                expect(html.length).above(1);
            });

            expect(fn).to.throw();
            done();
        });

        it('should throw if context uses layoutKeyword as a key', function (done) {

            var fn = (function () {
                var opts = { title: 'test', message: 'Hapi' };
                opts[testView.options.layoutKeyword] = 1;
                var html = testViewWithLayouts.render('valid/test', opts);
            });

            expect(fn).to.throw();
            done();
        });

        it('should throw on compile error (invalid template code)', function (done) {

            var fn = (function () {
                var html = testView.render('invalid/badmustache', { title: 'test', message: 'Hapi' });
            });

            expect(fn).to.throw();
            done();
        });

        it('should load partials and be able to render them', function (done) {

            var fn = (function () {

                var tempView = new Views({
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
});