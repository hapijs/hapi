var expect = require('chai').expect;
var Error = process.env.TEST_COV ? require('../../lib-cov/error') : require('../../lib/error');

describe('Error', function() {

    describe('#badRequest', function() {

        it('returns a 400 error code', function(done) {
            expect(Error.badRequest().code).to.equal(400);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Error.badRequest('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#unauthorized', function() {

        it('returns a 401 error code', function(done) {
            expect(Error.unauthorized().code).to.equal(401);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Error.unauthorized('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#forbidden', function() {

        it('returns a 403 error code', function(done) {
            expect(Error.forbidden().code).to.equal(403);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Error.forbidden('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#notFound', function() {

        it('returns a 404 error code', function(done) {
            expect(Error.notFound().code).to.equal(404);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Error.notFound('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#internal', function() {

        it('returns a 500 error code', function(done) {
            expect(Error.internal().code).to.equal(500);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Error.internal('my message').message).to.equal('my message');
            done();
        });
    });
});