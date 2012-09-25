// Load modules

var expect = require('chai').expect;
var Payload = process.env.TEST_COV ? require('../../lib-cov/payload') : require('../../lib/payload');


describe('Payload', function() {

    describe('#read', function() {

        it('passes null to the callback when the request is a GET', function(done) {
            var request = {
                method: 'get'
            };

            Payload.read(request, function(result) {
                expect(result).not.to.exist;
                done();
            });
        });

        it('passes null to the callback when the method is not put or post', function(done) {
            var request = {
                method: 'delete',
                _route: {
                    config: {}
                }
            };

            Payload.read(request, function(result) {
                expect(result).not.to.exist;
                done();
            });
        });
    });
});