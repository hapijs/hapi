// Load modules

var Lab = require('lab');
var Hapi = require('..');
var Views = require('../lib/views');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Views', function () {

    describe('#render', function () {

        it('renders with async compile', function (done) {

            var views = new Views.Manager({
                path: __dirname + '/templates',
                engines: {
                    'html': {
                        compileMode: 'async',
                        module: {
                            compile: function (string, options, callback) {

                                var compiled = require('handlebars').compile(string, options);
                                var renderer = function (context, opt, next) {

                                    return next(null, compiled(context, opt));
                                };

                                return callback(null, renderer);
                            }
                        }
                    }
                }
            });

            views.render('valid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(rendered).to.exist;
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('returns error on sync compile that throws', function (done) {

            var views = new Views.Manager({
                path: __dirname + '/templates',
                engines: {
                    'html': {
                        compileMode: 'sync',
                        module: {
                            compile: function (string, options) {

                                throw (new Error('Bad bad view'));
                            }
                        }
                    }
                }
            });

            views.render('valid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(err).to.exist;
                expect(err.message).to.equal('Bad bad view');
                done();
            });
        });

        it('should work and not throw with valid (no layouts)', function (done) {

            var testView = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: false
            });

            testView.render('valid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(rendered).to.exist;
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('should work and not throw with valid (with layouts)', function (done) {

            var testViewWithLayouts = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: true
            });

            testViewWithLayouts.render('valid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(rendered).to.exist;
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('errors on invalid layout', function (done) {

            var views = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: 'badlayout'
            });

            views.render('valid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(err).to.exist;
                expect(err.message).to.equal('Parse error on line 1:\n{{}\n--^\nExpecting \'ID\', \'DATA\', got \'INVALID\': Parse error on line 1:\n{{}\n--^\nExpecting \'ID\', \'DATA\', got \'INVALID\'');
                done();
            });
        });

        it('errors on invalid layout path', function (done) {

            var views = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: '/badlayout'
            });

            views.render('valid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(err).to.exist;
                expect(err.message).to.equal('Absolute paths are not allowed in views');
                done();
            });
        });

        it('should work and not throw with valid jade layouts', function (done) {

            var testViewWithJadeLayouts = new Views.Manager({
                engines: { 'jade': 'jade' },
                path: __dirname + '/templates' + '/valid/',
                layout: true
            });

            testViewWithJadeLayouts.render('index', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('should work and not throw without jade layouts', function (done) {

            var testViewWithoutJadeLayouts = new Views.Manager({
                engines: { 'jade': 'jade' },
                path: __dirname + '/templates' + '/valid/',
                layout: false
            });

            testViewWithoutJadeLayouts.render('test', { title: 'test', message: 'Hapi Message' }, null, function (err, rendered, config) {

                expect(rendered).to.contain('Hapi Message');
                done();
            });
        });

        it('should work and not throw with basePath, template name, and no path', function (done) {

            var views = new Views.Manager({ engines: { 'html': 'handlebars' } });
            views.render('test', { title: 'test', message: 'Hapi' }, { basePath: __dirname + '/templates/valid' }, function (err, rendered, config) {

                expect(rendered).to.exist;
                expect(rendered).to.contain('Hapi');
                done();
            });
        });

        it('should return error when referencing non existant partial (with layouts)', function (done) {

            var testViewWithLayouts = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: true
            });

            testViewWithLayouts.render('invalid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(err).to.exist;
                done();
            });
        });

        it('should return error when referencing non existant partial (no layouts)', function (done) {

            var testView = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: false
            });

            testView.render('invalid/test', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(err).to.exist;
                done();
            });

        });

        it('should return error if context uses layoutKeyword as a key', function (done) {

            var testViewWithLayouts = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: true
            });

            var opts = { title: 'test', message: 'Hapi', content: 1 };
            testViewWithLayouts.render('valid/test', opts, null, function (err, rendered, config) {

                expect(err).to.exist;
                done();
            });
        });

        it('should return error on compile error (invalid template code)', function (done) {

            var testView = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates',
                layout: false
            });

            testView.render('invalid/badmustache', { title: 'test', message: 'Hapi' }, null, function (err, rendered, config) {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });

        it('should load partials and be able to render them', function (done) {

            var tempView = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates/valid',
                partialsPath: __dirname + '/templates/valid/partials'
            });

            tempView.render('testPartials', {}, null, function (err, rendered, config) {

                expect(rendered).to.equal(' Nav:<nav>Nav</nav>|<nav>Nested</nav>');
                done();
            });
        });

        it('should load partials and render them EVEN if viewsPath has trailing slash', function (done) {

            var tempView = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates/valid',
                partialsPath: __dirname + '/templates/valid/partials/'
            });

            tempView.render('testPartials', {}, null, function (err, rendered, config) {

                expect(rendered).to.exist;
                expect(rendered.length).above(1);
                done();
            });
        });

        it('should skip loading partials and helpers if engine does not support them', function (done) {

            var tempView = new Views.Manager({
                path: __dirname + '/templates/valid',
                partialsPath: __dirname + '/templates/valid/partials',
                helpersPath: __dirname + '/templates/valid/helpers',
                engines: { 'html': 'jade' }
            });

            tempView.render('testPartials', {}, null, function (err, rendered, config) {

                expect(rendered).to.equal('Nav:{{> nav}}|{{> nested/nav}}');
                done();
            });
        });

        it('should load helpers and render them', function (done) {

            var tempView = new Views.Manager({
                engines: { 'html': 'handlebars' },
                path: __dirname + '/templates/valid',
                helpersPath: __dirname + '/templates/valid/helpers'
            });

            tempView.render('testHelpers', { something: 'uppercase' }, null, function (err, rendered, config) {

                expect(rendered).to.equal('<p>This is all UPPERCASE and this is how we like it!</p>');
                done();
            });
        });
    });

    describe('#handler', function () {

        it('handles routes to views', function (done) {

            var options = {
                views: {
                    engines: { 'html': 'handlebars' },
                    path: __dirname + '/templates'
                }
            };

            var server = new Hapi.Server(options);

            server.route({ method: 'GET', path: '/{param}', handler: { view: 'valid/handler' } });
            server.inject({
                method: 'GET',
                url: '/hello'
            }, function (res) {

                expect(res.result).to.contain('hello');
                done();
            });
        });

        it('handles custom context', function (done) {

           var options = {
                views: {
                    engines: { 'jade': 'jade' },
                    path: __dirname + '/templates'
                }
            };

            var server = new Hapi.Server(options);

            server.route({ method: 'GET', path: '/', handler: { view: { template: 'valid/index', context: { message: 'heyloo' } } } });
            server.inject('/', function (res) {

                expect(res.result).to.contain('heyloo');
                done();
            });
        });
    });
});
