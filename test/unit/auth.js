var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Auth = require(libPath + 'auth/index');

describe('Auth', function() {

    describe('#constructor', function() {

        it('throws an error when constructed without new', function(done) {

            var fn = function() {

                var auth = Auth();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error when constructed without options', function(done) {

            var fn = function() {

                var auth = new Auth(null);
            };

            expect(fn).to.throw(Error, 'Invalid options');
            done();
        });

        it('throws an error when constructed without a scheme', function(done) {

            var fn = function() {

                var auth = new Auth(null, {scheme: null});
            };

            expect(fn).to.throw(Error, 'Missing scheme');
            done();
        });

        it('doesn\'t throw an error when constructed with all required parameters', function(done) {

            var fn = function() {

                var server = {
                    settings: { },
                    addRoutes: function() { }
                };

                var auth = new Auth(server, {
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