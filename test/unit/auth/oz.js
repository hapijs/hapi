// Load modules

var Lab = require('lab');
var Oz = require('oz');
var Hapi = require('../../..');
var Scheme = require('../../../lib/auth/oz');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Auth', function () {

    describe('Oz', function () {

        describe('#constructor', function () {

            it('throws an error when constructed without new', function (done) {

                var fn = function () {

                    var scheme = Scheme();
                };

                expect(fn).to.throw(Error);
                done();
            });

            it('throws an error when constructed without options', function (done) {

                var fn = function () {

                    var scheme = new Scheme(null);
                };

                expect(fn).to.throw(Error, 'Invalid options');
                done();
            });

            it('throws an error when constructed without oz scheme', function (done) {

                var fn = function () {

                    var scheme = new Scheme(null, { scheme: 'notOz' });
                };

                expect(fn).to.throw(Error, 'Wrong scheme');
                done();
            });

            it('throws an error when constructed without encryption password', function (done) {

                var fn = function () {

                    var scheme = new Scheme(null, { scheme: 'oz' });
                };

                expect(fn).to.throw(Error, 'Missing encryption password');
                done();
            });

            it('throws an error when constructed without loadAppFunc', function (done) {

                var fn = function () {

                    var scheme = new Scheme(null, { scheme: 'oz', encryptionPassword: 'test' });
                };

                expect(fn).to.throw(Error, 'Missing required loadAppFunc method in configuration');
                done();
            });

            it('throws an error when constructed without loadGrantFunc', function (done) {

                var fn = function () {

                    var scheme = new Scheme(null, {
                        scheme: 'oz',
                        encryptionPassword: 'test',
                        loadAppFunc: function () { }
                    });
                };

                expect(fn).to.throw(Error, 'Missing required loadGrantFunc method in configuration');
                done();
            });

            it('throws an error when constructed without server', function (done) {

                var fn = function () {

                    var scheme = new Scheme(null, {
                        scheme: 'oz',
                        encryptionPassword: 'test',
                        loadAppFunc: function () { },
                        loadGrantFunc: function () { }
                    });
                };

                expect(fn).to.throw(Error, 'Server is required');
                done();
            });

            it('doesn\'t throw an error when constructed with all required parameters', function (done) {

                var fn = function () {

                    var server = {
                        settings: {},
                        route: function () { }
                    };

                    var scheme = new Scheme(server, {
                        scheme: 'oz',
                        encryptionPassword: 'test',
                        loadAppFunc: function () { },
                        loadGrantFunc: function () { }
                    });
                };

                expect(fn).to.not.throw(Error);
                done();
            });

            it('applies oz settings when passed in', function (done) {

                var server = {
                    settings: {},
                    route: function () { }
                };

                var settings = {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function () { },
                    loadGrantFunc: function () { },
                    ozSettings: { ticket: { myKey: 'myValue' } }
                };

                var scheme = new Scheme(server, settings);

                expect(Oz.settings.ticket.myKey).to.equal('myValue');
                done();
            });
        });
    });
});
