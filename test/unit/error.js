var expect = require('chai').expect;
var Err = process.env.TEST_COV ? require('../../lib-cov/error') : require('../../lib/error');

describe('Err', function() {

    describe('#badRequest', function() {

        it('returns a 400 error code', function(done) {
            expect(Err.badRequest().code).to.equal(400);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Err.badRequest('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#unauthorized', function() {

        it('returns a 401 error code', function(done) {
            expect(Err.unauthorized().code).to.equal(401);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Err.unauthorized('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#forbidden', function() {

        it('returns a 403 error code', function(done) {
            expect(Err.forbidden().code).to.equal(403);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Err.forbidden('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#notFound', function() {

        it('returns a 404 error code', function(done) {
            expect(Err.notFound().code).to.equal(404);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Err.notFound('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#internal', function() {

        it('returns a 500 error code', function(done) {
            expect(Err.internal().code).to.equal(500);
            done();
        });

        it('sets the message with the passed in message', function(done) {
            expect(Err.internal('my message').message).to.equal('my message');
            done();
        });

        it('passes data on the callback if its passed in', function(done) {
            expect(Err.internal('my message', { my: 'data' }).data.my).to.equal('data');
            done();
        });
    });

    describe('#toResponse', function () {

        it('formats a custom error', function (done) {

            var err = new Err(500, 'Unknown');
            err.toResponse = function () {

                return { payload: { test: true } };
            };

            expect(err.toResponse().payload.test).to.equal(true);
            done();
        });
    });
});


