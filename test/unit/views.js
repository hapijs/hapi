// Load modules

var Lab = require('lab');
var Hapi = require('../..');
var Views = require('../../lib/views');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Views', function () {

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

            var error = testView.render('invalid/badmustache', { title: 'test', message: 'Hapi' });
            expect(error instanceof Error).to.equal(true);
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
            });

            expect(fn).to.not.throw();
            done();
        });

        it('should load partials and render them EVEN if viewsPath has trailing slash', function (done) {

            var fn = (function () {

                var tempView = new Views({
                    path: viewsPath + '/valid',
                    partials: {
                        path: viewsPath + '/valid/partials/'
                    }
                });

                var html = tempView.render('testPartials', {});
                expect(html).to.exist;
                expect(html.length).above(1);
            });

            expect(fn).to.not.throw();
            done();
        });

        it('should skip loading partial if engine does not have registerPartial method', function (done) {

            var fn = (function () {

                var tempView = new Views({
                    path: viewsPath + '/valid',
                    partials: {
                        path: viewsPath + '/valid/partials'
                    },
                    engines: {
                        'html': { module: 'jade' }
                    }
                });

                var html = tempView.render('testPartials', {});
                expect(html).to.exist;
                expect(html.length).above(1);
            })

            expect(fn).to.not.throw();
            done();
        })
    });

    describe('#handler', function () {

        var options = {
            views: {
                path: viewsPath
            }
        };

        internals._handlerServer = new Hapi.Server(options);
        internals._handlerServer.route({ method: 'GET', path: '/{param}', handler: { view: 'valid/handler' } });

        it('handles routes to views', function (done) {

            internals._handlerServer.inject({
                method: 'GET',
                url: '/hello'
            }, function (res) {

                expect(res.result).to.contain('hello');
                done();
            });
        });
    });
});
