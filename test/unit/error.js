// Load modules

var Chai = require('chai');
var Oz = require('oz');
var Hapi = process.env.TEST_COV ? require('../../lib-cov') : require('../../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Error', function () {

    it('returns an error with info when constructed using another error and message', function (done) {

        var err = new Hapi.Error(new Error('inner'), 'outter');
        expect(err.message).to.equal('inner');
        expect(err.info).to.equal('outter');
        done();
    });

    describe('#badRequest', function () {

        it('returns a 400 error code', function (done) {

            expect(Hapi.Error.badRequest().code).to.equal(400);
            done();
        });

        it('sets the message with the passed in message', function (done) {

            expect(Hapi.Error.badRequest('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#unauthorized', function () {

        it('returns a 401 error code', function (done) {

            expect(Hapi.Error.unauthorized().code).to.equal(401);
            done();
        });

        it('sets the message with the passed in message', function (done) {

            expect(Hapi.Error.unauthorized('my message').message).to.equal('my message');
            done();
        });

        it('returns a WWW-Authenticate header when passed a scheme', function (done) {

            var err = Hapi.Error.unauthorized('boom', 'Test');
            expect(err.code).to.equal(401);
            expect(err.toResponse().headers['WWW-Authenticate']).to.equal('Test');
            done();
        });
    });

    describe('#forbidden', function () {

        it('returns a 403 error code', function (done) {

            expect(Hapi.Error.forbidden().code).to.equal(403);
            done();
        });

        it('sets the message with the passed in message', function (done) {

            expect(Hapi.Error.forbidden('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#notFound', function () {

        it('returns a 404 error code', function (done) {

            expect(Hapi.Error.notFound().code).to.equal(404);
            done();
        });

        it('sets the message with the passed in message', function (done) {

            expect(Hapi.Error.notFound('my message').message).to.equal('my message');
            done();
        });
    });

    describe('#internal', function () {

        it('returns a 500 error code', function (done) {

            expect(Hapi.Error.internal().code).to.equal(500);
            done();
        });

        it('sets the message with the passed in message', function (done) {

            expect(Hapi.Error.internal('my message').message).to.equal('my message');
            done();
        });

        it('passes data on the callback if its passed in', function (done) {

            expect(Hapi.Error.internal('my message', { my: 'data' }).data.my).to.equal('data');
            done();
        });
    });

    describe('#toResponse', function () {

        it('formats a custom error', function (done) {

            var err = new Hapi.Error(500, 'Unknown');
            err.toResponse = function () {

                return { payload: { test: true } };
            };

            expect(err.toResponse().payload.test).to.equal(true);
            done();
        });

        it('formats an external error', function (done) {

            var external = new Oz.error.unauthorized('test');
            external.test = { x: 1 };

            var err = new Hapi.Error(external);
            var response = err.toResponse();

            expect(response.payload.message).to.equal('test');
            expect(response.payload.test).to.equal(external.test);
            expect(response.headers['WWW-Authenticate']).to.contain('Oz');
            done();
        });
    });
});


