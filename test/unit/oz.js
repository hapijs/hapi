var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Oz = require(libPath + 'auth/oz').Scheme;

describe('Oz', function() {

    describe('#constructor', function() {

        it('throws an error when constructed without new', function(done) {

            var fn = function() {

                var oz = Oz();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when constructed without options', function(done) {

            var fn = function() {

                var oz = new Oz(null);
            };

            expect(fn).to.throw(Error, 'Invalid options');
            done();
        });

        it('throws an error when constructed without oz scheme', function(done) {

            var fn = function() {

                var oz = new Oz(null, {scheme: 'notOz'});
            };

            expect(fn).to.throw(Error, 'Wrong scheme');
            done();
        });

        it('throws an error when constructed without encryption password', function(done) {

            var fn = function() {

                var oz = new Oz(null, {scheme: 'oz'});
            };

            expect(fn).to.throw(Error, 'Missing encryption password');
            done();
        });

        it('throws an error when constructed without loadAppFunc', function(done) {

            var fn = function() {

                var oz = new Oz(null, {scheme: 'oz', encryptionPassword: 'test'});
            };

            expect(fn).to.throw(Error, 'Missing required loadAppFunc method in configuration');
            done();
        });

        it('throws an error when constructed without loadGrantFunc', function(done) {

            var fn = function() {

                var oz = new Oz(null, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { }
                });
            };

            expect(fn).to.throw(Error, 'Missing required loadGrantFunc method in configuration');
            done();
        });

        it('throws an error when constructed without server', function(done) {

            var fn = function() {

                var oz = new Oz(null, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { },
                    loadGrantFunc: function() { }
                });
            };

            expect(fn).to.throw(Error, 'Server is required');
            done();
        });

        it('doesn\'t throw an error when constructed with all required parameters', function(done) {

            var fn = function() {

                var server = {
                    settings: { },
                    addRoutes: function() { }
                };

                var oz = new Oz(server, {
                    scheme: 'oz',
                    encryptionPassword: 'test',
                    loadAppFunc: function() { },
                    loadGrantFunc: function() { }
                });
            };

            expect(fn).to.not.throw(Error);
            done();
        });
    });
});